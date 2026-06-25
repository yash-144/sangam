"use client";

import { useWallet } from "./WalletProvider";
import { shortenAddress } from "../../lib/stellar";

export function ConnectButton() {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{shortenAddress(address)}</span>
        <button
          onClick={disconnect}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
