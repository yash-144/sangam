import { rpc } from '@stellar/stellar-sdk';

export const NETWORK = {
  passphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
};

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || '';
export const USDC_CONTRACT_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID || '';

let rpcServer: rpc.Server | null = null;

export function getRpcServer(): rpc.Server {
  if (!rpcServer) {
    rpcServer = new rpc.Server(NETWORK.rpcUrl);
  }
  return rpcServer;
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function stroopsToDisplay(stroops: number | bigint | string): string {
  const num = Number(stroops);
  if (isNaN(num)) return '0.00';
  return (num / 10000000).toFixed(2);
}

export function usdcToStroops(displayAmt: number | string): bigint {
  const num = Number(displayAmt);
  if (isNaN(num)) return BigInt(0);
  return BigInt(Math.floor(num * 10000000));
}
