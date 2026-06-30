interface RoundProgressProps {
  currentRound: number;
  totalRounds: number;
}

export function RoundProgress({ currentRound, totalRounds }: RoundProgressProps) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.625rem" }}>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>Round progress</span>
        <span className="tabular-nums" style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>{currentRound}/{totalRounds}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(currentRound / totalRounds) * 100}%` }} />
      </div>
    </div>
  );
}
