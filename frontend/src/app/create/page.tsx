"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "../../components/wallet/WalletProvider";
import { createChitFund } from "../../lib/contract";
import { USDC_CONTRACT_ID, usdcToStroops } from "../../lib/stellar";
import Link from "next/link";

export default function CreateFundPage() {
  const router = useRouter();
  const { isConnected, address } = useWallet();
  const [name, setName] = useState("");
  const [contribution, setContribution] = useState<number>(100);
  const [memberCount, setMemberCount] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalPot = contribution * memberCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      setError("Please connect your wallet first.");
      return;
    }
    if (memberCount < 2 || memberCount > 10) {
      setError("Members must be between 2 and 10.");
      return;
    }
    if (contribution <= 0) {
      setError("Contribution must be greater than 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      
      const stroopsContribution = usdcToStroops(contribution);
      await createChitFund(address, USDC_CONTRACT_ID, name, stroopsContribution, memberCount);
      
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to create fund");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full p-4 sm:p-8 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm dark:bg-zinc-950 dark:border-zinc-800">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
            &larr; Back
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Create a Chit Fund</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Setup a new trustless ROSCA on Stellar.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Fund Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Savings Group"
              className="w-full px-4 py-2 text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="contribution" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Monthly Contribution (USDC)
            </label>
            <input
              id="contribution"
              type="number"
              required
              min="1"
              value={contribution}
              onChange={(e) => setContribution(Number(e.target.value))}
              className="w-full px-4 py-2 text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="members" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Number of Members (2-10)
            </label>
            <input
              id="members"
              type="number"
              required
              min="2"
              max="10"
              value={memberCount}
              onChange={(e) => setMemberCount(Number(e.target.value))}
              className="w-full px-4 py-2 text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
            />
          </div>

          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Total Pot per Round</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPot} USDC</span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-950/50 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isConnected}
            className="w-full px-4 py-2.5 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : !isConnected ? "Connect Wallet to Create" : "Create Fund"}
          </button>
        </form>
      </div>
    </div>
  );
}
