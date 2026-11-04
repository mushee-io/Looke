/**
 * Controlled read-only Ultra EVM + native Ultra acceptance.
 * Takes a local JSON file with public addresses and tx hashes. Never a private key.
 * Does not sign or broadcast. Do not store production secrets in this file.
 */
import {readFile} from "node:fs/promises";
import {parseProofManifest,summarizeProofs,type AcceptanceResult} from "../src/lib/ops/acceptance";
import {inspectEvmFactory,inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";

async function main(){
  const path=process.argv[2];
  if(!path)throw new Error("Usage: npm run m7:acceptance -- ./testnet-public-proofs.json");
  const raw=JSON.parse(await readFile(path,"utf8")) as unknown;
  const manifest=parseProofManifest(raw);
  const results:AcceptanceResult["results"]=[];
  const tasks=[
    {
      id:"factory" as const,
      check:async()=>{
        const p=await inspectEvmFactory(manifest.evmFactory.address,manifest.evmFactory.deploymentTx);
        if(p.confirmations<2)throw new Error("Factory receipt needs at least 2 confirmations.");
        return `Confirmed factory at ${p.address}; tx ${p.transactionHash}`;
      },
    },
    {
      id:"creatorCoin" as const,
      check:async()=>{
        const p=await inspectEvmCoin(manifest.evmFactory.address,manifest.creatorCoin.creationTx);
        if(p.confirmations<2||BigInt(p.totalSupply)<=0n)throw new Error("Creator coin proof was insufficient.");
        return `Confirmed creator coin ${p.coin}; tx ${p.txHash}`;
      },
    },
    {
      id:"nativeUniq" as const,
      check:async()=>{
        const p=await inspectNativeUniq(manifest.nativeUniq.factoryId,manifest.nativeUniq.owner,manifest.nativeUniq.tokenId);
        if(!p.irreversibleBlock)throw new Error("Native Uniq ownership is not irreversible.");
        return `Verified native Uniq #${p.tokenId} owned by ${p.owner} in factory #${p.factoryId}`;
      },
    },
  ];
  // Distinct RPC reads are independent; never infer successful proof from a tx-shaped hash alone.
  for(const task of tasks){
    try{results.push({id:task.id,status:"verified",reason:await task.check()});}
    catch(error){results.push({id:task.id,status:"blocked",reason:error instanceof Error?error.message:"RPC verification failed."});}
  }
  const report=summarizeProofs(results);
  process.stdout.write(JSON.stringify(report,null,2)+"\n");
  process.stdout.write("No wallet signing, transaction submission or beta activation was performed.\n");
  if(results.some(x=>x.status!=="verified"))process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
