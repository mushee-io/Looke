import { getAddress } from "viem";
import {
  assertAddress, assertConfirmations, assertHash, assertUltraTestnet, createUltraPublicClient,
  decodeCoinCreatedFromReceipt, verifyCreatedCoinState,
} from "../src/lib/verification";
import { ULTRA_EVM_TESTNET } from "../src/lib/ultra";

async function main() {
  const factory = process.env.LOOKE_FACTORY_ADDRESS?.trim() ?? "";
  const txHash = process.env.LOOKE_COIN_TX?.trim() ?? "";
  assertAddress(factory);
  assertHash(txHash);
  const client = createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL ?? ULTRA_EVM_TESTNET.rpcUrls[0]);
  await assertUltraTestnet(client);
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const confirmations = assertConfirmations(receipt.blockNumber, await client.getBlockNumber());
  const expectedCreator = process.env.LOOKE_EXPECTED_CREATOR?.trim();
  if (expectedCreator) assertAddress(expectedCreator);
  const event = decodeCoinCreatedFromReceipt(receipt, getAddress(factory), expectedCreator ? {
    creator: getAddress(expectedCreator),
    name: process.env.LOOKE_EXPECTED_NAME ?? "",
    symbol: process.env.LOOKE_EXPECTED_SYMBOL ?? "",
    metadataURI: process.env.LOOKE_EXPECTED_METADATA_URI ?? "",
    supply: BigInt(process.env.LOOKE_EXPECTED_SUPPLY_WEI ?? "0"),
  } : undefined);
  const state = await verifyCreatedCoinState(client, event);
  console.log(JSON.stringify({
    status: "verified-testnet-coin",
    chainId: 18881,
    transactionHash: txHash,
    confirmations,
    creator: state.creator,
    coin: state.address,
    name: event.name,
    symbol: event.symbol,
    metadataURI: state.metadataURI,
    totalSupplyBaseUnits: state.totalSupply.toString(),
    creatorBalanceBaseUnits: state.balance.toString(),
    explorer: `${ULTRA_EVM_TESTNET.explorer}/tx/${txHash}`,
  }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
