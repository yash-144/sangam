export interface WalletState {
    address: string | null;
    isConnecting: boolean;
    isConnected: boolean;
    network: string | null;
    connectionError: string | null;
}