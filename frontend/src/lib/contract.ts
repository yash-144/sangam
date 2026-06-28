import { Contract, TransactionBuilder, rpc, xdr, Address, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit";
import { NETWORK, CONTRACT_ID, getRpcServer } from "./stellar";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAccountNotFoundError(error: unknown) {
  return error instanceof Error && error.message.includes("Account not found");
}

async function fundTestnetAccount(address: string) {
  if (NETWORK.passphrase !== TESTNET_PASSPHRASE) {
    throw new Error("Connected wallet account was not found on the configured Stellar network.");
  }

  const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
  if (!response.ok) {
    throw new Error("Connected testnet wallet is not funded yet, and Friendbot could not fund it. Please fund it from the Stellar testnet Friendbot and try again.");
  }

  await wait(3000);
}

async function getAccountWithTestnetFunding(server: rpc.Server, address: string) {
  try {
    return await server.getAccount(address);
  } catch (error) {
    if (!isAccountNotFoundError(error)) throw error;

    await fundTestnetAccount(address);
    return server.getAccount(address);
  }
}

async function callContract(
  callerAddress: string,
  method: string,
  ...args: xdr.ScVal[]
) {
  const server = getRpcServer();
  
  // 1. Get the account sequence number
  const account = await getAccountWithTestnetFunding(server, callerAddress);
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
  const freshAccount = await getAccountWithTestnetFunding(server, callerAddress);

  // 5. Re-build the transaction with the fresh account + simulation footprint
  const resourceFee = simulated.minResourceFee ? (BigInt(simulated.minResourceFee) + BigInt(100000)).toString() : "1000";
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
  const { simulated } = await callContract(
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

  const account = await getAccountWithTestnetFunding(server, callerAddress).catch(() => null);
  
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

  return result ? normalizeFundSummary(scValToNative(result)) : null;
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

export interface FundConfig {
  organizer: string;
  token: string;
  name: string;
  contribution: bigint;
  member_count: number;
}

export interface FundSummary {
  config: FundConfig;
  state: ['Pending' | 'Active' | 'Completed'];
  members: string[];
  current_round: number;
  past_winners: string[];
}

function normalizeAddress(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    return value.toString();
  }
  return String(value);
}

function normalizeState(value: unknown): ['Pending' | 'Active' | 'Completed'] {
  if (Array.isArray(value) && typeof value[0] === "string") {
    return [value[0] as 'Pending' | 'Active' | 'Completed'];
  }
  if (typeof value === "string") {
    return [value as 'Pending' | 'Active' | 'Completed'];
  }
  return ["Pending"];
}

function normalizeFundSummary(raw: unknown): FundSummary {
  const data = raw as {
    config?: Partial<FundConfig>;
    state?: unknown;
    members?: unknown[];
    current_round?: number;
    past_winners?: unknown[];
  };

  return {
    config: {
      organizer: normalizeAddress(data.config?.organizer ?? ""),
      token: normalizeAddress(data.config?.token ?? ""),
      name: String(data.config?.name ?? ""),
      contribution: BigInt(data.config?.contribution ?? 0),
      member_count: Number(data.config?.member_count ?? 0),
    },
    state: normalizeState(data.state),
    members: (data.members ?? []).map(normalizeAddress),
    current_round: Number(data.current_round ?? 0),
    past_winners: (data.past_winners ?? []).map(normalizeAddress),
  };
}

export interface RoundSummary {
  deposit_count: number;
  commit_count: number;
  reveal_count: number;
}

export async function getRoundSummary(callerAddress: string, fundId: number, round: number): Promise<RoundSummary | null> {
  const server = getRpcServer();
  const contract = new Contract(CONTRACT_ID);

  const account = await getAccountWithTestnetFunding(server, callerAddress).catch(() => null);
  
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

export interface MemberStatus {
  has_deposited: boolean;
  has_committed: boolean;
  has_revealed: boolean;
}

export async function getMemberStatus(
  callerAddress: string,
  fundId: number,
  member: string,
  round: number
): Promise<MemberStatus> {
  const server = getRpcServer();
  const contract = new Contract(CONTRACT_ID);

  const account = await getAccountWithTestnetFunding(server, callerAddress).catch(() => null);
  if (!account) {
    return { has_deposited: false, has_committed: false, has_revealed: false };
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call(
      "get_member_status",
      nativeToScVal(fundId, { type: "u64" }),
      new Address(member).toScVal(),
      nativeToScVal(round, { type: "u32" })
    ))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    return { has_deposited: false, has_committed: false, has_revealed: false };
  }

  const result = rpc.Api.isSimulationSuccess(simulated)
    ? simulated.result?.retval
    : null;

  return result ? scValToNative(result) as unknown as MemberStatus
    : { has_deposited: false, has_committed: false, has_revealed: false };
}
