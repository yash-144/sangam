"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/components/wallet/WalletProvider";
import Navbar from "@/components/Navbar";
import {
  getFundSummary,
  getRoundSummary,
  getMemberStatus,
  createChitFund,
  joinFund,
  activateFund,
  deposit,
  commitHash,
  revealHash,
  claimPot,
  type FundSummary,
  type MemberStatus,
  type RoundSummary,
} from "@/lib/contract";
import { usdcToStroops, USDC_CONTRACT_ID, shortenAddress, stroopsToDisplay } from "@/lib/stellar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray, (byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("");
}

function sameAddress(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toUpperCase() === b.toUpperCase());
}

function hasMember(data: FundSummary | null, member: string | null | undefined) {
  return Boolean(member && data?.members?.some((m) => sameAddress(m, member)));
}

function fundStateName(data: FundSummary | null | undefined): string {
  return data?.state?.[0] ?? "Unknown";
}

function hasWinnerForRound(data: FundSummary | null | undefined, round: number): boolean {
  return Boolean(data?.past_winners?.[round - 1]);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const INVITE_CODE_MOD = 900000;
const INVITE_CODE_MIN = 100000;
const INVITE_CODE_MULTIPLIER = 7919;
const INVITE_CODE_OFFSET = 104729;
const INVITE_CODE_MULTIPLIER_INVERSE = 517679;

function fundIdToInviteCode(fundId: number | null) {
  const numericFundId = toFundIdNumber(fundId);
  if (!numericFundId) return "";
  const code = ((numericFundId * INVITE_CODE_MULTIPLIER + INVITE_CODE_OFFSET) % INVITE_CODE_MOD) + INVITE_CODE_MIN;
  return String(code).padStart(6, "0");
}

function toFundIdNumber(value: number | bigint | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function inviteCodeToFundId(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return NaN;
  if (digits.length < 6) return Number(digits);

  const code = Number(digits.slice(0, 6));
  const decoded = (((code - INVITE_CODE_MIN - INVITE_CODE_OFFSET) * INVITE_CODE_MULTIPLIER_INVERSE) % INVITE_CODE_MOD + INVITE_CODE_MOD) % INVITE_CODE_MOD;
  return decoded > 0 ? decoded : NaN;
}

const RPC_RETRY_DELAY_MS = 1500;
const WINNER_SYNC_ATTEMPTS = 8;
const LIVE_SYNC_INTERVAL_MS = 5000;

const emptyRound = (): RoundSummary => ({ deposit_count: 0, commit_count: 0, reveal_count: 0 });

type Phase = "pending" | "deposit" | "commit" | "reveal" | "claim" | "completed";

type FetchOptions = {
  silent?: boolean;
  waitForFund?: boolean;
  waitForMember?: string;
  waitForState?: string;
  waitForStatus?: keyof MemberStatus;
  waitForWinner?: boolean;
};

function roundActionKey(fundId: number | null, round: number) {
  return fundId === null ? null : `${fundId}:${round}`;
}

function currentFundStorageKey(address: string | null | undefined) {
  return address ? `cf_current_fund_id_${address}` : null;
}

async function getRoundSummaryWithRetry(address: string, fundId: number, round: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const summary = await getRoundSummary(address, fundId, round).catch(() => null);
    if (summary) return summary;
    await wait(1000);
  }

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { isConnected, address, connect } = useWallet();
  const router = useRouter();

  // Fund ID
  const [currentFundId, setCurrentFundId] = useState<number | null>(null);
  const [joinFundId, setJoinFundId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createAmount, setCreateAmount] = useState("100");
  const [createMembers, setCreateMembers] = useState("5");
  const [showCreate, setShowCreate] = useState(false);

  // Fund state
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [phase, setPhase] = useState<Phase>("deposit");
  const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberStatus>>({});
  const [roundHistory, setRoundHistory] = useState<Array<{ round: number; winner: string | null; roundData: RoundSummary | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [pendingJoinFundId, setPendingJoinFundId] = useState<number | null>(null);
  const [pendingStartFundId, setPendingStartFundId] = useState<number | null>(null);
  const [pendingSealKey, setPendingSealKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"action" | "members" | "history">("action");

  const liveSyncInFlight = useRef(false);

  // Restore fund ID from localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const key = currentFundStorageKey(address);
      const saved = key ? window.localStorage.getItem(key) : null;
      if (saved) {
        setCurrentFundId(Number(saved));
      } else {
        setCurrentFundId(null);
        setSummary(null);
        setRound(null);
        setRoundHistory([]);
        setMemberStatuses({});
        setPendingJoinFundId(null);
        setPendingStartFundId(null);
        setPendingSealKey(null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [address]);

  useEffect(() => {
    const key = currentFundStorageKey(address);
    if (key && currentFundId !== null) localStorage.setItem(key, String(currentFundId));
  }, [address, currentFundId]);

  // Redirect to landing if not connected
  useEffect(() => {
    if (!isConnected) {
      const t = setTimeout(() => { if (!isConnected) router.push("/"); }, 800);
      return () => clearTimeout(t);
    }
  }, [isConnected, router]);

  // ─── Fetch fund ─────────────────────────────────────────────────────────────
  const fetchFund = useCallback(async (overrideFundId?: number, options: FetchOptions = {}) => {
    const targetId = overrideFundId !== undefined ? overrideFundId : currentFundId;
    if (!address || targetId === null) {
      if (!options.silent) setLoading(false);
      return;
    }
    try {
      if (!options.silent) setLoading(true);
      let data = await getFundSummary(address, targetId) as FundSummary | null;
      if (!data && options.waitForFund) {
        for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
          await wait(RPC_RETRY_DELAY_MS);
          data = await getFundSummary(address, targetId) as FundSummary | null;
          if (data) break;
        }
      }

      if (data) {
        let currentRound = data.current_round === 0 ? 1 : data.current_round;
        let rData = await getRoundSummaryWithRetry(address, targetId, currentRound) || emptyRound();

        for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
          const allRevealsSeen = rData.reveal_count >= data.config.member_count;
          const waitingOnWinner = fundStateName(data) === "Active" && (allRevealsSeen || options.waitForWinner) && !hasWinnerForRound(data, currentRound);
          const waitingOnMember = Boolean(options.waitForMember && !hasMember(data, options.waitForMember));
          const waitingOnState = Boolean(options.waitForState && fundStateName(data) !== options.waitForState);
          if (!waitingOnWinner && !waitingOnMember && !waitingOnState) break;
          await wait(RPC_RETRY_DELAY_MS);
          const refreshed = await getFundSummary(address, targetId) as FundSummary | null;
          if (refreshed) { data = refreshed; currentRound = data.current_round === 0 ? 1 : data.current_round; }
          rData = await getRoundSummaryWithRetry(address, targetId, currentRound) || emptyRound();
        }

        setSummary(data);
        setPendingJoinFundId((pending) => (
          pending !== null && pending === targetId && hasMember(data, address) ? null : pending
        ));
        setPendingStartFundId((pending) => (
          pending !== null && pending === targetId && fundStateName(data) !== "Pending" ? null : pending
        ));
        setRound(rData);

        // Determine phase
        const stateName = fundStateName(data);
        const winnerReady = hasWinnerForRound(data, currentRound);
        if (stateName === "Pending") setPhase("pending");
        else if (stateName === "Completed") setPhase("completed");
        else if (rData.deposit_count < data.config.member_count) setPhase("deposit");
        else if (rData.commit_count < data.config.member_count) setPhase("commit");
        else if (rData.reveal_count < data.config.member_count || !winnerReady) setPhase("reveal");
        else setPhase("claim");

        // Member statuses
        if (stateName !== "Pending") {
          let entries = await Promise.all(
            data.members.map(async (m) => [m, await getMemberStatus(address, targetId, m, currentRound)] as [string, MemberStatus])
          );
          if (options.waitForStatus) {
            for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
              const mine = entries.find(([m]) => sameAddress(m, address))?.[1];
              if (mine?.[options.waitForStatus]) break;
              await wait(RPC_RETRY_DELAY_MS);
              entries = await Promise.all(
                data.members.map(async (m) => [m, await getMemberStatus(address, targetId, m, currentRound)] as [string, MemberStatus])
              );
            }
          }
          setMemberStatuses(Object.fromEntries(entries));
          setPendingSealKey((pending) => {
            const mine = entries.find(([m]) => sameAddress(m, address))?.[1];
            return pending !== null && pending === roundActionKey(targetId, currentRound) && mine?.has_committed ? null : pending;
          });
        }

        // Round history
        if (currentRound > 1 || stateName === "Completed") {
          const completedRounds = Array.from({ length: stateName === "Completed" ? currentRound : currentRound - 1 }, (_, i) => i + 1);
          const historyEntries = await Promise.all(
            completedRounds.map(async (r) => {
              const rd = await getRoundSummaryWithRetry(address, targetId, r);
              return { round: r, winner: data!.past_winners[r - 1] ?? null, roundData: rd };
            })
          );
          setRoundHistory(historyEntries);
        } else {
          setRoundHistory([]);
        }
      } else {
        if (!options.silent && !options.waitForFund) {
          setSummary(null); setRound(null); setRoundHistory([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch fund:", err);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [address, currentFundId]);

  useEffect(() => {
    if (!isConnected || !address) return;
    const timer = window.setTimeout(() => {
      void fetchFund(undefined, { waitForFund: currentFundId !== null });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isConnected, address, fetchFund, currentFundId]);

  // Live sync
  useEffect(() => {
    if (!isConnected || !address || currentFundId === null || actionLoading) return;
    const sync = async () => {
      if (liveSyncInFlight.current) return;
      liveSyncInFlight.current = true;
      try { await fetchFund(undefined, { silent: true }); } finally { liveSyncInFlight.current = false; }
    };
    const interval = setInterval(() => void sync(), LIVE_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, address, currentFundId, actionLoading, fetchFund]);

  // ─── Error parsing ───────────────────────────────────────────────────────────
  function parseError(raw: string): string {
    if (raw.includes("deposit phase not complete")) return "Not everyone has deposited yet. Please wait.";
    if (raw.includes("already joined")) return "You have already joined this circle.";
    if (raw.includes("slots are full")) return "This circle is already full.";
    if (raw.includes("fund state is not Pending")) return "This circle is no longer accepting members.";
    if (raw.includes("only organizer can activate")) return "Only the organiser can start the fund.";
    if (raw.includes("slots are not full")) return "Waiting for all members to join.";
    if (raw.includes("already committed") || raw.includes("commitment.is_some")) return "You have already sealed your draw for this round.";
    if (raw.includes("already deposited") || raw.includes("has_deposited")) return "You have already paid your share this round.";
    if (raw.includes("reveal phase not complete")) return "Not everyone has revealed yet.";
    return raw;
  }

  // ─── Action runner ───────────────────────────────────────────────────────────
  async function runAction(fn: () => Promise<unknown>, errorMsg: string, successMsg?: string, onError?: () => void) {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await wait(50);
      const res = await fn();
      await wait(3000);
      const nextFundId = typeof res === "number" || typeof res === "bigint" ? toFundIdNumber(res) ?? undefined : undefined;
      const waitForWinner = typeof res === "object" && res !== null && "waitForWinner" in res && Boolean(res.waitForWinner);
      const waitForMember = typeof res === "object" && res !== null && "waitForMember" in res && typeof res.waitForMember === "string" ? res.waitForMember : undefined;
      const waitForState = typeof res === "object" && res !== null && "waitForState" in res && typeof res.waitForState === "string" ? res.waitForState : undefined;
      const waitForStatus = typeof res === "object" && res !== null && "waitForStatus" in res && typeof res.waitForStatus === "string" ? res.waitForStatus as keyof MemberStatus : undefined;
      await fetchFund(nextFundId, { waitForFund: nextFundId !== undefined, waitForMember, waitForState, waitForStatus, waitForWinner });
      if (successMsg) { setActionSuccess(successMsg); setTimeout(() => setActionSuccess(null), 4000); }
    } catch (e: unknown) {
      onError?.();
      const message = e instanceof Error ? e.message : errorMsg;
      setActionError(parseError(message));
    } finally {
      setActionLoading(false);
    }
  }

  // ─── Secret/hash ─────────────────────────────────────────────────────────────
  async function generateSecretAndHash(addr: string) {
    const secretBytes = new Uint8Array(32);
    window.crypto.getRandomValues(secretBytes);
    const secretHex = toHexString(secretBytes);
    localStorage.setItem(`chitfund_secret_${addr}`, secretHex);
    const hashBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
    return toHexString(new Uint8Array(hashBuffer));
  }

  // ─── Action handlers ─────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!createName || !createAmount || !createMembers) { setActionError("Please fill out all fields."); return; }
    const amount = Number(createAmount);
    const members = Number(createMembers);
    if (amount <= 0) { setActionError("Amount must be greater than 0."); return; }
    if (members < 2 || members > 10) { setActionError("Members must be between 2 and 10."); return; }
    if (!USDC_CONTRACT_ID) { setActionError("USDC Contract ID is missing from configuration."); return; }
    runAction(async () => {
      const newFundId = toFundIdNumber(await createChitFund(address!, USDC_CONTRACT_ID, createName, usdcToStroops(createAmount), members));
      if (!newFundId) throw new Error("Could not read the new fund ID.");
      setCurrentFundId(newFundId);
      setShowCreate(false);
      return newFundId;
    }, "Failed to create fund");
  };

  const handleJoin = (id?: number) => {
    const targetId = id ?? inviteCodeToFundId(joinFundId);
    if (isNaN(targetId)) { setActionError("Please enter a valid invite code."); return; }
    runAction(async () => {
      setPendingJoinFundId(targetId);
      setCurrentFundId(targetId);
      await joinFund(address!, targetId);
      setShowJoinInput(false);
      return { waitForMember: address! };
    }, "Failed to join fund", "Joined successfully!", () => setPendingJoinFundId(null));
  };

  const handleActivate = () => runAction(async () => {
    setPendingStartFundId(currentFundId);
    await activateFund(address!, currentFundId!);
    return { waitForState: "Active" };
  }, "Failed to activate", "Fund started!", () => setPendingStartFundId(null));
  const handleDeposit = () => runAction(async () => {
    const res = await deposit(address!, currentFundId!, summary!.config.contribution);
    localStorage.setItem(`chitfund_paid_${currentFundId}_${summary!.current_round}_${address}`, "true");
    return res;
  }, "Failed to deposit", "Deposit successful!");
  const handleCommit = () => runAction(async () => {
    const hashHex = await generateSecretAndHash(address!);
    setPendingSealKey(roundActionKey(currentFundId, currentRound));
    await commitHash(address!, currentFundId!, hashHex);
    localStorage.setItem(`chitfund_sealed_${currentFundId}_${summary!.current_round}_${address}`, "true");
    return { waitForStatus: "has_committed" };
  }, "Failed to commit", "Draw sealed!", () => setPendingSealKey(null));
  const handleReveal = () => runAction(async () => {
    const secretHex = localStorage.getItem(`chitfund_secret_${address}`);
    if (!secretHex) throw new Error("No sealed draw found on this device.");
    const revealWillPickWinner = (round?.reveal_count ?? 0) >= summary!.config.member_count - 1;
    await revealHash(address!, currentFundId!, secretHex);
    localStorage.setItem(`chitfund_revealed_${currentFundId}_${summary!.current_round}_${address}`, "true");
    return { waitForWinner: revealWillPickWinner };
  }, "Failed to reveal", "Revealed!");
  const handleClaim = () => runAction(async () => {
    await claimPot(address!, currentFundId!);
    localStorage.setItem(`chitfund_claimed_${currentFundId}_${summary!.current_round}_${address}`, "true");
  }, "Failed to claim", "Pot claimed!");

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
  const isSealingCurrentRound = pendingSealKey === roundActionKey(currentFundId, currentRound) && !myStatus?.has_committed;
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
      handler: isOrganizer ? handleActivate : () => setShowJoinInput(true),
    },
    deposit: {
      label: "Deposit phase",
      action: "Pay My Share",
      hint: `${round?.deposit_count ?? 0}/${summary?.config.member_count ?? "?"} members have deposited.`,
      canAct: !myStatus?.has_deposited,
      handler: handleDeposit,
    },
    commit: {
      label: "Seal your draw",
      action: isSealingCurrentRound ? "Sealing draw..." : "Seal Draw",
      hint: isSealingCurrentRound ? "Seal transaction submitted. Waiting for your round status to sync." : `${round?.commit_count ?? 0}/${summary?.config.member_count ?? "?"} members have sealed.`,
      canAct: !isSealingCurrentRound && !myStatus?.has_committed,
      handler: handleCommit,
    },
    reveal: {
      label: "Reveal your draw",
      action: "Reveal Draw",
      hint: `${round?.reveal_count ?? 0}/${summary?.config.member_count ?? "?"} members have revealed.`,
      canAct: !myStatus?.has_revealed,
      handler: handleReveal,
    },
    claim: {
      label: "Claim the pot",
      action: iAmWinner ? "Claim Pot" : "Waiting for winner to claim",
      hint: iAmWinner ? `You won! Claim ${stroopsToDisplay(potAmount)} USDC.` : `${shortenAddress(winnerThisRound ?? "")} won this round. Waiting for them to claim the pot.`,
      canAct: iAmWinner,
      handler: handleClaim,
    },
    completed: {
      label: "Fund completed",
      action: "Fund Complete",
      hint: "All rounds are done. Everyone has received their pot.",
      canAct: false,
      handler: () => {},
    },
  };

  const currentPhaseInfo = phaseInfo[phase];

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-fg)", marginBottom: "1rem" }}>Connect your wallet to continue</p>
          <button onClick={() => connect()} className="btn btn-primary">Connect Wallet</button>
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
              <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginBottom: "0.375rem", fontFamily: "monospace" }}>
                {shortenAddress(address ?? "")}
              </p>
              <h1 style={{ fontSize: "clamp(var(--text-xl), 3vw, var(--text-2xl))", fontWeight: 700, letterSpacing: "-0.04em" }}>
                {summary ? summary.config.name : "Dashboard"}
              </h1>
            </div>
            {!summary && !loading && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <button onClick={() => { setShowCreate(true); setShowJoinInput(false); }} className="btn btn-primary">
                  + Create Fund
                </button>
                <button onClick={() => { setShowJoinInput(true); setShowCreate(false); }} className="btn btn-outline">
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
          {!loading && showCreate && (
            <div className="card" style={{ padding: "2rem", maxWidth: "28rem", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "var(--tracking-snug)" }}>Create a new fund</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Fund name</label>
                  <input className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Diwali Savings Circle" />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Monthly contribution (USDC)</label>
                  <input className="input" type="number" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} min="1" />
                </div>
                <div>
                  <label style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Number of members (2–10)</label>
                  <input className="input" type="number" value={createMembers} onChange={(e) => setCreateMembers(e.target.value)} min="2" max="10" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button onClick={handleCreate} disabled={actionLoading} className="btn btn-primary" style={{ flex: 1 }}>
                    {actionLoading ? "Deploying…" : "Deploy Fund"}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="btn btn-outline">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Join form */}
          {!loading && showJoinInput && (
            <div className="card" style={{ padding: "2rem", maxWidth: "28rem", marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "var(--tracking-snug)" }}>Join an existing fund</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="input"
                  value={joinFundId}
                  onChange={(e) => setJoinFundId(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit invite code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <button onClick={() => handleJoin()} disabled={actionLoading} className="btn btn-primary">
                  {actionLoading ? "Joining…" : "Join"}
                </button>
                <button onClick={() => setShowJoinInput(false)} className="btn btn-outline">Cancel</button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !summary && !showCreate && !showJoinInput && (
            <div style={{ paddingTop: "4rem", textAlign: "center" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🪙</p>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "0.625rem", letterSpacing: "var(--tracking-snug)" }}>No active fund</h2>
              <p style={{ fontSize: "var(--text-base)", color: "var(--muted-fg)", marginBottom: "2.5rem" }}>Create a new fund or join one with a six-digit invite code.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Create Fund</button>
                <button onClick={() => setShowJoinInput(true)} className="btn btn-outline">Join Fund</button>
              </div>
            </div>
          )}

          {/* Fund dashboard */}
          {!loading && summary && (
            <div className="grid grid-cols-1 gap-8">

              {/* Stats row */}
              <div className="grid-panel grid grid-cols-2 md:grid-cols-4">
                {[
                  { label: "Pot Size", value: `${stroopsToDisplay(potAmount)} USDC` },
                  { label: "Round", value: `${currentRound} / ${summary.config.member_count}` },
                  { label: "Members", value: `${summary.members.length} / ${summary.config.member_count}` },
                  { label: "Contribution", value: `${stroopsToDisplay(summary.config.contribution)} USDC` },
                ].map((s) => (
                  <div key={s.label} style={{ padding: "1.5rem 1.75rem" }}>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-fg)", marginBottom: "0.5rem", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", fontWeight: 500 }}>{s.label}</p>
                    <p style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "var(--tracking-snug)" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Round progress */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>Round progress</span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>{currentRound}/{summary.config.member_count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(currentRound / summary.config.member_count) * 100}%` }} />
                </div>
              </div>

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

                {/* Action tab */}
                {activeTab === "action" && (
                  <div style={{ maxWidth: "28rem" }}>
                    <div style={{ marginBottom: "1.5rem" }}>
                      <p className="text-label" style={{ color: "var(--muted-fg)", marginBottom: "0.5rem" }}>
                        {currentPhaseInfo.label}
                      </p>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", lineHeight: "var(--leading-normal)" }}>{currentPhaseInfo.hint}</p>
                      {phase === "pending" && showInviteCode && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "1rem", marginTop: "1rem", background: "var(--muted)" }}>
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-fg)", marginBottom: "0.375rem", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", fontWeight: 600 }}>Join code</p>
                          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, fontFamily: "monospace", letterSpacing: "0" }}>{inviteCode}</p>
                          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginTop: "0.5rem", lineHeight: "var(--leading-normal)" }}>
                            Share this code with other members so they can join this fund.
                          </p>
                        </div>
                      )}
                      {(isJoiningCurrentFund || isStartingCurrentFund || isSealingCurrentRound) && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.875rem", fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>
                          <div className="spin" style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: "var(--fg)", borderRadius: "50%" }} />
                          {isStartingCurrentFund ? "Syncing fund start..." : isSealingCurrentRound ? "Syncing your sealed draw..." : "Syncing your membership..."}
                        </div>
                      )}
                    </div>

                    {actionError && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "var(--text-sm)", color: "#dc2626" }}>
                        {actionError}
                      </div>
                    )}
                    {actionSuccess && (
                      <div style={{ background: "var(--accent-light)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: "6px", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "var(--text-sm)", color: "var(--accent)" }}>
                        {actionSuccess}
                      </div>
                    )}

                    {phase !== "completed" && (
                      <button
                        onClick={currentPhaseInfo.handler}
                        disabled={actionLoading || !currentPhaseInfo.canAct}
                        className="btn btn-primary btn-lg"
                        style={{ width: "100%" }}
                      >
                        {actionLoading ? "Processing…" : currentPhaseInfo.action}
                      </button>
                    )}

                    {phase === "completed" && (
                      <div style={{ textAlign: "center", padding: "2rem 0" }}>
                        <p style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎉</p>
                        <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, letterSpacing: "var(--tracking-snug)" }}>Fund complete!</p>
                        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginTop: "0.5rem" }}>All rounds finished. Everyone got their pot.</p>
                        <button
                          onClick={() => {
                            setCurrentFundId(null);
                            const key = currentFundStorageKey(address);
                            if (key) localStorage.removeItem(key);
                            setSummary(null);
                          }}
                          className="btn btn-outline"
                          style={{ marginTop: "2rem" }}
                        >
                          Start a new fund
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Members tab */}
                {activeTab === "members" && (
                  <div>
                    {summary.members.length === 0 ? (
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>No members yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                        {summary.members.map((m, i) => {
                          const status = Object.entries(memberStatuses).find(([a]) => sameAddress(a, m))?.[1];
                          const isMe = sameAddress(m, address);
                          const isOrg = sameAddress(m, summary.config.organizer);
                          const winner = summary.past_winners.includes(m);
                          return (
                            <div key={m} style={{ background: "var(--bg)", padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                                <span style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", fontFamily: "monospace", flexShrink: 0 }}>#{i + 1}</span>
                                <span style={{ fontSize: "var(--text-sm)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {shortenAddress(m)}
                                </span>
                                {isMe && <span className="badge badge-active">you</span>}
                                {isOrg && <span className="badge" style={{ background: "var(--muted)", color: "var(--muted-fg)" }}>organiser</span>}
                                {winner && <span className="badge badge-active">won</span>}
                              </div>
                              {status && stateName !== "Pending" && (
                                <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                                  {[
                                    { key: "has_deposited", label: "D" },
                                    { key: "has_committed", label: "C" },
                                    { key: "has_revealed", label: "R" },
                                  ].map(({ key, label }) => (
                                    <span
                                      key={key}
                                      title={key.replace("has_", "")}
                                      style={{
                                        width: "20px", height: "20px", borderRadius: "4px",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.5625rem", fontWeight: 600,
                                        background: status[key as keyof MemberStatus] ? "var(--accent-light)" : "var(--muted)",
                                        color: status[key as keyof MemberStatus] ? "var(--accent)" : "var(--muted-fg)",
                                      }}
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* History tab */}
                {activeTab === "history" && (
                  <div>
                      {roundHistory.length === 0 ? (
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>No completed rounds yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                        {roundHistory.map((h) => (
                          <div key={h.round} style={{ background: "var(--bg)", padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <p style={{ fontSize: "var(--text-base)", fontWeight: 500 }}>Round {h.round}</p>
                              <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", fontFamily: "monospace" }}>
                                {h.winner ? shortenAddress(h.winner) : "No winner"}
                              </p>
                            </div>
                            <span className="badge badge-completed">Done</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
