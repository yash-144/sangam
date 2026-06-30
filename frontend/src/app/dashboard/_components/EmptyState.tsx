interface EmptyStateProps {
  onCreateClick: () => void;
  onJoinClick: () => void;
}

export function EmptyState({ onCreateClick, onJoinClick }: EmptyStateProps) {
  return (
    <div style={{ paddingTop: "4rem", textAlign: "center" }}>
      <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: "var(--muted)", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--muted-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 6v4M10 14h.01"/>
        </svg>
      </div>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "0.625rem", letterSpacing: "var(--tracking-snug)" }}>No active fund</h2>
      <p style={{ fontSize: "var(--text-base)", color: "var(--muted-fg)", marginBottom: "2.5rem" }}>Create a new fund or join one with a six-digit invite code.</p>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <button onClick={onCreateClick} className="btn btn-primary">+ Create Fund</button>
        <button onClick={onJoinClick} className="btn btn-outline">Join Fund</button>
      </div>
    </div>
  );
}
