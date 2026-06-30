"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  createChitFund,
  joinFund,
  activateFund,
  deposit,
  commitHash,
  revealHash,
  claimPot,
} from "@/lib/contract";
import { usdcToStroops, USDC_CONTRACT_ID } from "@/lib/stellar";
import { parseError } from "../_lib/parseError";
import { toFundIdNumber, type FetchOptions } from "./useFund";
import type { FundSummary, MemberStatus, RoundSummary } from "@/lib/contract";

function toHexString(byteArray: Uint8Array) {
  return Array.from(byteArray, (byte) => ("0" + (byte & 0xff).toString(16)).slice(-2)).join("");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FundActionsProps {
  address: string | null;
  currentFundId: number | null;
  summary: FundSummary | null;
  round: RoundSummary | null;
  setCurrentFundId: Dispatch<SetStateAction<number | null>>;
  setSummary: Dispatch<SetStateAction<FundSummary | null>>;
  setPendingJoinFundId: Dispatch<SetStateAction<number | null>>;
  setPendingStartFundId: Dispatch<SetStateAction<number | null>>;
  setPendingSealKey: Dispatch<SetStateAction<string | null>>;
  setActionLoading: Dispatch<SetStateAction<boolean>>;
  fetchFund: (overrideId?: number, options?: FetchOptions) => Promise<void>;
}

export function useFundActions({
  address,
  currentFundId,
  summary,
  round,
  setCurrentFundId,
  setSummary,
  setPendingJoinFundId,
  setPendingStartFundId,
  setPendingSealKey,
  setActionLoading,
  fetchFund,
}: FundActionsProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAmount, setCreateAmount] = useState("100");
  const [createMembers, setCreateMembers] = useState("5");
  const [joinFundIdInput, setJoinFundIdInput] = useState("");

  async function runAction(fn: () => Promise<unknown>, errorMsg: string, successMsg?: string, onError?: () => void) {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await wait(50);
      const res = await fn();
      await wait(3000);
      const nextFundId = typeof res === "number" || typeof res === "bigint" ? toFundIdNumber(res) ?? undefined : undefined;
      const waitForWinner = typeof res === "object" && res !== null && "waitForWinner" in res && Boolean(res.waitForWinner);
      const waitForMember = typeof res === "object" && res !== null && "waitForMember" in res && typeof res.waitForMember === "string" ? res.waitForMember : undefined;
      const waitForState = typeof res === "object" && res !== null && "waitForState" in res && typeof res.waitForState === "string" ? res.waitForState : undefined;
      const waitForStatus = typeof res === "object" && res !== null && "waitForStatus" in res && typeof res.waitForStatus === "string" ? res.waitForStatus as keyof MemberStatus : undefined;
      await fetchFund(nextFundId, { waitForFund: nextFundId !== undefined, waitForMember, waitForState, waitForStatus, waitForWinner });
      if (successMsg) { setActionSuccess(successMsg); setTimeout(() => setActionSuccess(null), 4000); }
    } catch (e: unknown) {
      onError?.();
      const message = e instanceof Error ? e.message : errorMsg;
      setActionError(parseError(message));
    } finally {
      setActionLoading(false);
    }
  }

  async function generateSecretAndHash(addr: string) {
    const secretBytes = new Uint8Array(32);
    window.crypto.getRandomValues(secretBytes);
    const secretHex = toHexString(secretBytes);
    localStorage.setItem(`chitfund_secret_${addr}`, secretHex);
    const hashBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
    return toHexString(new Uint8Array(hashBuffer));
  }

  function inviteCodeToFundId(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return NaN;
    if (digits.length < 6) return Number(digits);
    const INVITE_CODE_MOD = 900000;
    const INVITE_CODE_MIN = 100000;
    const INVITE_CODE_OFFSET = 104729;
    const INVITE_CODE_MULTIPLIER_INVERSE = 517679;
    const code = Number(digits.slice(0, 6));
    const decoded = (((code - INVITE_CODE_MIN - INVITE_CODE_OFFSET) * INVITE_CODE_MULTIPLIER_INVERSE) % INVITE_CODE_MOD + INVITE_CODE_MOD) % INVITE_CODE_MOD;
    return decoded > 0 ? decoded : NaN;
  }

  const handleCreate = () => {
    if (!createName || !createAmount || !createMembers) { setActionError("Please fill out all fields."); return; }
    const amount = Number(createAmount);
    const members = Number(createMembers);
    if (amount <= 0) { setActionError("Amount must be greater than 0."); return; }
    if (members < 2 || members > 10) { setActionError("Members must be between 2 and 10."); return; }
    if (!USDC_CONTRACT_ID) { setActionError("USDC Contract ID is missing from configuration."); return; }
    runAction(async () => {
      const newFundId = toFundIdNumber(await createChitFund(address!, USDC_CONTRACT_ID, createName, usdcToStroops(createAmount), members));
      if (!newFundId) throw new Error("Could not read the new fund ID.");
      setCurrentFundId(newFundId);
      setShowCreate(false);
      return newFundId;
    }, "Failed to create fund");
  };

  const handleJoin = (id?: number) => {
    const targetId = id ?? inviteCodeToFundId(joinFundIdInput);
    if (isNaN(targetId)) { setActionError("Please enter a valid invite code."); return; }
    runAction(async () => {
      setPendingJoinFundId(targetId);
      setCurrentFundId(targetId);
      await joinFund(address!, targetId);
      setShowJoinInput(false);
      return { waitForMember: address! };
    }, "Failed to join fund", "Joined successfully!", () => setPendingJoinFundId(null));
  };

  const handleActivate = () => runAction(async () => {
    setPendingStartFundId(currentFundId);
    await activateFund(address!, currentFundId!);
    return { waitForState: "Active" };
  }, "Failed to activate", "Fund started!", () => setPendingStartFundId(null));

  const handleDeposit = () => runAction(async () => {
    return await deposit(address!, currentFundId!, summary!.config.contribution);
  }, "Failed to deposit", "Deposit successful!");

  const handleCommit = () => runAction(async () => {
    const hashHex = await generateSecretAndHash(address!);
    setPendingSealKey(`${currentFundId}:${summary!.current_round === 0 ? 1 : summary!.current_round}`);
    await commitHash(address!, currentFundId!, hashHex);
    return { waitForStatus: "has_committed" };
  }, "Failed to commit", "Draw sealed!", () => setPendingSealKey(null));

  const handleReveal = () => runAction(async () => {
    const secretHex = localStorage.getItem(`chitfund_secret_${address}`);
    if (!secretHex) throw new Error("No sealed draw found on this device.");
    const revealWillPickWinner = (round?.reveal_count ?? 0) >= summary!.config.member_count - 1;
    await revealHash(address!, currentFundId!, secretHex);
    return { waitForWinner: revealWillPickWinner };
  }, "Failed to reveal", "Revealed!");

  const handleClaim = () => runAction(async () => {
    await claimPot(address!, currentFundId!);
  }, "Failed to claim", "Pot claimed!");

  const handleClearFund = () => {
    setCurrentFundId(null);
    const key = address ? `cf_current_fund_id_${address}` : null;
    if (key) localStorage.removeItem(key);
    setSummary(null);
  };

  return {
    actionError, setActionError,
    actionSuccess,
    showCreate, setShowCreate,
    showJoinInput, setShowJoinInput,
    createName, setCreateName,
    createAmount, setCreateAmount,
    createMembers, setCreateMembers,
    joinFundIdInput, setJoinFundIdInput,
    handleCreate,
    handleJoin,
    handleActivate,
    handleDeposit,
    handleCommit,
    handleReveal,
    handleClaim,
    handleClearFund,
    inviteCodeToFundId,
  };
}
