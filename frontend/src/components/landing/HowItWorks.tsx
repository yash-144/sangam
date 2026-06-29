"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  { num: "01", title: "Create", desc: "Set contribution amount and group size. Deploy in one click." },
  { num: "02", title: "Join", desc: "Members connect wallets and join the smart contract." },
  { num: "03", title: "Deposit", desc: "Everyone deposits each round. On-chain, verifiable." },
  { num: "04", title: "Win", desc: "Fair lottery picks the winner. Funds release automatically." },
  { num: "05", title: "Repeat", desc: "Next round begins. Everyone gets their turn." },
];

export default function HowItWorks() {
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
    <section id="how-it-works" ref={ref} style={{ padding: "var(--space-section) 0" }}>
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
            How it works
          </p>
          <h2 className="text-heading">
            Five steps. Fully automated.
          </h2>
        </div>

        <div
          className="grid-panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
        >
          {steps.map((step, i) => (
            <div
              key={step.num}
              style={{
                padding: "2rem 1.75rem",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(30px)",
                transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
              }}
            >
              <span style={{
                fontSize: "var(--text-sm)",
                fontFamily: "monospace",
                color: "var(--accent)",
                display: "block",
                marginBottom: "1.25rem",
                fontWeight: 600,
              }}>
                {step.num}
              </span>
              <h3 style={{
                fontSize: "var(--text-lg)",
                fontWeight: 600,
                marginBottom: "0.625rem",
                letterSpacing: "var(--tracking-snug)",
              }}>
                {step.title}
              </h3>
              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--muted-fg)",
                lineHeight: "var(--leading-normal)",
              }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
