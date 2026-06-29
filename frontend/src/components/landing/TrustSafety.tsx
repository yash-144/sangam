"use client";

import { useEffect, useRef, useState } from "react";

const pillars = [
  {
    icon: "🔒",
    title: "Smart Contract Escrow",
    desc: "Money is held by code, not a person. No one can withdraw without consensus.",
  },
  {
    icon: "👁",
    title: "Full Transparency",
    desc: "Every transaction is on-chain. Verify the fund's history at any time.",
  },
  {
    icon: "⚡",
    title: "Instant Settlement",
    desc: "Winners receive funds in seconds. No delays, no approvals needed.",
  },
];

const stats = [
  { value: "0%", label: "Organiser risk" },
  { value: "100%", label: "On-chain" },
  { value: "~2s", label: "Settlement" },
];

export default function TrustSafety() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "-80px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="trust" ref={ref} style={{ padding: "var(--space-section) 0" }}>
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
            Why it&apos;s safe
          </p>
          <h2 className="text-heading" style={{ maxWidth: "20ch" }}>
            Protected by mathematics,<br />not trust.
          </h2>
        </div>

        {/* Pillars */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 mb-20"
        >
          {pillars.map((p, i) => (
            <div
              key={p.title}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
              }}
            >
              <div style={{
                width: "2.5rem", height: "2.5rem", borderRadius: "6px",
                border: "1px solid var(--border)", display: "flex",
                alignItems: "center", justifyContent: "center",
                marginBottom: "1.25rem", fontSize: "var(--text-base)",
              }}>
                {p.icon}
              </div>
              <h3 style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                marginBottom: "0.625rem",
                letterSpacing: "var(--tracking-snug)",
              }}>
                {p.title}
              </h3>
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--muted-fg)",
                lineHeight: "var(--leading-normal)",
              }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div
          className="grid-panel grid grid-cols-1 sm:grid-cols-3"
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.6s ease 0.35s",
          }}
        >
          {stats.map((s) => (
            <div key={s.label} style={{ padding: "2.5rem 2rem", textAlign: "center" }}>
              <p style={{
                fontSize: "clamp(var(--text-2xl), 4vw, var(--text-3xl))",
                fontWeight: 700,
                letterSpacing: "var(--tracking-tight)",
                marginBottom: "0.375rem",
              }}>
                {s.value}
              </p>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
