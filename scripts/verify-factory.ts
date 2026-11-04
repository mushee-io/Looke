import { readFile } from "node:fs/promises";
import { getAddress, keccak256, type Hex } from "viem";
import { assertAddress, createUltraPublicClient, verifyFactoryDeployment } from "../src/lib/verification";
import { ULTRA_EVM_TESTNET } from "../src/lib/ultra";

async function main() {
  const address = process.env.LOOKE_FACTORY_ADDRESS?.trim() ?? "";
  const deploymentHash = process.env.LOOKE_FACTORY_DEPLOY_TX?.trim() ?? "";
  assertAddress(address);
  const client = createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL ?? ULTRA_EVM_TESTNET.rpcUrls[0]);
  const verified = await verifyFactoryDeployment(client, address, deploymentHash);
  const artifactPath = "out/LookeCoinFactory.sol/LookeCoinFactory.json";
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as { deployedBytecode?: { object?: string } };
  const expected = artifact.deployedBytecode?.object;
  if (!expected || !/^0x[0-9a-f]+$/i.test(expected)) {
    throw new Error(`Missing valid runtime bytecode in ${artifactPath}. Run forge build first.`);
  }
  const observedHash = keccak256(verified.runtimeCode);
  const builtHash = keccak256(expected as Hex);
  if (observedHash !== builtHash) throw new Error("Deployed runtime bytecode does NOT match the locally compiled Looke factory.");
  console.log(JSON.stringify({
    status: "verified-testnet-factory",
    chainId: 18881,
    factory: getAddress(address),
    deploymentHash,
    confirmations: verified.confirmations,
    coinCount: verified.coinCount.toString(),
    runtimeCodeHash: observedHash,
    explorer: `${ULTRA_EVM_TESTNET.explorer}/tx/${deploymentHash}`,
  }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
