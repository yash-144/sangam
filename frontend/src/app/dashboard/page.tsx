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
  const { isConnected, address, connect, supabaseUser, isSupabaseLoading, signInWithGoogle } = useWallet();
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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--muted-fg)", marginBottom: "1rem" }}>Connect your wallet to continue</p>
            <button onClick={() => connect()} className="btn btn-primary">Connect wallet</button>
          </div>
        </div>
      </div>
    );
  }

  if (isSupabaseLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-fg)" }}>
          Loading profile...
        </div>
      </div>
    );
  }

  if (!supabaseUser) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ 
            textAlign: "center", 
            width: "100%",
            maxWidth: "400px", 
            padding: "3rem 2.5rem", 
            border: "1px solid var(--border)", 
            borderRadius: "16px", 
            background: "var(--surface)", 
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)" 
          }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              background: "var(--bg)", 
              borderRadius: "12px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              margin: "0 auto 1.5rem",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02) inset"
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg)" }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>
              Sign in to continue
            </h2>
            <p style={{ color: "var(--muted-fg)", fontSize: "0.9375rem", marginBottom: "2.5rem" }}>
              Securely authenticate to access your dashboard.
            </p>

            <button 
              onClick={() => signInWithGoogle()} 
              style={{ 
                width: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: "0.75rem",
                padding: "0.875rem", 
                fontSize: "1rem", 
                borderRadius: "8px", 
                fontWeight: 500,
                background: "var(--bg)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--fg)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </main>
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
            {!summary && !loading && null}
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
