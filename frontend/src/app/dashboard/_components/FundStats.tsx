import type { FundSummary } from "@/lib/contract";
import { stroopsToDisplay } from "@/lib/stellar";

interface FundStatsProps {
  summary: FundSummary;
  currentRound: number;
  potAmount: number;
}

export function FundStats({ summary, currentRound, potAmount }: FundStatsProps) {
  const stats = [
    { label: "Pot Size", value: `${stroopsToDisplay(potAmount)} USDC` },
    { label: "Round", value: `${currentRound} / ${summary.config.member_count}` },
    { label: "Members", value: `${summary.members.length} / ${summary.config.member_count}` },
    { label: "Your contribution", value: `${stroopsToDisplay(summary.config.contribution)} USDC` },
  ];

  return (
    <div className="grid-panel grid grid-cols-2 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} style={{ padding: "1.5rem 1.75rem" }}>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-fg)", marginBottom: "0.5rem", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", fontWeight: 500 }}>{s.label}</p>
          <p className="tabular-nums" style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "var(--tracking-snug)" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
