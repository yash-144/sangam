import { Contract, TransactionBuilder, rpc, xdr, Address, scValToNative, nativeToScVal, hash } from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit";
import { NETWORK, CONTRACT_ID, getRpcServer } from "./stellar";

async function callContract(
  callerAddress: string,
  method: string,
  ...args: xdr.ScVal[]
) {
  const server = getRpcServer();
  
  // 1. Get the account sequence number
  const account = await server.getAccount(callerAddress);
  const contract = new Contract(CONTRACT_ID);

  // 2. Build the transaction
  const tx = new TransactionBuilder(account, {
    fee: "1000", // Start with a low fee, simulation will calculate the real cost
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // 3. Simulate (get the footprint and resource estimates)
  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  // 4. Re-fetch account for a fresh sequence number (avoids txBadSeq after prior txs)
  const freshAccount = await server.getAccount(callerAddress);

  // 5. Re-build the transaction with the fresh account + simulation footprint
  const resourceFee = simulated.minResourceFee ? (BigInt(simulated.minResourceFee) + 100000n).toString() : "1000";
  const freshTx = new TransactionBuilder(freshAccount, {
    fee: resourceFee,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = rpc.assembleTransaction(freshTx, simulated).build();

  // 6. Sign with wallet
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(
    prepared.toXDR(),
    { networkPassphrase: NETWORK.passphrase }
  );

  // 7. Submit
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(signedTx);

  if (response.status === "ERROR") {
    console.error("Tx Submit Error:", response);
    throw new Error(`Transaction submission failed: ${JSON.stringify(response)}`);
  }

  // 7. Poll for completion
  let status = await server.getTransaction(response.hash);
  let retries = 0;
  while (status.status === "NOT_FOUND" && retries < 15) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = await server.getTransaction(response.hash);
    retries++;
  }

  if (status.status === "FAILED") {
    throw new Error("Transaction failed on-chain");
  }
  
  if (status.status === "NOT_FOUND") {
    throw new Error("Transaction took too long to confirm. Please try again.");
  }

  return { status, simulated };
}

export async function createChitFund(
  organizer: string,
  token: string,
  name: string,
  contribution: bigint | number,
  memberCount: number
) {
  const { status, simulated } = await callContract(
    organizer,
    "create_fund",
    new Address(organizer).toScVal(),
    new Address(token).toScVal(),
    nativeToScVal(name, { type: "string" }),
    nativeToScVal(contribution, { type: "i128" }),
    nativeToScVal(memberCount, { type: "u32" })
  );
  
  if (rpc.Api.isSimulationSuccess(simulated) && simulated.result?.retval) {
    return scValToNative(simulated.result.retval);
  }
  
  throw new Error("Could not extract fund ID from simulation");
}

export function formatFundState(state: number): string {
  if (state === 0) return "Pending";
  if (state === 1) return "Active";
  if (state === 2) return "Completed";
  return "Unknown";
}

export async function joinFund(member: string, fundId: number) {
  return callContract(
    member,
    "join_fund",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(member).toScVal()
  );
}

export async function activateFund(organizer: string, fundId: number) {
  return callContract(
    organizer,
    "activate_fund",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(organizer).toScVal()
  );
}

export async function getFundSummary(callerAddress: string, fundId: number) {
  const server = getRpcServer();
  const contract = new Contract(CONTRACT_ID);

  const account = await server.getAccount(callerAddress).catch(() => null);
  
  if (!account) {
    throw new Error("Could not fetch account for simulation");
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call("get_fund_summary", nativeToScVal(fundId, { type: "u64" })))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    if (simulated.error.includes("UnreachableCodeReached") || simulated.error.includes("InvalidAction")) {
      return null;
    }
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const result = rpc.Api.isSimulationSuccess(simulated) 
    ? simulated.result?.retval 
    : null;

  return result ? scValToNative(result) : null;
}

export async function deposit(member: string, fundId: number, amount: bigint | number) {
  return callContract(
    member,
    "deposit",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(member).toScVal(),
    nativeToScVal(amount, { type: "i128" })
  );
}

function hexToUint8Array(hexString: string) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

function toScValBytesN32(hexString: string): xdr.ScVal {
  const bytes = hexToUint8Array(hexString);
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

export async function commitHash(member: string, fundId: number, hashHex: string) {
  return callContract(
    member,
    "commit_hash",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(member).toScVal(),
    toScValBytesN32(hashHex)
  );
}

export async function revealHash(member: string, fundId: number, secretHex: string) {
  return callContract(
    member,
    "reveal_hash",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(member).toScVal(),
    toScValBytesN32(secretHex)
  );
}

export async function claimPot(winner: string, fundId: number) {
  return callContract(
    winner,
    "claim_pot",
    nativeToScVal(fundId, { type: "u64" }),
    new Address(winner).toScVal()
  );
}

export interface FundSummary {
  config: FundConfig;
  state: ['Pending' | 'Active' | 'Completed'];
  members: string[];
  current_round: number;
}

export interface RoundSummary {
  deposit_count: number;
  commit_count: number;
  reveal_count: number;
}

export async function getRoundSummary(callerAddress: string, fundId: number, round: number): Promise<RoundSummary | null> {
  const server = getRpcServer();
  const contract = new Contract(CONTRACT_ID);

  const account = await server.getAccount(callerAddress).catch(() => null);
  
  if (!account) {
    throw new Error("Could not fetch account for simulation");
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call("get_round_summary", nativeToScVal(fundId, { type: "u64" }), nativeToScVal(round, { type: "u32" })))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    if (simulated.error.includes("UnreachableCodeReached") || simulated.error.includes("InvalidAction")) {
      return null;
    }
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const result = rpc.Api.isSimulationSuccess(simulated) 
    ? simulated.result?.retval 
    : null;

  return result ? scValToNative(result) as unknown as RoundSummary : null;
}
