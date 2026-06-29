"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useRouter } from "next/navigation";

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
              letterSpacing: "-0.04em",
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
              lineHeight: "var(--leading-loose)",
            }}
          >
            A smart contract holds the money. Not a person.
            <br />
            Trustless chit funds for your family, friends, and colleagues.
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
              {isConnecting ? "Connecting…" : isConnected ? "Open Dashboard →" : "Start a Fund →"}
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
            <div style={{ color: "var(--destructive)", fontSize: "var(--text-sm)", marginTop: "-1.5rem", marginBottom: "1.5rem" }}>
              {connectionError}
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
              { label: "Open source" },
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

        {/* Orbiting visual — desktop only */}
        <div
          style={{
            ...fadeStyle(0.8),
            position: "absolute",
            right: "4rem",
            top: "50%",
            transform: "translateY(-50%)",
            width: "22rem",
            height: "22rem",
            display: "none",
          }}
          className="hero-visual"
        >
          {[0, "2.5rem", "5rem", "7.5rem"].map((inset, i) => (
            <div key={i} style={{
              position: "absolute",
              inset: typeof inset === "number" ? 0 : inset,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              opacity: 0.5,
            }} />
          ))}
          <div style={{
            position: "absolute", inset: "7.5rem", borderRadius: "50%",
            background: "var(--accent-light)", border: "1px solid rgba(22,163,74,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: "var(--text-xs)", fontFamily: "monospace",
              color: "var(--accent)", fontWeight: 600, letterSpacing: "0.1em",
            }}>
              SECURED
            </span>
          </div>
          <div className="orbit" style={{ position: "absolute", inset: 0 }}>
            <div style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: "8px", height: "8px", borderRadius: "50%", background: "var(--fg)",
            }} />
          </div>
          <div className="orbit-reverse" style={{ position: "absolute", inset: "2.5rem" }}>
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent)",
            }} />
          </div>
        </div>
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
