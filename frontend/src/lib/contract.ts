import { Contract, TransactionBuilder, rpc, xdr, Address, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
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

  // 4. Assemble the final transaction with simulation results
  const prepared = rpc.assembleTransaction(tx, simulated).build();

  // 5. Sign with wallet
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(
    prepared.toXDR(),
    { networkPassphrase: NETWORK.passphrase }
  );

  // 6. Submit
  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK.passphrase);
  const response = await server.sendTransaction(signedTx);

  if (response.status === "ERROR") {
    throw new Error(`Transaction submission failed`);
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

  return status;
}

export async function createChitFund(
  organizer: string,
  token: string,
  name: string,
  contribution: bigint | number,
  memberCount: number
) {
  return callContract(
    organizer,
    "create_fund",
    new Address(organizer).toScVal(),
    new Address(token).toScVal(),
    nativeToScVal(name, { type: "string" }),
    nativeToScVal(contribution, { type: "i128" }),
    nativeToScVal(memberCount, { type: "u32" })
  );
}

export async function joinFund(member: string) {
  return callContract(
    member,
    "join_fund",
    new Address(member).toScVal()
  );
}

export async function activateFund(organizer: string) {
  return callContract(
    organizer,
    "activate_fund",
    new Address(organizer).toScVal()
  );
}

export async function getFundSummary() {
  const server = getRpcServer();
  const contract = new Contract(CONTRACT_ID);

  // For a read-only simulation, we can use a dummy account
  const source = "GA7QYNF7SOWQ3GLR2B6RS22RCFZRT6ZBDFG2ZRXEQMACQES5R4VKDPNC";
  const account = await server.getAccount(source).catch(() => null);
  
  if (!account) {
    throw new Error("Could not fetch dummy account for simulation");
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(contract.call("get_fund_summary"))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const result = rpc.Api.isSimulationSuccess(simulated) 
    ? simulated.result.retval 
    : null;

  return result ? scValToNative(result) : null;
}
