"use client";

import { useInView } from "@/hooks/useInView";

const tiers = [
  {
    tag: "MVP",
    label: "Live",
    title: "Known Groups",
    desc: "For people who already know each other. Social trust + smart contract.",
    features: ["Up to 10 members", "USDC contributions", "On-chain lottery", "No organiser risk"],
    active: true,
  },
  {
    tag: "V2",
    label: "Coming",
    title: "KYC Verified",
    desc: "Identity-linked accountability for semi-strangers.",
    features: ["National ID verification", "Reputation scores", "Larger groups", "Legal recourse"],
    active: false,
  },
  {
    tag: "V3",
    label: "Future",
    title: "Collateral Bond",
    desc: "Self-enforcing. Collateral covers missed deposits automatically.",
    features: ["Bond at join time", "Auto-cover defaults", "Open public funds", "Zero default risk"],
    active: false,
  },
];

export default function Roadmap() {
  const [ref, visible] = useInView<HTMLElement>();

  return (
    <section id="roadmap" ref={ref} style={{ padding: "var(--space-section) 0" }}>
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
            Roadmap
          </p>
          <h2 className="text-heading">
            Trust levels, unlocked<br />progressively.
          </h2>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[var(--border)] rounded-md overflow-hidden"
        >
          {tiers.map((tier, i) => (
            <div
              key={tier.tag}
              style={{
                background: "var(--bg)",
                padding: "2.25rem 2rem",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
              }}
            >
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: "1.5rem",
              }}>
                <span style={{
                  fontSize: "var(--text-xs)", fontWeight: 600,
                  color: "var(--muted-fg)", letterSpacing: "var(--tracking-wide)",
                  textTransform: "uppercase",
                }}>
                  {tier.tag}
                </span>
                <span className={tier.active ? "badge badge-active" : "badge badge-pending"}>
                  {tier.label}
                </span>
              </div>
              <h3 style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                letterSpacing: "var(--tracking-snug)",
                marginBottom: "0.625rem",
              }}>
                {tier.title}
              </h3>
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--muted-fg)",
                lineHeight: "var(--leading-normal)",
                marginBottom: "1.5rem",
              }}>
                {tier.desc}
              </p>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {tier.features.map((f) => (
                  <li key={f} style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--muted-fg)",
                    display: "flex", alignItems: "center", gap: "0.625rem",
                  }}>
                    <span style={{
                      color: tier.active ? "var(--accent)" : "var(--border)",
                      fontSize: "var(--text-xs)",
                    }}>
                      ▸
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
