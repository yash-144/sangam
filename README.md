# Stellar Chit Fund

A decentralized, trustless ROSCA (Rotating Savings and Credit Association) built on the Stellar network using Soroban smart contracts and a Next.js frontend.

## Features

- **Decentralized Pool**: Trustless pooling of funds using Soroban smart contracts.
- **Fair Random Winner**: A commit-reveal scheme ensures the winner of the pot each round is selected completely randomly and fairly, preventing organizer manipulation.
- **Cross-Contract Token Transfers**: Seamless integration with Stellar assets (e.g. USDC).

## Testnet Deployment

The smart contract is currently deployed on the Stellar Testnet.

- **Contract ID:** `CCHSYVP3YPWVVUCG6EPS2WTYPF4L6TLRXF4ZS7Z62PIEF5OIQJ36TMTR`
- **Asset ID (Dummy USDC):** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`

## Project Structure

- `contracts/chit-fund/`: The Soroban smart contract written in Rust.
- `frontend/`: The Next.js 16 (App Router) web application.

## Prerequisites

- Node.js (v18+)
- Rust (v1.74.1+) and Cargo
- Soroban CLI (`cargo install --locked stellar-cli --features opt`)
- Freighter Wallet (browser extension) installed and configured for Testnet.

## Running Locally

### 1. Frontend

Ensure you have your environment variables set up in `frontend/.env.local`.

```bash
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:3000` in your browser.

### 2. Smart Contract (Development)

To build and run tests for the smart contract:

```bash
cd contracts/chit-fund
cargo test
cargo build --target wasm32-unknown-unknown --release
```
