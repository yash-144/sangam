"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "../../../components/wallet/WalletProvider";
import { getFundSummary, joinFund, activateFund } from "../../../lib/contract";
import { stroopsToDisplay, shortenAddress } from "../../../lib/stellar";

export default function FundDetailPage() {
  const params = useParams();
  const { isConnected, address } = useWallet();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchFund() {
    if (!address) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getFundSummary(address);
      setSummary(data);
    } catch (err) {
      console.error("Failed to fetch fund:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFund();
  }, [address]);

  const handleJoin = async () => {
    if (!address) return;
    try {
      setActionLoading(true);
      setError("");
      await joinFund(address);
      await fetchFund(); // Refresh data
    } catch (err: any) {
      setError(err.message || "Failed to join fund");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!address) return;
    try {
      setActionLoading(true);
      setError("");
      await activateFund(address);
      await fetchFund();
    } catch (err: any) {
      setError(err.message || "Failed to activate fund");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-zinc-500">Fund not found or contract not initialized.</p>
      </div>
    );
  }

  const isOrganizer = address === summary.config.organizer;
  const isMember = summary.members.includes(address);
  const isFull = summary.members.length === summary.config.member_count;

  return (
    <div className="flex flex-col flex-1 w-full max-w-3xl p-4 mx-auto sm:p-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{summary.config.name}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Organizer: {shortenAddress(summary.config.organizer)}
            </p>
          </div>
          <span className="inline-flex px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
            {summary.state}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-zinc-50 rounded-xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Monthly Contribution</p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{stroopsToDisplay(summary.config.contribution)} USDC</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-xl dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Members</p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{summary.members.length} / {summary.config.member_count}</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Member List</h2>
          <div className="space-y-2">
            {summary.members.map((m: string, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
                <span className="font-mono text-sm">{shortenAddress(m)}</span>
                {m === summary.config.organizer && (
                  <span className="text-xs font-medium text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">Organizer</span>
                )}
              </div>
            ))}
            {summary.members.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">No members yet.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 mb-6 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Action Area */}
        <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
          {!isConnected ? (
            <p className="text-sm text-zinc-500 text-center">Connect wallet to interact with this fund.</p>
          ) : summary.state === 0 ? (
            <div className="flex gap-4">
              {!isMember && !isFull && (
                <button
                  onClick={handleJoin}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Joining..." : "Join Fund"}
                </button>
              )}
              {isOrganizer && isFull && (
                <button
                  onClick={handleActivate}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Activating..." : "Activate Fund"}
                </button>
              )}
              {isMember && !isFull && (
                <p className="text-sm text-zinc-500 text-center w-full py-2">Waiting for more members to join...</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center">
              Fund is {summary.state === 1 ? "active" : "completed"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
