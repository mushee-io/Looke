import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeAbiParameters, encodeEventTopics, getAddress, type Address, type Hash, type TransactionReceipt } from "viem";
import { lookeCoinFactoryAbi } from "../src/lib/coin-abi";
import {
  assertAddress, assertConfirmations, assertHash, decodeCoinCreatedFromReceipt,
  verifyFactoryDeployment, type UltraPublicClient,
} from "../src/lib/verification";

const FACTORY = getAddress("0x1234567890123456789012345678901234567890");
const CREATOR = getAddress("0x2345678901234567890123456789012345678901");
const COIN = getAddress("0x3456789012345678901234567890123456789012");
const HASH = ("0x" + "a".repeat(64)) as Hash;

function makeReceipt(overrides: Record<string, unknown> = {}): TransactionReceipt {
  const topics = encodeEventTopics({
    abi: lookeCoinFactoryAbi,
    eventName: "CoinCreated",
    args: { creator: CREATOR, coin: COIN },
  });
  const data = encodeAbiParameters(
    [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }],
    ["Ultra Cat", "UCAT", "ipfs://meta", 1_000n],
  );
  return {
    status: "success",
    to: FACTORY,
    from: CREATOR,
    transactionHash: HASH,
    blockNumber: 12n,
    logs: [{ address: FACTORY, topics, data }],
    ...overrides,
  } as unknown as TransactionReceipt;
}

const expected = {
  creator: CREATOR,
  name: "Ultra Cat",
  symbol: "UCAT",
  metadataURI: "ipfs://meta",
  supply: 1_000n,
};

test("decodes exactly one event from the expected factory and creator", () => {
  const event = decodeCoinCreatedFromReceipt(makeReceipt(), FACTORY, expected);
  assert.equal(event.coin, COIN);
  assert.equal(event.initialSupply, 1_000n);
  assert.equal(event.transactionHash, HASH);
});

test("rejects reverted coin creation", () => {
  assert.throws(() => decodeCoinCreatedFromReceipt(makeReceipt({ status: "reverted" }), FACTORY), /reverted/);
});
test("rejects receipt sent to a different contract", () => {
  assert.throws(() => decodeCoinCreatedFromReceipt(makeReceipt({ to: COIN }), FACTORY), /recipient/);
});
test("rejects a fake event from a different emitting address", () => {
  const receipt = makeReceipt();
  receipt.logs[0].address = COIN;
  assert.throws(() => decodeCoinCreatedFromReceipt(receipt, FACTORY), /exactly one/);
});
test("rejects wrong creator or mismatched reviewed supply", () => {
  assert.throws(() => decodeCoinCreatedFromReceipt(makeReceipt(), FACTORY, { ...expected, creator: COIN }), /creator/i);
  assert.throws(() => decodeCoinCreatedFromReceipt(makeReceipt(), FACTORY, { ...expected, supply: 2_000n }), /reviewed/);
});
test("rejects duplicate CoinCreated logs to avoid ambiguous receipts", () => {
  const receipt = makeReceipt();
  receipt.logs.push(receipt.logs[0]);
  assert.throws(() => decodeCoinCreatedFromReceipt(receipt, FACTORY), /exactly one/);
});
test("checks addresses, hashes and finality", () => {
  assert.equal(assertConfirmations(10n, 11n), 2);
  assert.throws(() => assertConfirmations(10n, 10n), /confirmations/);
  assert.throws(() => assertConfirmations(11n, 10n), /RPC returned/);
  assert.throws(() => assertAddress("0x" + "0".repeat(40)), /nonzero/);
  assert.throws(() => assertHash("0x1234"), /32-byte/);
});

function mockClient(opts: { chain?: number; code?: `0x${string}`; deployment?: Address; status?: "success" | "reverted"; latest?: bigint } = {}) {
  return {
    getChainId: async () => opts.chain ?? 18881,
    getTransactionReceipt: async () => ({
      status: opts.status ?? "success",
      to: null,
      contractAddress: opts.deployment ?? FACTORY,
      blockNumber: 10n,
    }),
    getBytecode: async () => opts.code ?? "0x60006000",
    readContract: async () => 0n,
    getBlockNumber: async () => opts.latest ?? 11n,
  } as unknown as UltraPublicClient;
}

test("factory receipt and deployed runtime code must agree on testnet", async () => {
  const valid = await verifyFactoryDeployment(mockClient(), FACTORY, HASH);
  assert.equal(valid.coinCount, 0n);
  assert.equal(valid.confirmations, 2);
  await assert.rejects(() => verifyFactoryDeployment(mockClient({ chain: 1 }), FACTORY, HASH), /Wrong RPC/);
  await assert.rejects(() => verifyFactoryDeployment(mockClient({ code: "0x" }), FACTORY, HASH), /runtime code/);
  await assert.rejects(() => verifyFactoryDeployment(mockClient({ deployment: COIN }), FACTORY, HASH), /does not match/);
  await assert.rejects(() => verifyFactoryDeployment(mockClient({ status: "reverted" }), FACTORY, HASH), /reverted/);
  await assert.rejects(() => verifyFactoryDeployment(mockClient({ latest: 10n }), FACTORY, HASH), /confirmations/);
});
