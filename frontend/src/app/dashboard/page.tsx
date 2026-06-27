"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "../../components/wallet/WalletProvider";
import { getFundSummary } from "../../lib/contract";
import { stroopsToDisplay } from "../../lib/stellar";

export default function DashboardPage() {
  const { isConnected, address } = useWallet();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFund() {
      try {
        const data = await getFundSummary();
        setSummary(data);
      } catch (err) {
        console.error("Failed to fetch fund:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFund();
  }, []);

  return (
    <div className="flex flex-col flex-1 w-full max-w-4xl p-4 mx-auto sm:p-8">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">Your Chit Funds</h1>
      
      {!isConnected ? (
        <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-2xl dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">Connect your wallet to view your funds.</p>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full"></div>
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/fund/1" className="block p-6 transition-all bg-white border border-zinc-200 rounded-2xl hover:border-blue-500 hover:shadow-md dark:bg-zinc-950 dark:border-zinc-800 dark:hover:border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{summary.config.name}</h2>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-200">
                {summary.state}
              </span>
            </div>
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Contribution</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{stroopsToDisplay(summary.config.contribution)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span>Members</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{summary.members.length} / {summary.config.member_count}</span>
              </div>
            </div>
          </Link>
        </div>
      ) : (
        <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-2xl dark:bg-zinc-900 dark:border-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">You are not part of any funds yet.</p>
          <Link href="/create" className="text-blue-600 hover:underline dark:text-blue-400 font-medium">
            Create one now &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
