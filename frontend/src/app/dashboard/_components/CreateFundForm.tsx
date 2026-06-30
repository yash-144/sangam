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
    <div className="card" style={{ 
      padding: "2.5rem", 
      maxWidth: "30rem", 
      margin: "0 auto 2rem",
      background: "var(--surface)", 
      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      textAlign: "left"
    }}>
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>Create New Fund</h2>
        <p style={{ color: "var(--muted-fg)", fontSize: "var(--text-sm)" }}>Set up a rotating savings pool for you and your peers.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <label htmlFor="fund-name" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", display: "block", marginBottom: "0.5rem" }}>Fund Name</label>
          <input id="fund-name" className="input" style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }} value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Diwali Savings Circle" />
        </div>
        
        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="fund-amount" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", display: "block", marginBottom: "0.5rem" }}>Contribution (USDC)</label>
            <input id="fund-amount" className="input" type="number" style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }} value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} min="1" placeholder="100" />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="fund-members" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--fg)", display: "block", marginBottom: "0.5rem" }}>Total Members</label>
            <input id="fund-members" className="input" type="number" style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)" }} value={createMembers} onChange={(e) => setCreateMembers(e.target.value)} min="2" max="10" placeholder="5" />
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <button onClick={onSubmit} disabled={actionLoading || !createName || !createAmount || !createMembers} className="btn btn-primary" style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", fontWeight: 600, justifyContent: "center" }}>
            {actionLoading ? "Deploying Smart Contract…" : "Deploy Fund"}
          </button>
          <button onClick={onCancel} disabled={actionLoading} className="btn btn-outline" style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", justifyContent: "center" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
