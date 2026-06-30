interface JoinFundFormProps {
  joinFundIdInput: string;
  setJoinFundIdInput: (v: string) => void;
  actionLoading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function JoinFundForm({ joinFundIdInput, setJoinFundIdInput, actionLoading, onSubmit, onCancel }: JoinFundFormProps) {
  return (
    <div className="card" style={{ 
      padding: "2.5rem", 
      maxWidth: "30rem", 
      margin: "0 auto 2rem",
      background: "var(--surface)", 
      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      textAlign: "center"
    }}>
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>Join Existing Fund</h2>
        <p style={{ color: "var(--muted-fg)", fontSize: "var(--text-sm)" }}>Enter the 6-digit invite code provided by the organizer.</p>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <input
            id="join-code"
            className="input"
            style={{ 
              width: "100%", 
              padding: "1rem", 
              fontSize: "1.5rem", 
              letterSpacing: "0.5rem",
              textAlign: "center",
              borderRadius: "8px", 
              border: "1px solid var(--border)", 
              background: "var(--bg)",
              fontWeight: 700
            }}
            value={joinFundIdInput}
            onChange={(e) => setJoinFundIdInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
          />
        </div>
        
        <div className="flex flex-col gap-3 mt-2">
          <button onClick={onSubmit} disabled={actionLoading || joinFundIdInput.length < 6} className="btn btn-primary" style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", fontWeight: 600, justifyContent: "center" }}>
            {actionLoading ? "Joining…" : "Join Fund"}
          </button>
          <button onClick={onCancel} disabled={actionLoading} className="btn btn-outline" style={{ width: "100%", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", justifyContent: "center" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
