import { shortenAddress } from "@/lib/stellar";
import type { RoundSummary } from "@/lib/contract";

interface RoundHistoryProps {
  roundHistory: Array<{ round: number; winner: string | null; roundData: RoundSummary | null }>;
}

export function RoundHistory({ roundHistory }: RoundHistoryProps) {
  if (roundHistory.length === 0) {
    return <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>No completed rounds yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "6px", overflow: "hidden" }}>
      {roundHistory.map((h) => (
        <div key={h.round} style={{ background: "var(--bg)", padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: "var(--text-base)", fontWeight: 500 }}>Round {h.round}</p>
            <code style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", fontFamily: "var(--font-mono)" }}>
              {h.winner ? shortenAddress(h.winner) : "No winner"}
            </code>
          </div>
          <span className="badge badge-completed">Done</span>
        </div>
      ))}
    </div>
  );
}
