import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { lookeCoinAbi, lookeCoinFactoryAbi } from "./coin-abi";
import { ULTRA_EVM_TESTNET } from "./ultra";

export const ULTRA_TESTNET_CHAIN_ID = 18881;
export const MIN_CONFIRMATIONS = 2;

export function createUltraPublicClient(rpcUrl: string = ULTRA_EVM_TESTNET.rpcUrls[0]) {
  return createPublicClient({ transport: http(rpcUrl, { timeout: 15_000 }), pollingInterval: 2_000 });
}

export type UltraPublicClient = ReturnType<typeof createUltraPublicClient>;

export function assertHash(hash: string): asserts hash is Hash {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Expected a 32-byte transaction hash.");
}

export function assertAddress(address: string): asserts address is Address {
  if (!isAddress(address) || /^0x0{40}$/i.test(address)) throw new Error("Expected a nonzero EVM address.");
}

export function assertConfirmations(receiptBlock: bigint, latestBlock: bigint, required = MIN_CONFIRMATIONS): number {
  if (latestBlock < receiptBlock) throw new Error("RPC returned a block before the receipt block.");
  const confirmations = latestBlock - receiptBlock + 1n;
  if (confirmations < BigInt(required)) throw new Error(`Receipt needs ${required} confirmations; has ${confirmations}.`);
  return Number(confirmations);
}

export async function assertUltraTestnet(client: UltraPublicClient): Promise<void> {
  const actualChain = await client.getChainId();
  if (actualChain !== ULTRA_TESTNET_CHAIN_ID) {
    throw new Error(`Wrong RPC network: expected Ultra EVM Testnet 18881, got ${actualChain}.`);
  }
}

export async function verifyFactoryDeployment(
  client: UltraPublicClient,
  factoryAddress: string,
  deploymentHash: string,
) {
  assertAddress(factoryAddress);
  assertHash(deploymentHash);
  await assertUltraTestnet(client);
  const receipt = await client.getTransactionReceipt({ hash: deploymentHash });
  if (receipt.status !== "success") throw new Error("Factory deployment reverted.");
  if (receipt.to !== null) throw new Error("Factory proof is not a contract-creation transaction.");
  if (!receipt.contractAddress || getAddress(receipt.contractAddress) !== getAddress(factoryAddress)) {
    throw new Error("Factory address does not match the deployment receipt.");
  }
  const [code, coinCount] = await Promise.all([
    client.getBytecode({ address: factoryAddress }),
    client.readContract({ address: factoryAddress, abi: lookeCoinFactoryAbi, functionName: "coinCount" }),
  ]);
  if (!code || code === "0x") throw new Error("Factory runtime code is missing.");
  const latestBlock = await client.getBlockNumber();
  const confirmations = assertConfirmations(receipt.blockNumber, latestBlock);
  return { address: getAddress(factoryAddress), transactionHash: deploymentHash, coinCount, confirmations, runtimeCode: code };
}

export type CreatedCoinEvent = {
  creator: Address;
  coin: Address;
  name: string;
  symbol: string;
  metadataURI: string;
  initialSupply: bigint;
  transactionHash: Hash;
};

export type ExpectedCoin = {
  creator: Address;
  name: string;
  symbol: string;
  metadataURI: string;
  supply: bigint;
};

export function decodeCoinCreatedFromReceipt(
  receipt: TransactionReceipt,
  factoryAddress: Address,
  expected?: ExpectedCoin,
): CreatedCoinEvent {
  if (receipt.status !== "success") throw new Error("Coin creation transaction reverted.");
  if (!receipt.to || getAddress(receipt.to) !== getAddress(factoryAddress)) {
    throw new Error("Transaction recipient is not the configured Looke factory.");
  }
  const found: CreatedCoinEvent[] = [];
  for (const log of receipt.logs) {
    if (getAddress(log.address) !== getAddress(factoryAddress)) continue;
    try {
      const decoded = decodeEventLog({
        abi: lookeCoinFactoryAbi,
        topics: log.topics,
        data: log.data,
        strict: true,
      });
      if (decoded.eventName !== "CoinCreated") continue;
      found.push({
        creator: getAddress(decoded.args.creator),
        coin: getAddress(decoded.args.coin),
        name: decoded.args.name,
        symbol: decoded.args.symbol,
        metadataURI: decoded.args.metadataURI,
        initialSupply: decoded.args.initialSupply,
        transactionHash: receipt.transactionHash,
      });
    } catch {
      // Other events from the factory are irrelevant; do not assume their meaning.
    }
  }
  if (found.length !== 1) throw new Error("Expected exactly one CoinCreated event from the configured factory.");
  const event = found[0];
  if (getAddress(receipt.from) !== event.creator) throw new Error("Creator does not match the transaction signer.");
  if (expected) {
    if (getAddress(expected.creator) !== event.creator) throw new Error("Creator does not match the connected wallet.");
    if (event.name !== expected.name || event.symbol !== expected.symbol ||
        event.metadataURI !== expected.metadataURI || event.initialSupply !== expected.supply) {
      throw new Error("Created coin details do not match the reviewed draft.");
    }
  }
  return event;
}

export async function verifyCreatedCoinState(client: UltraPublicClient, event: CreatedCoinEvent) {
  await assertUltraTestnet(client);
  const [code, creator, totalSupply, balance, metadataURI] = await Promise.all([
    client.getBytecode({ address: event.coin }),
    client.readContract({ address: event.coin, abi: lookeCoinAbi, functionName: "creator" }),
    client.readContract({ address: event.coin, abi: lookeCoinAbi, functionName: "totalSupply" }),
    client.readContract({ address: event.coin, abi: lookeCoinAbi, functionName: "balanceOf", args: [event.creator] }),
    client.readContract({ address: event.coin, abi: lookeCoinAbi, functionName: "metadataURI" }),
  ]);
  if (!code || code === "0x") throw new Error("Created token has no deployed bytecode.");
  if (getAddress(creator) !== event.creator || totalSupply !== event.initialSupply ||
      balance !== event.initialSupply || metadataURI !== event.metadataURI) {
    throw new Error("Created token's on-chain state does not match the factory event.");
  }
  return { address: event.coin, creator, totalSupply, balance, metadataURI };
}
