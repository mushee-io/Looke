import { formatEther, getAddress } from "viem";
import { assertAddress, assertUltraTestnet, createUltraPublicClient } from "../src/lib/verification";
import { ULTRA_EVM_TESTNET } from "../src/lib/ultra";

async function main() {
  const rpc = process.env.ULTRA_EVM_RPC_URL ?? ULTRA_EVM_TESTNET.rpcUrls[0];
  const client = createUltraPublicClient(rpc);
  await assertUltraTestnet(client);
  const [block, gasPrice] = await Promise.all([client.getBlockNumber(), client.getGasPrice()]);
  console.log(`Ultra EVM Testnet (18881) RPC OK. Latest block: ${block}. Gas price: ${gasPrice} wei.`);
  const address = process.env.LOOKE_DEPLOYER_ADDRESS?.trim();
  if (address) {
    assertAddress(address);
    const balance = await client.getBalance({ address: getAddress(address) });
    console.log(`Deployer ${getAddress(address)} has ${formatEther(balance)} test UOS available.`);
    if (balance === 0n) throw new Error("Deployer has zero test UOS for gas.");
  } else {
    console.log("Set LOOKE_DEPLOYER_ADDRESS to check test UOS before deployment.");
  }
  console.log("Read-only preflight: no signing or broadcasting performed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
