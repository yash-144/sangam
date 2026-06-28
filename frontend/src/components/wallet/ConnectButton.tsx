"use client";

import { useWallet } from "./WalletProvider";

export function ConnectButton() {
  const { isConnected, address, disconnect } = useWallet();

  if (isConnected && address) {
    return (
      <button className="disconnect-btn" onClick={disconnect}>
        Disconnect
      </button>
    );
  }

  return null; // Connection is handled by the CTA button in page.tsx
}
