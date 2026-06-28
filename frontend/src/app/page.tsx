"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import {
  getFundSummary,
  getRoundSummary,
  createChitFund,
  joinFund,
  activateFund,
  deposit,
  commitHash,
  revealHash,
  claimPot,
  RoundSummary,
} from "@/lib/contract";
import { usdcToStroops, USDC_CONTRACT_ID } from "@/lib/stellar";

// ─── Helpers ─────────────────────────────────────
function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray, (byte) =>
    ("0" + (byte & 0xff).toString(16)).slice(-2)
  ).join("");
}

function stroopsToDisplay(stroops: any): string {
  if (!stroops) return "0";
  return (Number(stroops) / 10000000).toFixed(0);
}

// ═════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════
export default function Home() {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  // UI state
  const [scrolledAway, setScrolledAway] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);

  const [currentFundId, setCurrentFundId] = useState<number | null>(null);
  const [joinFundId, setJoinFundId] = useState("");
  const [showJoinFlow, setShowJoinFlow] = useState(false);

  // Restore and save currentFundId
  useEffect(() => {
    const saved = localStorage.getItem("cf_current_fund_id");
    if (saved) setCurrentFundId(Number(saved));
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
  const [summary, setSummary] = useState<any>(null);
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"pending" | "deposit" | "commit" | "reveal" | "claim">("deposit");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ─── Scroll transition ───────────────────────────
  useEffect(() => {
    if (isConnected) {
      setScrolledAway(true);
      const timer = setTimeout(() => setDashboardVisible(true), 600);
      return () => clearTimeout(timer);
    } else {
      setDashboardVisible(false);
      setScrolledAway(false);
    }
  }, [isConnected]);

  // ─── Fetch fund data ─────────────────────────────
  const fetchFund = useCallback(async (overrideFundId?: number) => {
    const targetId = overrideFundId !== undefined ? overrideFundId : currentFundId;
    if (!address || targetId === null) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getFundSummary(address, targetId);
      setSummary(data);
      if (data) {
        const currentRound = data.current_round === 0 ? 1 : data.current_round;
        const rData = (await getRoundSummary(address, targetId, currentRound)) || {
          deposit_count: 0,
          commit_count: 0,
          reveal_count: 0,
        };
        setRound(rData);

        // Determine phase
        if (data.state[0] === "Pending") {
          setPhase("pending");
        } else if (rData.deposit_count < data.config.member_count) {
          setPhase("deposit");
        } else if (rData.commit_count < data.config.member_count) {
          setPhase("commit");
        } else if (rData.reveal_count < data.config.member_count) {
          setPhase("reveal");
        } else {
          setPhase("claim");
        }
      }
    } catch (err) {
      console.error("Failed to fetch fund:", err);
    } finally {
      setLoading(false);
    }
  }, [address, currentFundId]);

  useEffect(() => {
    if (isConnected && address) {
      fetchFund();
    }
  }, [isConnected, address, fetchFund, currentFundId]);

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
  async function runAction(fn: () => Promise<any>, errorMsg: string, successMsg?: string) {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      // Small delay to ensure the loading state is rendered
      await new Promise(r => setTimeout(r, 50));
      const res = await fn();
      // Wait a moment for RPC replicas to sync the new state before fetching
      await new Promise(r => setTimeout(r, 1500));
      
      if (typeof res === "number" || typeof res === "bigint") {
        await fetchFund(Number(res));
      } else {
        await fetchFund();
      }
      if (successMsg) {
        setActionSuccess(successMsg);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (e: any) {
      console.error(e);
      setActionError(e.message || errorMsg);
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
    runAction(() => joinFund(address!, currentFundId!), "Failed to join group", "Successfully joined the group!");

  const handleActivateFund = () =>
    runAction(() => activateFund(address!, currentFundId!), "Failed to start group", "Group successfully started!");

  const handleDeposit = () =>
    runAction(
      async () => {
        const res = await deposit(address!, currentFundId!, summary.config.contribution);
        localStorage.setItem(`chitfund_paid_${currentFundId}_${summary.current_round}_${address}`, "true");
        return res;
      },
      "Failed to deposit",
      "Successfully deposited your share!"
    );

  const handleCommit = () =>
    runAction(
      async () => {
        const hashHex = await generateSecretAndHash(address!);
        await commitHash(address!, currentFundId!, hashHex);
        localStorage.setItem(`chitfund_sealed_${currentFundId}_${summary.current_round}_${address}`, "true");
      },
      "Failed to commit",
      "Successfully sealed your draw!"
    );

  const handleReveal = () =>
    runAction(
      async () => {
        const secretHex = localStorage.getItem(`chitfund_secret_${address}`);
        if (!secretHex) throw new Error("No sealed draw found on this device.");
        await revealHash(address!, currentFundId!, secretHex);
        localStorage.setItem(`chitfund_revealed_${currentFundId}_${summary.current_round}_${address}`, "true");
      },
      "Failed to reveal",
      "Successfully revealed your draw!"
    );

  const handleClaim = () =>
    runAction(
      async () => {
        await claimPot(address!, currentFundId!);
        localStorage.setItem(`chitfund_claimed_${currentFundId}_${summary.current_round}_${address}`, "true");
      },
      "Failed to claim pot",
      "Successfully claimed the pot!"
    );

  // ─── Phase helpers ───────────────────────────────
  const phases = ["deposit", "commit", "reveal", "claim"] as const;
  const currentIdx = phase === "pending" ? -1 : phases.indexOf(phase as any);

  function getPhaseClass(p: string) {
    const idx = phases.indexOf(p as any);
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

  const isOrganizer = summary?.config.organizer === address;
  const isMember = summary?.members.includes(address!);

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
                    onClick={() => {
                      if (joinFundId) setCurrentFundId(Number(joinFundId));
                    }}
                    style={{ maxWidth: "480px", marginBottom: "24px" }}
                  >
                    Load Group
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
              <p>Waiting for friends to join.</p>
              
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
                  {actionLoading ? <><span className="spinner" /> Joining…</> : "Join Group"}
                </button>
              )}
              
              {isMember && !isOrganizer && (
                <p style={{ fontSize: '14px', color: 'var(--ink-2)' }}>You have joined. Waiting for the organizer to start.</p>
              )}

              {isMember && isOrganizer && (
                <button 
                  className="action-btn" 
                  onClick={handleActivateFund} 
                  disabled={actionLoading || summary.members.length < summary.config.member_count} 
                  style={{ maxWidth: "480px" }}
                >
                  {actionLoading ? <><span className="spinner" /> Starting…</> : "Start Group"}
                </button>
              )}
            </div>
          )}

          {/* Active Round Dashboard */}
          {!loading && summary && phase !== "pending" && (
            <>
              <div className="phase-bar">
                {phases.map((p, i) => (
                  <div key={p} className={getPhaseClass(p)}>
                    <div className="phase-dot">{i + 1}</div>
                    <div className="phase-label">{phaseLabels[p]}</div>
                  </div>
                ))}
              </div>

              <div className="phase-hero">
                <div className="phase-eyebrow">Current step</div>
                <div className="phase-title">{phaseTitles[phase]}</div>
                <div className="phase-desc">{phaseDescs[phase]}</div>
              </div>

              <div className="dash-body">
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
                    const hasPaid = localStorage.getItem(`chitfund_paid_${currentFundId}_${summary.current_round}_${address}`) === "true";
                    return (
                    <>
                      <div className="action-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                        <span>One tap pays your stake. You get it all back — with the pot — on the round you win.</span>
                      </div>
                      <button className="action-btn" onClick={handleDeposit} disabled={actionLoading || hasPaid}>
                        {actionLoading ? <><span className="spinner" /> Processing…</> : hasPaid ? "Paid" : `Deposit ${stroopsToDisplay(summary.config.contribution)} USDC`}
                      </button>
                    </>
                    );
                  })()}

                  {phase === "commit" && (() => {
                    const hasSealed = localStorage.getItem(`chitfund_sealed_${currentFundId}_${summary.current_round}_${address}`) === "true";
                    return (
                    <>
                      <div className="action-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                        <span>No password to invent. We securely generate and store your sealed draw on this device.</span>
                      </div>
                      <button className="action-btn" onClick={handleCommit} disabled={actionLoading || hasSealed}>
                        {actionLoading ? <><span className="spinner" /> Sealing…</> : hasSealed ? "Sealed" : "Seal my draw"}
                      </button>
                    </>
                    );
                  })()}

                  {phase === "reveal" && (() => {
                    const hasRevealed = localStorage.getItem(`chitfund_revealed_${currentFundId}_${summary.current_round}_${address}`) === "true";
                    return (
                    <>
                      <div className="action-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                        <span><strong>Miss this window and your stake sits the draw out.</strong></span>
                      </div>
                      <button className="action-btn warn" onClick={handleReveal} disabled={actionLoading || hasRevealed}>
                        {actionLoading ? <><span className="spinner" /> Revealing…</> : hasRevealed ? "Revealed" : "Reveal my draw"}
                      </button>
                    </>
                    );
                  })()}

                  {phase === "claim" && (() => {
                    const hasClaimed = localStorage.getItem(`chitfund_claimed_${currentFundId}_${summary.current_round}_${address}`) === "true";
                    return (
                    <>
                      <div className="action-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="var(--ink-3)"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg>
                        <span>The draw is complete. If you won, claim the full pot now.</span>
                      </div>
                      <button className="action-btn" onClick={handleClaim} disabled={actionLoading || hasClaimed}>
                        {actionLoading ? <><span className="spinner" /> Claiming…</> : hasClaimed ? "Claimed" : "Claim pot"}
                      </button>
                    </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
