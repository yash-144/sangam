import type { Phase } from "../_hooks/useFund";

interface PhaseInfo {
  label: string;
  action: string;
  hint: string;
  canAct: boolean;
  handler: () => void;
}

interface ActionPanelProps {
  phase: Phase;
  phaseInfo: PhaseInfo;
  actionLoading: boolean;
  actionError: string | null;
  actionSuccess: string | null;
  isJoiningCurrentFund: boolean;
  isStartingCurrentFund: boolean;
  isSealingCurrentRound: boolean;
  showInviteCode: boolean;
  inviteCode: string;
  onClearFund: () => void;
}

export function ActionPanel({
  phase, phaseInfo, actionLoading, actionError, actionSuccess,
  isJoiningCurrentFund, isStartingCurrentFund, isSealingCurrentRound,
  showInviteCode, inviteCode, onClearFund,
}: ActionPanelProps) {
  return (
    <div style={{ maxWidth: "28rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="text-label" style={{ color: "var(--muted-fg)", marginBottom: "0.5rem" }}>
          {phaseInfo.label}
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", lineHeight: "var(--leading-normal)" }}>{phaseInfo.hint}</p>
        {phase === "pending" && showInviteCode && (
          <div style={{ border: "1px solid var(--border)", borderRadius: "6px", padding: "1rem", marginTop: "1rem", background: "var(--muted)" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--muted-fg)", marginBottom: "0.375rem", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", fontWeight: 600 }}>Join code</p>
            <p className="tabular-nums" style={{ fontSize: "var(--text-xl)", fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0" }}>{inviteCode}</p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginTop: "0.5rem", lineHeight: "var(--leading-normal)" }}>
              Share this code with other members so they can join this fund.
            </p>
          </div>
        )}
        {(isJoiningCurrentFund || isStartingCurrentFund || isSealingCurrentRound) && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.875rem", fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>
            <div className="spin" style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: "var(--fg)", borderRadius: "50%" }} />
            {isStartingCurrentFund ? "Syncing fund start..." : isSealingCurrentRound ? "Syncing your sealed draw..." : "Syncing your membership..."}
          </div>
        )}
      </div>

      {actionError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "var(--text-sm)", color: "#dc2626" }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ background: "var(--accent-light)", border: "1px solid rgba(22,163,74,0.2)", borderRadius: "6px", padding: "0.875rem 1rem", marginBottom: "1rem", fontSize: "var(--text-sm)", color: "var(--accent)" }}>
          {actionSuccess}
        </div>
      )}

      {phase !== "completed" && (
        <button
          onClick={phaseInfo.handler}
          disabled={actionLoading || !phaseInfo.canAct}
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
        >
          {actionLoading ? "Processing…" : phaseInfo.action}
        </button>
      )}

      {phase === "completed" && (
        <div style={{ textAlign: "center", padding: "2rem 0" }}>
          <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, letterSpacing: "var(--tracking-snug)" }}>Fund complete!</p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", marginTop: "0.5rem" }}>All rounds finished. Everyone got their pot.</p>
          <button onClick={onClearFund} className="btn btn-outline" style={{ marginTop: "2rem" }}>
            Start a new fund
          </button>
        </div>
      )}
    </div>
  );
}
