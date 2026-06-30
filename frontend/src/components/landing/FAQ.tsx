"use client";

import { useState } from "react";
import { useInView } from "@/hooks/useInView";

const faqs = [
  {
    q: "What is a chit fund?",
    a: "A chit fund is a group savings scheme where everyone contributes the same amount each month. Each month, one member receives the entire pot — decided by lottery. By the end, everyone has received the pot once.",
  },
  {
    q: "Where is my money?",
    a: "Your money is held in a Soroban smart contract on the Stellar blockchain. No single person — not even us — can move it. Only the contract rules decide when and to whom funds are released.",
  },
  {
    q: "What if someone stops paying?",
    a: "Right now, this is for people who trust each other — family, friends, colleagues. If someone defaults, the group decides how to handle it. V2 will add KYC-linked accountability, and V3 will add collateral bonds to cover defaults automatically.",
  },
  {
    q: "What is USDC?",
    a: "USDC is a digital dollar — 1 USDC = 1 US Dollar, always. It runs on Stellar and is issued by Circle. You can buy it on exchanges like Coinbase or Kraken.",
  },
  {
    q: "Do I need to know about crypto?",
    a: "You need a Stellar wallet — Freighter, Lobstr, xBull, or any WalletConnect-compatible mobile wallet — and some testnet USDC. That's it. The app handles everything else.",
  },
  {
    q: "Is this safe?",
    a: "The smart contract has been written to be deterministic and transparent. All code is open source. That said, this is an early product — start with small amounts and people you know.",
  },
  {
    q: "How is the winner chosen?",
    a: "Using a commit-reveal scheme — each member submits a secret hash, then reveals it. The contract combines all reveals to generate a verifiably random winner. No one can predict or manipulate the outcome.",
  },
];

export default function FAQ() {
  const [ref, visible] = useInView<HTMLElement>();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" ref={ref} style={{ padding: "var(--space-section) 0" }}>
      <div className="container">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
            marginBottom: "4rem",
          }}
        >
          <p className="text-label" style={{ color: "var(--muted-fg)", marginBottom: "1rem" }}>
            FAQ
          </p>
          <h2 className="text-heading">
            Common questions.
          </h2>
        </div>

        <div
          style={{
            maxWidth: "46rem",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.6s ease 0.2s",
          }}
        >
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--border)" }}>
              <button
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%", background: "none", border: "none",
                  padding: "1.375rem 0", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: "1.5rem",
                  textAlign: "left", cursor: "pointer",
                }}
              >
                <span style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 500,
                  lineHeight: "var(--leading-snug)",
                }}>
                  {faq.q}
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    color: "var(--muted-fg)",
                    transition: "transform 0.2s ease",
                    transform: open === i ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </button>
              <div
                id={`faq-panel-${i}`}
                style={{
                  overflow: "hidden",
                  maxHeight: open === i ? "300px" : "0",
                  transition: "max-height 0.3s ease",
                }}
              >
                <p style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--muted-fg)",
                  lineHeight: "var(--leading-normal)",
                  paddingBottom: "1.5rem",
                }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)" }} />
        </div>
      </div>
    </section>
  );
}
