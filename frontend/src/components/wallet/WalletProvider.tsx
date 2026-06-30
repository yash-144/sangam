"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { WalletConnectModule, WalletConnectTargetChain } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { activeModule } from "@creit-tech/stellar-wallets-kit/state";
import { WalletState } from "../../types";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const walletStorageKey = "cf_wallet_address";
const walletIdStorageKey = "cf_wallet_id";

function getAppUrl() {
    if (typeof window === "undefined") return "https://sangam.app";
    return window.location.origin;
}

function getWalletModules() {
    const modules = defaultModules();

    if (walletConnectProjectId) {
        modules.push(new WalletConnectModule({
            projectId: walletConnectProjectId,
            allowedChains: [WalletConnectTargetChain.TESTNET],
            metadata: {
                name: "sangam",
                description: "Sangam — rotating savings on Stellar",
                url: getAppUrl(),
                icons: [`${getAppUrl()}/favicon.ico`],
            },
        }));
    }

    return modules;
}

function isMobileBrowser() {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

if (typeof window !== "undefined") {
    StellarWalletsKit.init({
        modules: getWalletModules(),
        network: Networks.TESTNET,
    });
}

interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function clearChitfundLocalState() {
    const prefixes = ["cf_", "chitfund_"];
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
            localStorage.removeItem(key);
        }
    }
    sessionStorage.clear();
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<WalletState>({
        address: null,
        isConnecting: false,
        isConnected: false,
        network: Networks.TESTNET,
        connectionError: null,
    });

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const savedAddress = window.localStorage.getItem(walletStorageKey);
            const savedWalletId = window.localStorage.getItem(walletIdStorageKey);
            if (!savedAddress) return;

            if (savedWalletId) StellarWalletsKit.setWallet(savedWalletId);
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
            if (isMobileBrowser() && !walletConnectProjectId) {
                throw new Error("Mobile wallet connection needs NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Add a WalletConnect/Reown project id, then connect with Freighter mobile or another WalletConnect wallet.");
            }

            setState((prev) => ({ ...prev, isConnecting: true, connectionError: null }));
            const { address } = await StellarWalletsKit.authModal();
            const previousAddress = localStorage.getItem(walletStorageKey);

            if (previousAddress && previousAddress !== address) {
                clearChitfundLocalState();
            }

            localStorage.setItem(walletStorageKey, address);
            const selectedWalletId = activeModule.value?.productId;
            if (selectedWalletId) localStorage.setItem(walletIdStorageKey, selectedWalletId);

            setState((prev) => ({
                ...prev,
                address,
                isConnected: true,
                isConnecting: false,
            }));
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            setState((prev) => ({ 
                ...prev, 
                isConnecting: false,
                connectionError: error instanceof Error ? error.message : "Connection failed"
            }));
        }
    };

    const disconnect = async () => {
        try {
            await StellarWalletsKit.disconnect();
            clearChitfundLocalState();
            setState({
                address: null,
                isConnecting: false,
                isConnected: false,
                network: Networks.TESTNET,
                connectionError: null,
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
