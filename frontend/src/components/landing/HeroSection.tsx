"use client";

import { useEffect, useState, useRef } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRouter } from "next/navigation";

const MEMBER_COUNT = 6;
const RADIUS = 100;
const CENTER = 140;

function ChitFundVisual({ fadeStyle }: { fadeStyle: (delay: number) => React.CSSProperties }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [wonSet, setWonSet] = useState<Set<number>>(new Set());
  const frame = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      frame.current = (frame.current + 1) % (MEMBER_COUNT * 2);
      const step = frame.current;
      if (step % 2 === 0) {
        const next = (step / 2) % MEMBER_COUNT;
        setActiveIdx(next);
        setWonSet((prev) => new Set([...prev, next]));
        if (next === 0) setWonSet(new Set([0]));
      }
    }, 900);
    return () => clearInterval(id);
  }, []);

  const size = CENTER * 2;

  return (
    <div
      style={{
        ...fadeStyle(0.8),
        position: "absolute",
        right: "4rem",
        top: "50%",
        transform: "translateY(-50%)",
        width: `${size}px`,
        height: `${size}px`,
        display: "none",
      }}
      className="hero-visual"
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: MEMBER_COUNT }).map((_, i) => {
          const angle = (i / MEMBER_COUNT) * Math.PI * 2 - Math.PI / 2;
          const x = CENTER + RADIUS * Math.cos(angle);
          const y = CENTER + RADIUS * Math.sin(angle);
          const isActive = i === activeIdx;
          const hasWon = wonSet.has(i);
          return (
            <g key={i}>
              <line
                x1={CENTER} y1={CENTER} x2={x} y2={y}
                stroke={isActive ? "var(--accent)" : "var(--border)"}
                strokeWidth={isActive ? 1.5 : 1}
                opacity={isActive ? 0.6 : 0.3}
              />
              <circle
                cx={x} cy={y} r={isActive ? 12 : 9}
                fill={isActive ? "var(--accent)" : hasWon ? "var(--accent-light)" : "var(--muted)"}
                stroke={isActive ? "var(--accent)" : hasWon ? "rgba(22,163,74,0.3)" : "var(--border)"}
                strokeWidth={1.5}
                style={{ transition: "all 0.4s ease" }}
              />
              {isActive && (
                <circle cx={x} cy={y} r={20} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.3}>
                  <animate attributeName="r" from="12" to="24" dur="0.9s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.4" to="0" dur="0.9s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r={28} fill="var(--accent-light)" stroke="rgba(22,163,74,0.2)" strokeWidth={1.5} />
        <text x={CENTER} y={CENTER - 5} textAnchor="middle" fontSize={8} fontWeight={600} fill="var(--accent)" fontFamily="var(--font-mono)" letterSpacing={1}>POT</text>
        <text x={CENTER} y={CENTER + 8} textAnchor="middle" fontSize={7} fill="var(--accent)" fontFamily="var(--font-mono)" opacity={0.7}>USDC</text>
      </svg>
    </div>
  );
}

export default function HeroSection() {
  const { isConnected, isConnecting, connect, connectionError } = useWallet();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleCTA = async () => {
    if (isConnected) {
      router.push("/dashboard");
    } else {
      await connect();
    }
  };

  const fadeStyle = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
  });

  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle grid */}
      <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.35 }} />
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "60vh",
        background: "linear-gradient(to bottom, var(--bg), transparent)",
      }} />

      <div className="container" style={{ position: "relative", zIndex: 10, paddingTop: "6rem", paddingBottom: "6rem" }}>
        <div style={{ maxWidth: "52rem" }}>

          {/* Tag */}
          <div style={fadeStyle(0.1)}>
            <span style={{
              fontSize: "var(--text-xs)",
              fontWeight: 500,
              color: "var(--muted-fg)",
              border: "1px solid var(--border)",
              padding: "0.3rem 0.875rem",
              borderRadius: "4px",
              display: "inline-block",
              marginBottom: "2rem",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
            }}>
              On-chain chit fund · Stellar · USDC
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              ...fadeStyle(0.2),
              fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
              fontWeight: 700,
              letterSpacing: "-0.05em",
              lineHeight: 1.05,
              marginBottom: "1.5rem",
            }}
          >
            No one can run away
            <br />
            with your{" "}
            <span className="gradient-text">money.</span>
          </h1>

          {/* Sub */}
          <p
            style={{
              ...fadeStyle(0.35),
              fontSize: "clamp(var(--text-base), 2vw, var(--text-md))",
              color: "var(--muted-fg)",
              maxWidth: "40ch",
              marginBottom: "3rem",
              lineHeight: "var(--leading-normal)",
            }}
          >
            A smart contract holds the money. Not a person.
            <br />
            Pool, draw, payout. Until everyone has won.
          </p>

          {/* CTAs */}
          <div
            className="hero-ctas"
            style={fadeStyle(0.5)}
          >
            <button
              onClick={handleCTA}
              disabled={isConnecting}
              className="btn btn-primary btn-lg hero-btn"
            >
              {isConnecting ? "Opening wallet…" : isConnected ? "Open dashboard →" : "Start a fund →"}
            </button>
            <button
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="btn btn-ghost hero-btn"
              style={{ fontSize: "var(--text-base)" }}
            >
              See how it works
            </button>
          </div>

          {/* Connection Error */}
          {connectionError && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              padding: "0.75rem 1rem",
              marginTop: "-1rem",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              fontSize: "var(--text-sm)",
              color: "#dc2626",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                <circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/>
                <path d="M8 5v3M8 10.5v.5" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ lineHeight: "var(--leading-normal)" }}>{connectionError}</span>
            </div>
          )}

          {/* Trust badges */}
          <div
            className="trust-badges"
            style={fadeStyle(0.7)}
          >
            {[
              { label: "Smart contract escrow" },
              { label: "USDC stablecoin" },
              { label: "Testnet" },
            ].map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--accent)", flexShrink: 0,
                }} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chit fund circle visual — desktop only */}
        <ChitFundVisual fadeStyle={fadeStyle} />
      </div>

      <style>{`
        .hero-ctas {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 3rem;
        }
        .hero-btn {
          width: 100%;
          justify-content: center;
        }
        .trust-badges {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1rem;
        }
        
        @media (min-width: 640px) {
          .hero-ctas {
            flex-direction: row;
            align-items: center;
          }
          .hero-btn {
            width: auto;
          }
          .trust-badges {
            gap: 2rem;
          }
        }

        @media (min-width: 1024px) {
          .hero-visual { display: block !important; }
        }
      `}</style>
    </section>
  );
}
