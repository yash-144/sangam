"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
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
} from "@/lib/contract";
import type { FundSummary, MemberStatus, RoundSummary } from "@/lib/contract";
import { usdcToStroops, USDC_CONTRACT_ID } from "@/lib/stellar";

// ─── Helpers ─────────────────────────────────────
function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray, (byte) =>
    ("0" + (byte & 0xff).toString(16)).slice(-2)
  ).join("");
}

function stroopsToDisplay(stroops: unknown): string {
  if (!stroops) return "0";
  return (Number(stroops) / 10000000).toFixed(0);
}

// ═════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════
const RPC_RETRY_DELAY_MS = 1500;
const WINNER_SYNC_ATTEMPTS = 8;
const LIVE_SYNC_INTERVAL_MS = 5000;

type FetchFundOptions = {
  silent?: boolean;
  waitForMember?: string;
  waitForWinner?: boolean;
};

const emptyRoundSummary = (): RoundSummary => ({
  deposit_count: 0,
  commit_count: 0,
  reveal_count: 0,
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fundStateName(data: Pick<FundSummary, "state"> | null | undefined): string {
  return data?.state?.[0] ?? "Unknown";
}

function hasWinnerForRound(data: Pick<FundSummary, "past_winners"> | null | undefined, round: number): boolean {
  return Boolean(data?.past_winners?.[round - 1]);
}

function sameAddress(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.toUpperCase() === right.toUpperCase());
}

function hasMember(data: Pick<FundSummary, "members"> | null | undefined, member: string | null | undefined) {
  return Boolean(member && data?.members?.some((m) => sameAddress(m, member)));
}

function getSyncedMemberStatus(statuses: Record<string, MemberStatus>, member: string | null | undefined) {
  if (!member) return undefined;
  return Object.entries(statuses).find(([address]) => sameAddress(address, member))?.[1];
}

function remainingText(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function Home() {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  // UI state
  const [scrolledAway, setScrolledAway] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);

  const [currentFundId, setCurrentFundId] = useState<number | null>(null);
  const [joinFundId, setJoinFundId] = useState("");
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("cf_current_fund_id");
      if (saved) setCurrentFundId(Number(saved));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentFundId !== null) {
      localStorage.setItem("cf_current_fund_id", String(currentFundId));
    }
  }, [currentFundId]);

  // Setup form state
  const [createName, setCreateName] = useState("");
  const [createAmount, setCreateAmount] = useState("100");
  const [createMembers, setCreateMembers] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);

  // Fetch local currency
  useEffect(() => {
    async function fetchCurrency() {
      try {
        const geoRes = await fetch("https://ipapi.co/json/");
        const geoData = await geoRes.json();
        const userCurrency = geoData.currency || "USD";
        setCurrency(userCurrency);

        if (userCurrency !== "USD") {
          const rateRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
          const rateData = await rateRes.json();
          if (rateData.rates && rateData.rates[userCurrency]) {
            setExchangeRate(rateData.rates[userCurrency]);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch currency info", e);
      }
    }
    fetchCurrency();
  }, []);

  const funNames = ["Goa Trip Fund", "Diwali Dhamaka Pot", "Royal Enfield Savings", "Biryani Fridays Group", "Future Crorepati Club", "The iPhone Piggybank", "Monsoon Getaway"];
  const suggestName = () => {
    const random = funNames[Math.floor(Math.random() * funNames.length)];
    setCreateName(random);
  };

  // Fund state
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"pending" | "deposit" | "commit" | "reveal" | "claim">("deposit");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Tab + enriched data
  const [activeTab, setActiveTab] = useState<"action" | "members" | "history">("action");
  const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberStatus>>({});
  const [roundHistory, setRoundHistory] = useState<Array<{ round: number; winner: string | null; roundData: RoundSummary | null }>>([]);
  const liveSyncInFlight = useRef(false);


  // ─── Scroll transition ───────────────────────────
  useEffect(() => {
    const scrollTimer = window.setTimeout(() => setScrolledAway(isConnected), 0);
    const dashboardTimer = window.setTimeout(
      () => setDashboardVisible(isConnected),
      isConnected ? 600 : 0
    );

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(dashboardTimer);
    };
  }, [isConnected]);

  // ─── Fetch fund data ─────────────────────────────
  const fetchFund = useCallback(async (overrideFundId?: number, options: FetchFundOptions = {}) => {
    const targetId = overrideFundId !== undefined ? overrideFundId : currentFundId;
    if (!address || targetId === null) {
      if (!options.silent) setLoading(false);
      return;
    }
    try {
      if (!options.silent) setLoading(true);
      let data = (await getFundSummary(address, targetId)) as FundSummary | null;
      if (data) {
        let currentRound = data.current_round === 0 ? 1 : data.current_round;
        let rData = (await getRoundSummary(address, targetId, currentRound)) || emptyRoundSummary();

        for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
          const allRevealsSeen = rData.reveal_count >= data.config.member_count;
          const waitingOnWinner =
            fundStateName(data) === "Active" &&
            (allRevealsSeen || options.waitForWinner) &&
            !hasWinnerForRound(data, currentRound);
          const waitingOnMember = Boolean(options.waitForMember && !hasMember(data, options.waitForMember));

          if (!waitingOnWinner && !waitingOnMember) break;

          await wait(RPC_RETRY_DELAY_MS);
          const refreshed = (await getFundSummary(address, targetId)) as FundSummary | null;
          if (refreshed) {
            data = refreshed;
            currentRound = data.current_round === 0 ? 1 : data.current_round;
          }
          rData = (await getRoundSummary(address, targetId, currentRound)) || emptyRoundSummary();
        }

        setSummary(data);
        setRound(rData);

        // Determine phase
        const stateName = fundStateName(data);
        const winnerReady = hasWinnerForRound(data, currentRound);
        if (stateName === "Pending") {
          setPhase("pending");
        } else if (stateName === "Completed" && winnerReady) {
          setPhase("claim");
        } else if (rData.deposit_count < data.config.member_count) {
          setPhase("deposit");
        } else if (rData.commit_count < data.config.member_count) {
          setPhase("commit");
        } else if (rData.reveal_count < data.config.member_count || !winnerReady) {
          setPhase("reveal");
        } else {
          setPhase("claim");
        }

        // Fan-out: fetch member statuses for current round (parallel)
        if (stateName !== "Pending") {
          const statusEntries = await Promise.all(
            data.members.map(async (member: string) => {
              const status = await getMemberStatus(address, targetId, member, currentRound);
              return [member, status] as [string, MemberStatus];
            })
          );
          setMemberStatuses(Object.fromEntries(statusEntries));
        }

        // Fan-out: fetch round history for all completed rounds (parallel)
        if (currentRound > 1 || stateName === "Completed") {
          const completedRounds = Array.from(
            { length: stateName === "Completed" ? currentRound : currentRound - 1 },
            (_, i) => i + 1
          );
          const winners = data.past_winners;
          const historyEntries = await Promise.all(
            completedRounds.map(async (r) => {
              const rd = await getRoundSummary(address, targetId, r).catch(() => null);
              const winner = winners[r - 1] ?? null;
              return { round: r, winner, roundData: rd };
            })
          );
          setRoundHistory(historyEntries);
        } else {
          setRoundHistory([]);
        }
      } else {
        setSummary(null);
        setRound(null);
        setRoundHistory([]);
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
      void fetchFund();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isConnected, address, fetchFund, currentFundId]);

  useEffect(() => {
    if (!isConnected || !address || currentFundId === null || actionLoading) return;

    const sync = async () => {
      if (liveSyncInFlight.current) return;
      liveSyncInFlight.current = true;
      try {
        await fetchFund(undefined, { silent: true });
      } finally {
        liveSyncInFlight.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void sync();
    }, LIVE_SYNC_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isConnected, address, currentFundId, actionLoading, fetchFund]);

  // ─── Secret/Hash generation ──────────────────────
  async function generateSecretAndHash(addr: string) {
    const secretBytes = new Uint8Array(32);
    window.crypto.getRandomValues(secretBytes);
    const secretHex = toHexString(secretBytes);
    localStorage.setItem(`chitfund_secret_${addr}`, secretHex);
    const hashBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
    return toHexString(new Uint8Array(hashBuffer));
  }

  // ─── Actions ─────────────────────────────────────
  function parseContractError(raw: string): string {
    if (raw.includes("deposit phase not complete")) return "Not everyone has paid their share yet. Please wait for all members to deposit.";
    if (raw.includes("already joined")) return "You have already joined this circle.";
    if (raw.includes("slots are full")) return "This circle is already full.";
    if (raw.includes("fund state is not Pending")) return "This circle is no longer accepting new members.";
    if (raw.includes("only organizer can activate")) return "Only the organizer can start the fund.";
    if (raw.includes("slots are not full")) return "Waiting for all members to join before starting.";
    if (raw.includes("already committed") || raw.includes("commitment.is_some")) return "You have already sealed your draw for this round.";
    if (raw.includes("already deposited") || raw.includes("has_deposited")) return "You have already paid your share this round.";
    if (raw.includes("reveal phase not complete")) return "Not everyone has revealed their draw yet.";
    if (raw.includes("Simulation failed")) return raw;
    return raw;
  }

  function requireSummary(): FundSummary {
    if (!summary) {
      throw new Error("Fund data is still loading. Please try again.");
    }
    return summary;
  }

  async function runAction(fn: () => Promise<unknown>, errorMsg: string, successMsg?: string) {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      // Small delay to ensure the loading state is rendered
      await wait(50);
      const res = await fn();
      // Wait for RPC replicas to sync the new ledger state before re-fetching
      await wait(3000);
      
      const nextFundId = typeof res === "number" || typeof res === "bigint" ? Number(res) : undefined;
      const waitForWinner =
        typeof res === "object" &&
        res !== null &&
        "waitForWinner" in res &&
        Boolean(res.waitForWinner);
      const waitForMember =
        typeof res === "object" &&
        res !== null &&
        "waitForMember" in res &&
        typeof res.waitForMember === "string"
          ? res.waitForMember
          : undefined;

      await fetchFund(nextFundId, { waitForMember, waitForWinner });
      if (successMsg) {
        setActionSuccess(successMsg);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : errorMsg;
      setActionError(parseContractError(message));
    } finally {
      setActionLoading(false);
    }
  }

  const handleCreateFund = () => {
    if (!createName || !createAmount || !createMembers) {
      setActionError("Please fill out all fields");
      return;
    }

    const amount = Number(createAmount);
    const members = Number(createMembers);

    if (amount <= 0) {
      setActionError("Amount must be greater than 0");
      return;
    }

    if (members < 2 || members > 10) {
      setActionError("Members must be between 2 and 10");
      return;
    }

    if (!USDC_CONTRACT_ID) {
      setActionError("USDC Contract ID is missing from configuration");
      return;
    }

    runAction(
      async () => {
        const newFundId = await createChitFund(
          address!,
          USDC_CONTRACT_ID,
          createName,
          usdcToStroops(createAmount),
          members
        );
        setCurrentFundId(newFundId);
        return newFundId;
      },
      "Failed to create group"
    );
  };

  const handleJoinFund = () =>
    runAction(
      async () => {
        await joinFund(address!, currentFundId!);
        return { waitForMember: address! };
      },
      "Failed to join group",
      "Successfully joined the group!"
    );

  const handleActivateFund = () =>
    runAction(() => activateFund(address!, currentFundId!), "Failed to start group", "Group successfully started!");

  const handleDeposit = () =>
    runAction(
      async () => {
        const fund = requireSummary();
        const res = await deposit(address!, currentFundId!, fund.config.contribution);
        localStorage.setItem(`chitfund_paid_${currentFundId}_${fund.current_round}_${address}`, "true");
        return res;
      },
      "Failed to deposit",
      "Successfully deposited your share!"
    );

  const handleCommit = () =>
    runAction(
      async () => {
        const fund = requireSummary();
        const hashHex = await generateSecretAndHash(address!);
        await commitHash(address!, currentFundId!, hashHex);
        localStorage.setItem(`chitfund_sealed_${currentFundId}_${fund.current_round}_${address}`, "true");
      },
      "Failed to commit",
      "Successfully sealed your draw!"
    );

  const handleReveal = () =>
    runAction(
      async () => {
        const fund = requireSummary();
        const secretHex = localStorage.getItem(`chitfund_secret_${address}`);
        if (!secretHex) throw new Error("No sealed draw found on this device.");
        const revealWillPickWinner = (round?.reveal_count ?? 0) >= fund.config.member_count - 1;
        await revealHash(address!, currentFundId!, secretHex);
        localStorage.setItem(`chitfund_revealed_${currentFundId}_${fund.current_round}_${address}`, "true");
        return { waitForWinner: revealWillPickWinner };
      },
      "Failed to reveal",
      "Successfully revealed your draw!"
    );

  const handleClaim = () =>
    runAction(
      async () => {
        const fund = requireSummary();
        await claimPot(address!, currentFundId!);
        localStorage.setItem(`chitfund_claimed_${currentFundId}_${fund.current_round}_${address}`, "true");
      },
      "Failed to claim pot",
      "Successfully claimed the pot!"
    );

  // ─── Phase helpers ───────────────────────────────
  const phases = ["deposit", "commit", "reveal", "claim"] as const;
  const currentIdx = phase === "pending" ? -1 : phases.indexOf(phase);

  function getPhaseClass(p: (typeof phases)[number]) {
    const idx = phases.indexOf(p);
    if (idx < currentIdx) return "phase-node done";
    if (idx === currentIdx) return "phase-node active";
    return "phase-node";
  }

  const phaseLabels = {
    deposit: "Pay Share",
    commit: "Pick Winner",
    reveal: "Verify",
    claim: "Get Pot",
  };
  const phaseTitles = {
    deposit: "Pay your monthly share",
    commit: "Pick a secret number",
    reveal: "Verify your number",
    claim: "Take the pot",
  };
  const phaseDescs = {
    deposit: `Pay ${summary ? stroopsToDisplay(summary.config.contribution) : "—"} USDC into the group. Everyone does the same.`,
    commit: "Your device will securely generate a secret number for the random draw. No passwords to remember.",
    reveal: "Reveal your secret number to complete the draw. If you miss this, you can't win this round.",
    claim: "The draw is complete. If you are the lucky winner, claim the full pot!",
  };

  const shortAddr = address
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : "";

  const isOrganizer = sameAddress(summary?.config.organizer, address);
  const isMember = hasMember(summary, address);
  const pendingSpots = summary
    ? Math.max(summary.config.member_count - summary.members.length, 0)
    : 0;

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="app-root">
      {/* ════════ LANDING PAGE ════════ */}
      <div className={`landing ${scrolledAway ? "scroll-away" : ""}`}>
        <div className="landing-inner">
          <nav className="landing-nav">
            <div className="landing-logo">Chit</div>
            <div className="landing-nav-badge">Stellar Testnet</div>
          </nav>
          <div className="landing-hero">
            <h1>Save together.<br />Win <em>together</em>.</h1>
            <p className="subtitle">
              A group savings pool where friends chip in monthly and one person
              takes the full pot each round. No banks. No middlemen. Just trust
              baked into code.
            </p>
          </div>
          <div className="steps">
            <div className="steps-label">How it works</div>
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-body">
                <h3>Everyone chips in</h3>
                <p>Each member deposits the same amount every round. Your money stays on-chain — visible, safe, yours.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-body">
                <h3>Sealed draw</h3>
                <p>Each member submits a hidden number. No one — not even the app — can predict the outcome.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-body">
                <h3>One person takes the pot</h3>
                <p>All numbers combine into a single random result. One member gets the full pool. Fair, verifiable, instant.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">04</div>
              <div className="step-body">
                <h3>Repeat until everyone wins</h3>
                <p>The cycle runs until every member has won exactly once. Everyone saves. Everyone wins. It just takes turns.</p>
              </div>
            </div>
          </div>
          <div className="trust-line">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Built on Stellar · Open source · No middleman
            </span>
          </div>
          <div className="landing-cta">
            <button className="cta-btn" onClick={connect} disabled={isConnecting}>
              {isConnecting ? <><span className="spinner" /> Connecting…</> : "Enter the App →"}
            </button>
            <p className="cta-sub">Connect your Stellar wallet to begin</p>
          </div>
        </div>
      </div>

      {/* ════════ DASHBOARD ════════ */}
      <div className={`dashboard-wrap ${dashboardVisible ? "visible" : ""}`}>
        <div className="dash">
          <div className="dash-top">
            <div className="dash-title">
              {summary ? summary.config.name : "Chit"}
              {summary && phase !== "pending" && (
                <span style={{ fontFamily: "var(--f-ui)", fontSize: "13px", fontWeight: 450, color: "var(--ink-3)", marginLeft: "8px" }}>
                  Round {summary.current_round} of {summary.config.member_count}
                </span>
              )}
            </div>
            <div className="dash-addr" onClick={disconnect} title="Click to disconnect">
              {shortAddr}
            </div>
          </div>

          {loading && (
            <div className="loading-state">
              <span className="spinner" /> Loading circle…
            </div>
          )}

          {/* Setup State */}
          {!loading && !summary && (
            <div className="empty-state">
              {!showJoinFlow ? (
                <>
                  <h2>Start a Chit Fund</h2>
                  <p>Setup a new group savings pool for you and your friends.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '480px', marginBottom: '24px', textAlign: 'left' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)' }}>Group Name</label>
                        <button onClick={suggestName} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Surprise me ✨</button>
                      </div>
                      <input 
                        type="text" 
                        value={createName} onChange={e => setCreateName(e.target.value)}
                        placeholder="e.g. Dream Fund"
                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)' }}>Amount Each Member Pays per round</label>
                      </div>
                      
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input 
                          type="number" 
                          value={createAmount} onChange={e => setCreateAmount(e.target.value)}
                          placeholder="100"
                          style={{ width: '100%', padding: '12px', paddingRight: '60px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                        />
                        <div style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--ink-3)', fontSize: '14px', pointerEvents: 'none' }}>USDC</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                         <input 
                           type="range" 
                           min="10" max="1000" step="10"
                           value={createAmount || 0} 
                           onChange={(e) => setCreateAmount(e.target.value)}
                           style={{ flex: 1, accentColor: 'var(--accent)' }}
                         />
                         <div style={{ fontSize: '12px', color: 'var(--ink-3)', width: '120px', textAlign: 'right', minHeight: '16px' }}>
                           {Number(createAmount) > 0 && currency !== "USD" ? `≈ ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(Number(createAmount) * exchangeRate)}` : ""}
                         </div>
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)', marginBottom: '4px', display: 'block' }}>Total Members</label>
                      <input 
                        type="number" 
                        value={createMembers} onChange={e => setCreateMembers(e.target.value)}
                        placeholder="5"
                        style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                      />
                    </div>
                    
                    <div style={{ minHeight: '76px' }}>
                      {Number(createAmount) > 0 && Number(createMembers) >= 2 && (
                        <div style={{ padding: '16px', background: 'var(--accent-light)', borderRadius: '6px' }}>
                          <p style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500, margin: 0 }}>
                            The total pot each round will be <strong>{(Number(createAmount) * Number(createMembers)).toLocaleString()} USDC</strong>
                            {currency !== "USD" && <span> (≈ {new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(Number(createAmount) * Number(createMembers) * exchangeRate)})</span>}.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="action-btn"
                    onClick={handleCreateFund}
                    disabled={actionLoading}
                    style={{ maxWidth: "480px", marginBottom: "24px" }}
                  >
                    {actionLoading ? <><span className="spinner" /> Setting up…</> : "Create Group"}
                  </button>

                  <p style={{ fontSize: "14px", color: "var(--ink-3)" }}>
                    Already have a Group ID? <a href="#" onClick={(e) => { e.preventDefault(); setShowJoinFlow(true); }} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Join existing</a>
                  </p>
                </>
              ) : (
                <>
                  <h2>Join Existing Group</h2>
                  <p>Enter the ID provided by your group organizer.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '480px', marginBottom: '24px', textAlign: 'left' }}>
                    <input
                      type="number"
                      placeholder="e.g. 1"
                      value={joinFundId}
                      onChange={(e) => setJoinFundId(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                  </div>

                  <button 
                    className="action-btn" 
                    onClick={async () => {
                      const id = Number(joinFundId);
                      if (!id) return;
                      setCurrentFundId(id);
                      await fetchFund(id);
                    }}
                    disabled={actionLoading}
                    style={{ maxWidth: "480px", marginBottom: "24px" }}
                  >
                    {actionLoading ? <><span className="spinner" /> Loading…</> : "Load Circle"}
                  </button>

                  <p style={{ fontSize: "14px", color: "var(--ink-3)" }}>
                    Want to start your own? <a href="#" onClick={(e) => { e.preventDefault(); setShowJoinFlow(false); }} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Create group</a>
                  </p>
                </>
              )}
              
              {actionError && (
                <p style={{ color: "var(--danger)", fontSize: "13px", marginTop: "12px" }}>
                  {actionError}
                </p>
              )}
            </div>
          )}

          {/* Pending State */}
          {!loading && summary && phase === "pending" && (
              <div className="empty-state">
              <h2>{summary.config.name}</h2>
              <p>{pendingSpots > 0 ? `Waiting for ${remainingText(pendingSpots, "friend")} to join.` : "Everyone has joined."}</p>
              
              <div style={{ background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--accent)', marginBottom: '24px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--ink-2)' }}>Share this Group ID with others to join:</p>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)', letterSpacing: '2px' }}>{currentFundId}</div>
              </div>
              
              <div className="info-card" style={{ maxWidth: '480px', width: '100%', margin: '0 auto 32px' }}>
                <div className="info-card-label">Joined</div>
                <div className="info-card-value">
                  {summary.members.length} <span className="unit">/ {summary.config.member_count}</span>
                </div>
              </div>

              {actionError && (
                <p style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px" }}>
                  {actionError}
                </p>
              )}
              {actionSuccess && (
                <div style={{ padding: "12px", background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: "8px", marginBottom: "16px", border: "1px solid rgba(34,197,94,0.2)" }}>
                  {actionSuccess}
                </div>
              )}

              {!isMember && (
                <button className="action-btn" onClick={handleJoinFund} disabled={actionLoading} style={{ maxWidth: "480px" }}>
                  {actionLoading ? <><span className="spinner" /> Joining…</> : "Join Circle"}
                </button>
              )}
              
              {isMember && !isOrganizer && (
                <p style={{ fontSize: '14px', color: 'var(--ink-2)' }}>
                  {pendingSpots > 0
                    ? `You have joined. Waiting for ${remainingText(pendingSpots, "more member")}.`
                    : "Everyone has joined. Waiting for the organizer to start."}
                </p>
              )}

              {isMember && isOrganizer && (
                <>
                {pendingSpots > 0 && (
                  <p style={{ fontSize: '14px', color: 'var(--ink-2)', marginBottom: '12px' }}>
                    Waiting for {remainingText(pendingSpots, "more member")} before you can start.
                  </p>
                )}
                <button 
                  className="action-btn" 
                  onClick={handleActivateFund} 
                  disabled={actionLoading || summary.members.length < summary.config.member_count} 
                  style={{ maxWidth: "480px" }}
                >
                  {actionLoading ? <><span className="spinner" /> Starting…</> : "Start Group"}
                </button>
                </>
              )}
            </div>
          )}

          {/* Active Round Dashboard */}
          {!loading && summary && phase !== "pending" && (
            <>
              {/* Phase progress bar */}
              <div className="phase-bar">
                {phases.map((p, i) => (
                  <div key={p} className={getPhaseClass(p)}>
                    <div className="phase-dot">{i + 1}</div>
                    <div className="phase-label">{phaseLabels[p]}</div>
                  </div>
                ))}
              </div>

              {/* Tab navigation */}
              <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--bg)', borderRadius: '10px', margin: '16px 0', border: '1px solid var(--line)' }}>
                {(['action', 'members', 'history'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600, fontFamily: 'var(--f-ui)',
                      background: activeTab === tab ? 'var(--surface)' : 'transparent',
                      color: activeTab === tab ? 'var(--ink)' : 'var(--ink-3)',
                      boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                      transition: 'all 0.15s ease',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab === 'action' ? 'Action' : tab === 'members' ? `Members (${summary.members.length})` : 'History'}
                  </button>
                ))}
              </div>

              {/* ── TAB: ACTION ── */}
              {activeTab === 'action' && (
                <div className="dash-body">
                  <div className="phase-hero" style={{ paddingTop: 0 }}>
                    <div className="phase-eyebrow">Current step</div>
                    <div className="phase-title">{phaseTitles[phase]}</div>
                    <div className="phase-desc">{phaseDescs[phase]}</div>
                  </div>

                  <div className="info-card">
                    <div className="info-card-label">This round&apos;s pot</div>
                    <div className="info-card-value">
                      {stroopsToDisplay(summary.config.contribution * BigInt(summary.config.member_count))}
                      <span className="unit">USDC</span>
                    </div>
                    <div className="info-grid">
                      <div className="info-grid-item">
                        <div className="val">{stroopsToDisplay(summary.config.contribution)}</div>
                        <div className="lbl">Your stake</div>
                      </div>
                      <div className="info-grid-item">
                        <div className="val">{summary.config.member_count}</div>
                        <div className="lbl">Members</div>
                      </div>
                      <div className="info-grid-item">
                        <div className="val">{round?.deposit_count || 0} / {summary.config.member_count}</div>
                        <div className="lbl">Paid in</div>
                      </div>
                    </div>
                  </div>

                  <div className="action-area">
                    {actionError && <p style={{ color: "var(--danger)", fontSize: "13px", marginBottom: "12px" }}>{actionError}</p>}
                    {actionSuccess && (
                      <div style={{ padding: "12px", background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: "8px", marginBottom: "16px", border: "1px solid rgba(34,197,94,0.2)" }}>
                        {actionSuccess}
                      </div>
                    )}

                    {phase === "deposit" && (() => {
                      const hasPaid = getSyncedMemberStatus(memberStatuses, address)?.has_deposited ?? false;
                      const paidCount = round?.deposit_count ?? 0;
                      const remaining = Math.max(summary.config.member_count - paidCount, 0);
                      return (
                      <>
                        <div className="action-hint">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                          <span>One tap pays your stake. You get it all back — with the pot — on the round you win.</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '-4px 0 12px' }}>
                          {hasPaid
                            ? remaining > 0
                              ? `You've paid. Waiting for ${remainingText(remaining, "more member")} to deposit.`
                              : "You've paid. Everyone is paid, syncing the next step."
                            : `${paidCount}/${summary.config.member_count} members have paid so far.`}
                        </p>
                        <button className="action-btn" onClick={handleDeposit} disabled={actionLoading || hasPaid}>
                          {actionLoading ? <><span className="spinner" /> Processing…</> : hasPaid ? "Paid ✓" : `Deposit ${stroopsToDisplay(summary.config.contribution)} USDC`}
                        </button>
                      </>
                      );
                    })()}

                    {phase === "commit" && (() => {
                      const hasSealed = getSyncedMemberStatus(memberStatuses, address)?.has_committed ?? false;
                      const sealedCount = round?.commit_count ?? 0;
                      const remaining = Math.max(summary.config.member_count - sealedCount, 0);
                      return (
                      <>
                        <div className="action-hint">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                          <span>No password to invent. We securely generate and store your sealed draw on this device.</span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '-4px 0 12px' }}>
                          {hasSealed
                            ? remaining > 0
                              ? `You've sealed your draw. Waiting for ${remainingText(remaining, "more member")} to seal theirs.`
                              : "You've sealed your draw. Everyone is sealed, syncing verification."
                            : `${sealedCount}/${summary.config.member_count} members have sealed so far.`}
                        </p>
                        <button className="action-btn" onClick={handleCommit} disabled={actionLoading || hasSealed}>
                          {actionLoading ? <><span className="spinner" /> Sealing…</> : hasSealed ? "Sealed ✓" : "Seal my draw"}
                        </button>
                      </>
                      );
                    })()}

                    {phase === "reveal" && (() => {
                      const hasRevealed = getSyncedMemberStatus(memberStatuses, address)?.has_revealed ?? false;
                      const revealedCount = round?.reveal_count ?? 0;
                      const remaining = Math.max(summary.config.member_count - revealedCount, 0);
                      return (
                      <>
                        <div className="action-hint">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                          <span><strong>Miss this window and your stake sits the draw out.</strong></span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '-4px 0 12px' }}>
                          {hasRevealed
                            ? remaining > 0
                              ? `You've revealed. Waiting for ${remainingText(remaining, "more member")} to reveal.`
                              : "All reveals are in. Finalizing the winner."
                            : `${revealedCount}/${summary.config.member_count} members have revealed so far.`}
                        </p>
                        <button className="action-btn warn" onClick={handleReveal} disabled={actionLoading || hasRevealed}>
                          {actionLoading ? <><span className="spinner" /> Revealing…</> : hasRevealed ? "Revealed ✓" : "Reveal my draw"}
                        </button>
                      </>
                      );
                    })()}

                    {phase === "claim" && (() => {
                      const winner = summary.past_winners[summary.current_round - 1] ?? null;
                      const isCompleted = fundStateName(summary) === "Completed";
                      const isWinner = sameAddress(winner, address);
                      const shortWinner = winner ? `${winner.slice(0, 6)}…${winner.slice(-6)}` : null;
                      return (
                      <>
                        <div style={{ textAlign: 'center', padding: '24px 16px', background: isWinner ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))' : 'var(--bg)', borderRadius: '12px', border: `1px solid ${isWinner ? 'rgba(251,191,36,0.4)' : 'var(--line)'}`, marginBottom: '20px' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{isWinner ? '🎉' : '🏆'}</div>
                          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Round winner</div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: isWinner ? '#fbbf24' : 'var(--ink)', wordBreak: 'break-all' }}>
                            {!winner ? 'Finalizing draw...' : isWinner ? 'You won this round! 🎊' : shortWinner}
                          </div>
                          {winner && !isWinner && <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px' }}>{isCompleted ? 'This savings circle is complete.' : 'Better luck next round!'}</div>}
                        </div>
                        {isWinner && !isCompleted && (
                          <button className="action-btn" onClick={handleClaim} disabled={actionLoading}>
                            {actionLoading ? <><span className="spinner" /> Claiming…</> : 'Claim Pot →'}
                          </button>
                        )}
                        {isWinner && isCompleted && (
                          <div className="action-hint">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                            <span>This savings circle is complete.</span>
                          </div>
                        )}
                        {!isWinner && (
                          <div className="action-hint">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                            <span>{winner ? (isCompleted ? 'This savings circle is complete.' : 'The winner will claim the pot. The next round starts automatically after the pot is claimed.') : 'Waiting for the network to confirm the winner.'}</span>
                          </div>
                        )}
                      </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── TAB: MEMBERS ── */}
              {activeTab === 'members' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {summary.members.map((member: string) => {
                    const isOrg = sameAddress(member, summary.config.organizer);
                    const isCurrentUser = sameAddress(member, address);
                    const status = getSyncedMemberStatus(memberStatuses, member);
                    const isPastWinner = summary.past_winners.some((winner) => sameAddress(winner, member));
                    const shortM = `${member.slice(0, 6)}…${member.slice(-6)}`;
                    const pill = (label: string, active: boolean) => (
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600, background: active ? 'rgba(34,197,94,0.15)' : 'var(--line)', color: active ? '#22c55e' : 'var(--ink-3)' }}>
                        {label}{active ? ' ✓' : ''}
                      </span>
                    );
                    return (
                      <div key={member} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isCurrentUser ? 'var(--accent)' : 'var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: isCurrentUser ? '#fff' : 'var(--ink-3)', flexShrink: 0 }}>
                          {member.slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace' }}>{shortM}</span>
                            {isCurrentUser && <span style={{ fontSize: '10px', background: 'var(--accent)', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>You</span>}
                            {isOrg && <span style={{ fontSize: '10px', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>Organizer</span>}
                            {isPastWinner && <span style={{ fontSize: '10px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>🏆 Won</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {pill('Paid', status?.has_deposited ?? false)}
                            {pill('Sealed', status?.has_committed ?? false)}
                            {pill('Revealed', status?.has_revealed ?? false)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── TAB: HISTORY ── */}
              {activeTab === 'history' && (
                <div style={{ marginTop: '8px' }}>
                  {roundHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-3)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No completed rounds yet</div>
                      <div style={{ fontSize: '13px', marginTop: '4px' }}>History will appear here after the first round is claimed.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {[...roundHistory].reverse().map(({ round: r, winner, roundData }) => {
                        const shortWinner = winner ? `${winner.slice(0, 6)}…${winner.slice(-6)}` : 'Finalizing...';
                        const isYouWinner = sameAddress(winner, address);
                        return (
                          <div key={r} style={{ padding: '16px', background: 'var(--bg)', borderRadius: '10px', border: `1px solid ${isYouWinner ? 'rgba(251,191,36,0.3)' : 'var(--line)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Round {r}</div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)' }}>
                                {stroopsToDisplay(summary.config.contribution * BigInt(summary.config.member_count))} USDC pot
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                              <span style={{ fontSize: '18px' }}>{isYouWinner ? '🎉' : '🏆'}</span>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--ink-3)', marginBottom: '2px' }}>Winner</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: isYouWinner ? '#fbbf24' : 'var(--ink)', fontFamily: 'monospace' }}>
                                  {isYouWinner ? 'You!' : shortWinner}
                                </div>
                              </div>
                            </div>
                            {roundData && (
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[
                                  { label: 'Paid', val: roundData.deposit_count, total: summary.config.member_count },
                                  { label: 'Sealed', val: roundData.commit_count, total: summary.config.member_count },
                                  { label: 'Revealed', val: roundData.reveal_count, total: summary.config.member_count },
                                ].map(({ label, val, total }) => (
                                  <div key={label} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--ink-2)', fontWeight: 600 }}>
                                    {label} {val}/{total}
                                  </div>
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
            </>
          )}

        </div>
      </div>
    </div>
  );
}
