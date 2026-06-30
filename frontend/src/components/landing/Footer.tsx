"use client";

export default function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "2.5rem 0" }}>
      <div
        className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
      >
        <span style={{
          fontSize: "var(--text-base)",
          fontWeight: 700,
          letterSpacing: "-0.05em",
        }}>
          sangam.
        </span>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>
          Built on Stellar · USDC · Soroban
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>
          Testnet
        </p>
      </div>
    </footer>
  );
}
