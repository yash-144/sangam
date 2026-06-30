interface JoinFundFormProps {
  joinFundIdInput: string;
  setJoinFundIdInput: (v: string) => void;
  actionLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function JoinFundForm({ joinFundIdInput, setJoinFundIdInput, actionLoading, onSubmit, onCancel }: JoinFundFormProps) {
  return (
    <div className="card" style={{ padding: "2rem", maxWidth: "28rem", marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "var(--tracking-snug)" }}>Join an existing fund</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="join-code"
          className="input"
          value={joinFundIdInput}
          onChange={(e) => setJoinFundIdInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit invite code"
          inputMode="numeric"
          pattern="[0-9]*"
        />
        <button onClick={onSubmit} disabled={actionLoading} className="btn btn-primary">
          {actionLoading ? "Joining…" : "Join"}
        </button>
        <button onClick={onCancel} className="btn btn-outline">Cancel</button>
      </div>
    </div>
  );
}
