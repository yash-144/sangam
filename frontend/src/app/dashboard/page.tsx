"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet/WalletProvider";
import Navbar from "@/components/Navbar";
import { shortenAddress, stroopsToDisplay } from "@/lib/stellar";
import { useFund, sameAddress, fundStateName, hasMember } from "./_hooks/useFund";
import { useFundActions } from "./_hooks/useFundActions";
import { FundStats } from "./_components/FundStats";
import { RoundProgress } from "./_components/RoundProgress";
import { ActionPanel } from "./_components/ActionPanel";
import { MembersList } from "./_components/MembersList";
import { RoundHistory } from "./_components/RoundHistory";
import { CreateFundForm } from "./_components/CreateFundForm";
import { JoinFundForm } from "./_components/JoinFundForm";
import { EmptyState } from "./_components/EmptyState";
import type { Phase } from "./_hooks/useFund";

const INVITE_CODE_MOD = 900000;
const INVITE_CODE_MIN = 100000;
const INVITE_CODE_MULTIPLIER = 7919;
const INVITE_CODE_OFFSET = 104729;

function fundIdToInviteCode(fundId: number | null) {
  if (!fundId) return "";
  const code = ((fundId * INVITE_CODE_MULTIPLIER + INVITE_CODE_OFFSET) % INVITE_CODE_MOD) + INVITE_CODE_MIN;
  return String(code).padStart(6, "0");
}

export default function DashboardPage() {
  const { isConnected, address, connect } = useWallet();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"action" | "members" | "history">("action");

  const fund = useFund(address ?? null, isConnected);
  const {
    summary, round, phase, memberStatuses, roundHistory,
    loading, currentFundId, setCurrentFundId,
    pendingJoinFundId, setPendingJoinFundId,
    pendingStartFundId, setPendingStartFundId,
    pendingSealKey, setPendingSealKey,
    actionLoading, setActionLoading,
    fetchFund, setSummary,
  } = fund;

  const actions = useFundActions({
    address: address ?? null,
    currentFundId,
    summary,
    round,
    setCurrentFundId,
    setSummary,
    setPendingJoinFundId,
    setPendingStartFundId,
    setPendingSealKey,
    setActionLoading,
    fetchFund,
  });

  useEffect(() => {
    if (!isConnected) {
      const t = setTimeout(() => { if (!isConnected) router.push("/"); }, 800);
      return () => clearTimeout(t);
    }
  }, [isConnected, router]);

  // ─── Derived state ────────────────────────────────────────────────────────────
  const currentRound = summary ? (summary.current_round === 0 ? 1 : summary.current_round) : 1;
  const isOrganizer = sameAddress(summary?.config.organizer, address);
  const isMember = hasMember(summary, address);
  const myStatus = address ? Object.entries(memberStatuses).find(([a]) => sameAddress(a, address))?.[1] : undefined;
  const stateName = fundStateName(summary);
  const winnerThisRound = summary?.past_winners?.[currentRound - 1];
  const iAmWinner = sameAddress(winnerThisRound, address);
  const potAmount = summary ? Number(summary.config.contribution) * summary.config.member_count : 0;
  const inviteCode = fundIdToInviteCode(currentFundId);
  const isJoiningCurrentFund = pendingJoinFundId !== null && pendingJoinFundId === currentFundId && !isMember;
  const isStartingCurrentFund = pendingStartFundId !== null && pendingStartFundId === currentFundId && stateName === "Pending";
  const roundActionKey = currentFundId === null ? null : `${currentFundId}:${currentRound}`;
  const isSealingCurrentRound = pendingSealKey === roundActionKey && !myStatus?.has_committed;
  const showInviteCode = Boolean(summary && stateName === "Pending" && summary.members.length < summary.config.member_count);

  const phaseInfo: Record<Phase, { label: string; action: string; hint: string; canAct: boolean; handler: () => void }> = {
    pending: {
      label: "Waiting for members",
      action: isJoiningCurrentFund ? "Joining fund..." : isStartingCurrentFund ? "Starting fund..." : isOrganizer ? "Start Fund" : isMember ? "Waiting for organiser" : "Join Fund",
      hint: isOrganizer
        ? isStartingCurrentFund ? "Start transaction submitted. Waiting for the fund to become active."
        : `${summary?.members.length ?? 0}/${summary?.config.member_count ?? "?"} members joined. Start when full.`
        : isJoiningCurrentFund ? "Your join transaction is submitted. Waiting for the fund to sync."
        : isMember ? "Waiting for the organiser to start." : "Enter the invite code to join.",
      canAct: isJoiningCurrentFund || isStartingCurrentFund ? false : isOrganizer ? (summary?.members.length === summary?.config.member_count) : !isMember,
      handler: isOrganizer ? actions.handleActivate : () => actions.setShowJoinInput(true),
    },
    deposit: {
      label: "Deposit phase",
      action: "Pay My Share",
      hint: `${round?.deposit_count ?? 0}/${summary?.config.member_count ?? "?"} members have deposited.`,
      canAct: !myStatus?.has_deposited,
      handler: actions.handleDeposit,
    },
    commit: {
      label: "Seal your draw",
      action: isSealingCurrentRound ? "Sealing draw..." : "Seal Draw",
      hint: isSealingCurrentRound ? "Seal transaction submitted. Waiting for your round status to sync." : `${round?.commit_count ?? 0}/${summary?.config.member_count ?? "?"} members have sealed.`,
      canAct: !isSealingCurrentRound && !myStatus?.has_committed,
      handler: actions.handleCommit,
    },
    reveal: {
      label: "Reveal your draw",
      action: "Reveal Draw",
      hint: `${round?.reveal_count ?? 0}/${summary?.config.member_count ?? "?"} members have revealed.`,
      canAct: !myStatus?.has_revealed,
      handler: actions.handleReveal,
    },
    claim: {
      label: "Claim the pot",
      action: iAmWinner ? "Claim Pot" : "Waiting for winner to claim",
      hint: iAmWinner ? `You won! Claim ${stroopsToDisplay(potAmount)} USDC.` : `${shortenAddress(winnerThisRound ?? "")} won this round. Waiting for them to claim the pot.`,
      canAct: iAmWinner,
      handler: actions.handleClaim,
    },
    completed: {
      label: "Fund completed",
      action: "Fund Complete",
      hint: "All rounds are done. Everyone has received their pot.",
      canAct: false,
      handler: () => {},
    },
  };

  if (!isConnected) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-fg)", marginBottom: "1rem" }}>Connect your wallet to continue</p>
          <button onClick={() => connect()} className="btn btn-primary">Connect wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ paddingTop: "60px" }}>
        <div className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start justify-between mb-12 gap-4">
            <div>
              <code style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginBottom: "0.375rem", display: "block", fontFamily: "var(--font-mono)" }}>
                {shortenAddress(address ?? "")}
              </code>
              <h1 style={{ fontSize: "clamp(var(--text-2xl), 4vw, var(--text-3xl))", fontWeight: 700, letterSpacing: "-0.04em" }}>
                {summary ? summary.config.name : "Dashboard"}
              </h1>
            </div>
            {!summary && !loading && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <button onClick={() => { actions.setShowCreate(true); actions.setShowJoinInput(false); }} className="btn btn-primary">
                  + Create Fund
                </button>
                <button onClick={() => { actions.setShowJoinInput(true); actions.setShowCreate(false); }} className="btn btn-outline">
                  Join Fund
                </button>
              </div>
            )}
            {summary && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className={`badge ${stateName === "Active" ? "badge-active" : stateName === "Pending" ? "badge-pending" : "badge-completed"}`}>
                  {stateName}
                </span>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--muted-fg)", fontSize: "var(--text-base)" }}>
              <div className="spin" style={{ width: "16px", height: "16px", border: "2px solid var(--border)", borderTopColor: "var(--fg)", borderRadius: "50%" }} />
              Loading fund data…
            </div>
          )}

          {/* Create form */}
          {!loading && actions.showCreate && (
            <CreateFundForm
              createName={actions.createName}
              setCreateName={actions.setCreateName}
              createAmount={actions.createAmount}
              setCreateAmount={actions.setCreateAmount}
              createMembers={actions.createMembers}
              setCreateMembers={actions.setCreateMembers}
              actionLoading={actionLoading}
              onSubmit={actions.handleCreate}
              onCancel={() => actions.setShowCreate(false)}
            />
          )}

          {/* Join form */}
          {!loading && actions.showJoinInput && (
            <JoinFundForm
              joinFundIdInput={actions.joinFundIdInput}
              setJoinFundIdInput={actions.setJoinFundIdInput}
              actionLoading={actionLoading}
              onSubmit={() => actions.handleJoin()}
              onCancel={() => actions.setShowJoinInput(false)}
            />
          )}

          {/* Action error from create/join forms */}
          {!summary && actions.actionError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "var(--text-sm)", color: "#dc2626", maxWidth: "28rem" }}>
              {actions.actionError}
            </div>
          )}

          {/* Empty state */}
          {!loading && !summary && !actions.showCreate && !actions.showJoinInput && (
            <EmptyState
              onCreateClick={() => actions.setShowCreate(true)}
              onJoinClick={() => actions.setShowJoinInput(true)}
            />
          )}

          {/* Fund dashboard */}
          {!loading && summary && (
            <div className="grid grid-cols-1 gap-8">

              <FundStats summary={summary} currentRound={currentRound} potAmount={potAmount} />

              <RoundProgress currentRound={currentRound} totalRounds={summary.config.member_count} />

              {/* Tabs */}
              <div>
                <div style={{ display: "flex", gap: "0", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
                  {(["action", "members", "history"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        background: "none", border: "none", padding: "0.75rem 1.125rem",
                        fontSize: "var(--text-sm)", fontWeight: 500, cursor: "pointer",
                        color: activeTab === tab ? "var(--fg)" : "var(--muted-fg)",
                        borderBottom: activeTab === tab ? "2px solid var(--fg)" : "2px solid transparent",
                        marginBottom: "-1px", transition: "color 0.15s ease",
                        textTransform: "capitalize",
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === "action" && (
                  <ActionPanel
                    phase={phase}
                    phaseInfo={phaseInfo[phase]}
                    actionLoading={actionLoading}
                    actionError={actions.actionError}
                    actionSuccess={actions.actionSuccess}
                    isJoiningCurrentFund={isJoiningCurrentFund}
                    isStartingCurrentFund={isStartingCurrentFund}
                    isSealingCurrentRound={isSealingCurrentRound}
                    showInviteCode={showInviteCode}
                    inviteCode={inviteCode}
                    onClearFund={actions.handleClearFund}
                  />
                )}

                {activeTab === "members" && (
                  <MembersList
                    summary={summary}
                    memberStatuses={memberStatuses}
                    address={address ?? null}
                    stateName={stateName}
                  />
                )}

                {activeTab === "history" && (
                  <RoundHistory roundHistory={roundHistory} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
