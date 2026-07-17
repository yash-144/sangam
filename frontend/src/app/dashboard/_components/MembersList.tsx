import { useState, useEffect } from "react";
import type { FundSummary, MemberStatus } from "@/lib/contract";
import { shortenAddress } from "@/lib/stellar";
import { sameAddress } from "../_hooks/useFund";
import { supabase } from "@/lib/supabase";

interface MembersListProps {
  summary: FundSummary;
  memberStatuses: Record<string, MemberStatus>;
  address: string | null;
  stateName: string;
}

export function MembersList({ summary, memberStatuses, address, stateName }: MembersListProps) {
  const [profiles, setProfiles] = useState<Record<string, { name?: string; avatar_url?: string }>>({});

  useEffect(() => {
    async function fetchProfiles() {
      if (!summary?.members.length) return;
      const { data, error } = await supabase
        .from("users")
        .select("stellar_wallet, name, avatar_url")
        .in("stellar_wallet", summary.members);

      if (data && !error) {
        const profileMap: Record<string, { name?: string; avatar_url?: string }> = {};
        data.forEach((p: { stellar_wallet: string; name?: string; avatar_url?: string }) => {
          profileMap[p.stellar_wallet] = p;
        });
        setProfiles(profileMap);
      }
    }
    fetchProfiles();
  }, [summary?.members]);

  if (summary.members.length === 0) {
    return <p style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)" }}>No members yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)", borderRadius: "6px", overflow: "hidden" }}>
      {summary.members.map((m, i) => {
        const status = Object.entries(memberStatuses).find(([a]) => sameAddress(a, m))?.[1];
        const isMe = sameAddress(m, address);
        const isOrg = sameAddress(m, summary.config.organizer);
        const winner = summary.past_winners.includes(m);
        return (
          <div key={m} style={{ background: "var(--bg)", padding: "0.875rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
              <code style={{ fontSize: "var(--text-sm)", color: "var(--muted-fg)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>#{i + 1}</code>
              {profiles[m]?.avatar_url && (
                <img src={profiles[m].avatar_url} alt="avatar" style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }} />
              )}
              <code style={{ fontSize: "var(--text-sm)", fontFamily: profiles[m]?.name ? "inherit" : "var(--font-mono)", fontWeight: profiles[m]?.name ? 500 : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profiles[m]?.name ? profiles[m].name : shortenAddress(m)}
              </code>
              {isMe && <span className="badge badge-active">you</span>}
              {isOrg && <span className="badge" style={{ background: "var(--muted)", color: "var(--muted-fg)" }}>organiser</span>}
              {winner && <span className="badge badge-active">won</span>}
            </div>
            {status && stateName !== "Pending" && (
              <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                {([
                  { key: "has_deposited", label: "D" },
                  { key: "has_committed", label: "C" },
                  { key: "has_revealed", label: "R" },
                ] as const).map(({ key, label }) => (
                  <span
                    key={key}
                    title={key.replace("has_", "")}
                    style={{
                      width: "20px", height: "20px", borderRadius: "4px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.5625rem", fontWeight: 600,
                      background: status[key] ? "var(--accent-light)" : "var(--muted)",
                      color: status[key] ? "var(--accent)" : "var(--muted-fg)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
