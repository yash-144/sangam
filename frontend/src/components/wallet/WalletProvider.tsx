"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { FreighterModule } from "@creit-tech/stellar-wallets-kit/modules/freighter";
import { WalletState } from "../../types";

// Initialize once at module level (client-side only)
if (typeof window !== "undefined") {
    StellarWalletsKit.init({
        modules: [new FreighterModule()],
        network: Networks.TESTNET,
    });
}

interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<WalletState>({
        address: null,
        isConnecting: false,
        isConnected: false,
        network: Networks.TESTNET,
    });

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const savedAddress = window.localStorage.getItem("cf_wallet_address");
            if (!savedAddress) return;

            StellarWalletsKit.setWallet("freighter");
            setState((prev) => ({
                ...prev,
                address: savedAddress,
                isConnected: true,
            }));
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

    const connect = async () => {
        try {
            setState((prev) => ({ ...prev, isConnecting: true }));
            const { address } = await StellarWalletsKit.authModal();

            localStorage.setItem("cf_wallet_address", address);

            setState((prev) => ({
                ...prev,
                address,
                isConnected: true,
                isConnecting: false,
            }));
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            setState((prev) => ({ ...prev, isConnecting: false }));
        }
    };

    const disconnect = async () => {
        try {
            await StellarWalletsKit.disconnect();
            localStorage.removeItem("cf_wallet_address");
            setState({
                address: null,
                isConnecting: false,
                isConnected: false,
                network: Networks.TESTNET,
            });
        } catch (error) {
            console.error("Failed to disconnect wallet:", error);
        }
    };

    return (
        <WalletContext.Provider value={{ ...state, connect, disconnect }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
