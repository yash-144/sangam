import { User } from '@supabase/supabase-js';

export interface WalletState {
    address: string | null;
    isConnecting: boolean;
    isConnected: boolean;
    network: string | null;
    connectionError: string | null;
    supabaseUser: User | null;
    isSupabaseLoading: boolean;
    linkingErrorModal: string | null;
}