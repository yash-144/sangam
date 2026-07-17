"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getFundSummary,
  getRoundSummary,
  getMemberStatus,
  type FundSummary,
  type MemberStatus,
  type RoundSummary,
} from "@/lib/contract";
import { supabase } from "@/lib/supabase";

export type Phase = "pending" | "deposit" | "commit" | "reveal" | "claim" | "completed";

export type FetchOptions = {
  silent?: boolean;
  waitForFund?: boolean;
  waitForMember?: string;
  waitForState?: string;
  waitForStatus?: keyof MemberStatus;
  waitForWinner?: boolean;
};

const RPC_RETRY_DELAY_MS = 1500;
const WINNER_SYNC_ATTEMPTS = 8;
const LIVE_SYNC_INTERVAL_MS = 5000;

export function toFundIdNumber(value: number | bigint | null | undefined) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export function sameAddress(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.toUpperCase() === b.toUpperCase());
}

export function hasMember(data: FundSummary | null, member: string | null | undefined) {
  return Boolean(member && data?.members?.some((m) => sameAddress(m, member)));
}

export function fundStateName(data: FundSummary | null | undefined): string {
  return data?.state?.[0] ?? "Unknown";
}

function hasWinnerForRound(data: FundSummary | null | undefined, round: number): boolean {
  return Boolean(data?.past_winners?.[round - 1]);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const emptyRound = (): RoundSummary => ({ deposit_count: 0, commit_count: 0, reveal_count: 0 });

async function getRoundSummaryWithRetry(address: string, fundId: number, round: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const summary = await getRoundSummary(address, fundId, round).catch(() => null);
    if (summary) return summary;
    await wait(1000);
  }
  return null;
}

export function useFund(address: string | null, isConnected: boolean) {
  const [summary, setSummary] = useState<FundSummary | null>(null);
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [phase, setPhase] = useState<Phase>("deposit");
  const [memberStatuses, setMemberStatuses] = useState<Record<string, MemberStatus>>({});
  const [roundHistory, setRoundHistory] = useState<Array<{ round: number; winner: string | null; roundData: RoundSummary | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentFundId, setCurrentFundId] = useState<number | null>(null);
  const [pendingJoinFundId, setPendingJoinFundId] = useState<number | null>(null);
  const [pendingStartFundId, setPendingStartFundId] = useState<number | null>(null);
  const [pendingSealKey, setPendingSealKey] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const liveSyncInFlight = useRef(false);

  // Restore fund ID from Supabase (fallback to localStorage).
  // All setState calls are inside the async function so none fire
  // synchronously in the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const loadActiveFund = async () => {
      if (!address) {
        setCurrentFundId(null);
        setSummary(null);
        setRound(null);
        setRoundHistory([]);
        setMemberStatuses({});
        setPendingJoinFundId(null);
        setPendingStartFundId(null);
        setPendingSealKey(null);
        return;
      }

      let foundId: number | null = null;

      try {
        const { data, error } = await supabase
          .from("users")
          .select("active_fund_id")
          .eq("stellar_wallet", address)
          .single();

        if (!error && data?.active_fund_id) {
          foundId = Number(data.active_fund_id);
        }
      } catch (err) {
        console.error("Failed to fetch active fund from Supabase", err);
      }

      if (!foundId) {
        const key = `cf_current_fund_id_${address}`;
        const saved = window.localStorage.getItem(key);
        if (saved) foundId = Number(saved);
      }

      if (foundId) setCurrentFundId(foundId);
    };

    loadActiveFund();
  }, [address]);

  // Sync fund ID to Supabase and localStorage on change
  useEffect(() => {
    const key = address ? `cf_current_fund_id_${address}` : null;
    if (key && currentFundId !== null) {
      localStorage.setItem(key, String(currentFundId));
      
      supabase.from("users")
        .update({ active_fund_id: currentFundId })
        .eq("stellar_wallet", address)
        .then(({ error }) => {
          if (error) console.error("Failed to sync active fund to Supabase:", error);
        });
    }
  }, [address, currentFundId]);

  const fetchFund = useCallback(async (overrideFundId?: number, options: FetchOptions = {}) => {
    const targetId = overrideFundId !== undefined ? overrideFundId : currentFundId;
    if (!address || targetId === null) {
      if (!options.silent) setLoading(false);
      return;
    }
    try {
      if (!options.silent) setLoading(true);
      let data = await getFundSummary(address, targetId) as FundSummary | null;
      if (!data && options.waitForFund) {
        for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
          await wait(RPC_RETRY_DELAY_MS);
          data = await getFundSummary(address, targetId) as FundSummary | null;
          if (data) break;
        }
      }

      if (data) {
        let currentRound = data.current_round === 0 ? 1 : data.current_round;
        let rData = await getRoundSummaryWithRetry(address, targetId, currentRound) || emptyRound();

        for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
          const allRevealsSeen = rData.reveal_count >= data.config.member_count;
          const waitingOnWinner = fundStateName(data) === "Active" && (allRevealsSeen || options.waitForWinner) && !hasWinnerForRound(data, currentRound);
          const waitingOnMember = Boolean(options.waitForMember && !hasMember(data, options.waitForMember));
          const waitingOnState = Boolean(options.waitForState && fundStateName(data) !== options.waitForState);
          if (!waitingOnWinner && !waitingOnMember && !waitingOnState) break;
          await wait(RPC_RETRY_DELAY_MS);
          const refreshed = await getFundSummary(address, targetId) as FundSummary | null;
          if (refreshed) { data = refreshed; currentRound = data.current_round === 0 ? 1 : data.current_round; }
          rData = await getRoundSummaryWithRetry(address, targetId, currentRound) || emptyRound();
        }

        setSummary(data);
        setPendingJoinFundId((pending) => (
          pending !== null && pending === targetId && hasMember(data, address) ? null : pending
        ));
        setPendingStartFundId((pending) => (
          pending !== null && pending === targetId && fundStateName(data) !== "Pending" ? null : pending
        ));
        setRound(rData);

        const stateName = fundStateName(data);
        const winnerReady = hasWinnerForRound(data, currentRound);
        if (stateName === "Pending") setPhase("pending");
        else if (stateName === "Completed") setPhase("completed");
        else if (rData.deposit_count < data.config.member_count) setPhase("deposit");
        else if (rData.commit_count < data.config.member_count) setPhase("commit");
        else if (rData.reveal_count < data.config.member_count || !winnerReady) setPhase("reveal");
        else setPhase("claim");

        if (stateName !== "Pending") {
          let entries = await Promise.all(
            data.members.map(async (m) => [m, await getMemberStatus(address, targetId, m, currentRound)] as [string, MemberStatus])
          );
          if (options.waitForStatus) {
            for (let attempt = 0; attempt < WINNER_SYNC_ATTEMPTS; attempt++) {
              const mine = entries.find(([m]) => sameAddress(m, address))?.[1];
              if (mine?.[options.waitForStatus!]) break;
              await wait(RPC_RETRY_DELAY_MS);
              entries = await Promise.all(
                data.members.map(async (m) => [m, await getMemberStatus(address, targetId, m, currentRound)] as [string, MemberStatus])
              );
            }
          }
          setMemberStatuses(Object.fromEntries(entries));
          setPendingSealKey((pending) => {
            const mine = entries.find(([m]) => sameAddress(m, address))?.[1];
            const key = targetId === null ? null : `${targetId}:${currentRound}`;
            return pending !== null && pending === key && mine?.has_committed ? null : pending;
          });
        }

        if (currentRound > 1 || fundStateName(data) === "Completed") {
          const completedRounds = Array.from({ length: fundStateName(data) === "Completed" ? currentRound : currentRound - 1 }, (_, i) => i + 1);
          const historyEntries = await Promise.all(
            completedRounds.map(async (r) => {
              const rd = await getRoundSummaryWithRetry(address, targetId, r);
              return { round: r, winner: data!.past_winners[r - 1] ?? null, roundData: rd };
            })
          );
          setRoundHistory(historyEntries);
        } else {
          setRoundHistory([]);
        }
      } else {
        if (!options.silent && !options.waitForFund) {
          setSummary(null); setRound(null); setRoundHistory([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch fund:", err);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [address, currentFundId]);

  // Initial fetch
  useEffect(() => {
    if (!isConnected || !address) return;
    const timer = window.setTimeout(() => {
      void fetchFund(undefined, { waitForFund: currentFundId !== null });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isConnected, address, fetchFund, currentFundId]);

  // Live sync — paused when tab is hidden
  useEffect(() => {
    if (!isConnected || !address || currentFundId === null || actionLoading) return;
    const sync = async () => {
      if (liveSyncInFlight.current || document.visibilityState !== 'visible') return;
      liveSyncInFlight.current = true;
      try { await fetchFund(undefined, { silent: true }); } finally { liveSyncInFlight.current = false; }
    };
    const interval = setInterval(() => void sync(), LIVE_SYNC_INTERVAL_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') void sync(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [isConnected, address, currentFundId, actionLoading, fetchFund]);

  return {
    summary,
    round,
    phase,
    memberStatuses,
    roundHistory,
    loading,
    currentFundId,
    setCurrentFundId,
    pendingJoinFundId,
    setPendingJoinFundId,
    pendingStartFundId,
    setPendingStartFundId,
    pendingSealKey,
    setPendingSealKey,
    actionLoading,
    setActionLoading,
    fetchFund,
    setSummary,
    setRound,
    setRoundHistory,
    setMemberStatuses,
  };
}
