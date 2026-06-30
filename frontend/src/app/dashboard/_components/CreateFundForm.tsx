interface CreateFundFormProps {
  createName: string;
  setCreateName: (v: string) => void;
  createAmount: string;
  setCreateAmount: (v: string) => void;
  createMembers: string;
  setCreateMembers: (v: string) => void;
  actionLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateFundForm({
  createName, setCreateName,
  createAmount, setCreateAmount,
  createMembers, setCreateMembers,
  actionLoading, onSubmit, onCancel,
}: CreateFundFormProps) {
  return (
    <div className="card" style={{ padding: "2rem", maxWidth: "28rem", marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "1.5rem", letterSpacing: "var(--tracking-snug)" }}>Create a new fund</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label htmlFor="fund-name" style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Fund name</label>
          <input id="fund-name" className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Diwali Savings Circle" />
        </div>
        <div>
          <label htmlFor="fund-amount" style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Monthly contribution (USDC)</label>
          <input id="fund-amount" className="input" type="number" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} min="1" />
        </div>
        <div>
          <label htmlFor="fund-members" style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", display: "block", marginBottom: "0.5rem" }}>Number of members (2–10)</label>
          <input id="fund-members" className="input" type="number" value={createMembers} onChange={(e) => setCreateMembers(e.target.value)} min="2" max="10" />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button onClick={onSubmit} disabled={actionLoading} className="btn btn-primary" style={{ flex: 1 }}>
            {actionLoading ? "Deploying…" : "Deploy Fund"}
          </button>
          <button onClick={onCancel} className="btn btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
