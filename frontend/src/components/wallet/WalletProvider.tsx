"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { WalletConnectModule, WalletConnectTargetChain } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { activeModule } from "@creit-tech/stellar-wallets-kit/state";
import { WalletState } from "../../types";
import { supabase } from "../../lib/supabase";

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

if (typeof window !== "undefined" && !(window as any)._stellarWalletsKitInitialized) {
    StellarWalletsKit.init({
        modules: getWalletModules(),
        network: Networks.TESTNET,
    });
    (window as any)._stellarWalletsKitInitialized = true;
}

interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOutGoogle: () => Promise<void>;
    clearLinkingError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function clearChitfundLocalState() {
    const prefixes = ["cf_", "chitfund_"];
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
            // Do not delete the active fund pointers so they are remembered on reconnect
            if (!key.startsWith("cf_current_fund_id_")) {
                localStorage.removeItem(key);
            }
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
        supabaseUser: null,
        isSupabaseLoading: true,
        linkingErrorModal: null,
    });

    const clearLinkingError = () => setState(prev => ({ ...prev, linkingErrorModal: null }));

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

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState((prev) => ({
                ...prev,
                supabaseUser: session?.user ?? null,
                isSupabaseLoading: false,
            }));
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setState((prev) => ({
                ...prev,
                supabaseUser: session?.user ?? null,
                isSupabaseLoading: false,
            }));
            if (session?.user) {
                const currentWallet = localStorage.getItem(walletStorageKey);
                if (currentWallet) {
                    linkWalletToGoogle(currentWallet, session.user);
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const linkWalletToGoogle = async (walletAddress: string, user: any) => {
        try {
            // Check if this wallet is already linked to someone else
            const { data: existingWallet, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('stellar_wallet', walletAddress)
                .maybeSingle();

            if (fetchError) {
                console.error("Fetch error:", fetchError);
            }

            if (existingWallet && existingWallet.google_id !== user.id) {
                await supabase.auth.signOut();
                setState(prev => ({ 
                    ...prev, 
                    connectionError: null, 
                    supabaseUser: null,
                    linkingErrorModal: "This wallet is already associated with another Google account. Please sign in with the original account or connect a different wallet." 
                }));
                return;
            }

            // Upsert the user profile
            const { error } = await supabase
                .from('users')
                .upsert({
                    google_id: user.id,
                    stellar_wallet: walletAddress,
                    email: user.email,
                    name: user.user_metadata?.full_name,
                    avatar_url: user.user_metadata?.avatar_url
                }, { onConflict: 'google_id' }); 
            
            if (error) {
                await supabase.auth.signOut();
                if (error.code === '23505') { 
                     setState(prev => ({ 
                         ...prev, 
                         connectionError: null,
                         supabaseUser: null,
                         linkingErrorModal: "This Google account is already linked to a different Stellar wallet. Please use the original Google account or connect a new wallet." 
                     }));
                } else {
                     setState(prev => ({ 
                         ...prev, 
                         connectionError: null,
                         supabaseUser: null,
                         linkingErrorModal: `Database Error: ${error.message} (Code: ${error.code}). If you enabled RLS, please disable it or add a policy.` 
                     }));
                }
            }
        } catch (err: any) {
            console.error("Exception during linking:", err);
            await supabase.auth.signOut();
            setState(prev => ({ 
                ...prev, 
                connectionError: null,
                supabaseUser: null,
                linkingErrorModal: `Unexpected Error: ${err.message}` 
            }));
        }
    };

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
            
            // Try linking right after wallet connect if user is already logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await linkWalletToGoogle(address, session.user);
            }
        } catch (error: any) {
            console.error("Failed to connect wallet:", error);
            
            let errorMessage = "Connection failed";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (error && typeof error === 'object' && 'message' in error) {
                errorMessage = String(error.message);
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            const isCancellation = errorMessage.toLowerCase().includes('close') || 
                                   errorMessage.toLowerCase().includes('reject') || 
                                   errorMessage.toLowerCase().includes('cancel');

            setState((prev) => ({ 
                ...prev, 
                isConnecting: false,
                connectionError: isCancellation ? null : errorMessage
            }));
        }
    };

    const disconnect = async () => {
        try {
            await StellarWalletsKit.disconnect();
            clearChitfundLocalState();
            setState(prev => ({
                ...prev,
                address: null,
                isConnecting: false,
                isConnected: false,
                network: Networks.TESTNET,
                connectionError: null,
            }));
        } catch (error) {
            console.error("Failed to disconnect wallet:", error);
        }
    };

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: typeof window !== "undefined" ? window.location.origin : undefined
            }
        });
    };

    const signOutGoogle = async () => {
        await supabase.auth.signOut();
    };

    return (
        <WalletContext.Provider value={{ ...state, connect, disconnect, signInWithGoogle, signOutGoogle, clearLinkingError }}>
            {children}
            {state.linkingErrorModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                    <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "16px", maxWidth: "420px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid var(--border)", textAlign: "center" }}>
                        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", marginBottom: "1rem" }}>Account Conflict</h2>
                        <p style={{ color: "var(--muted-fg)", marginBottom: "2rem", lineHeight: "1.6" }}>{state.linkingErrorModal}</p>
                        <button onClick={clearLinkingError} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", fontWeight: 600 }}>Got it</button>
                    </div>
                </div>
            )}
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
