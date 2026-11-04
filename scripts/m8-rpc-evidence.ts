/**
 * Run one real read-only probe against Ultra EVM and Ultra native Testnet.
 * Never sign, send, mint, approve or fabricate a chain result.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";

async function main(){
  const data=await collectLiveRpcEvidence();
  const dir=resolve("artifacts/m8");
  await mkdir(dir,{recursive:true});
  await writeFile(resolve(dir,"rpc-evidence.json"),JSON.stringify(data,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(data,null,2));
  console.log("No wallet permission, signature, transaction, token creation, NFT mint or beta activation was performed.");
  if(!data.allVerified){
    console.log("::warning::One or more live RPC checks BLOCKED. See artifacts/m8/rpc-evidence.json.");
    if(process.argv.includes("--strict"))process.exitCode=2;
  }
}
main().catch(error=>{
  console.error("RPC evidence probe failed closed:",error instanceof Error?error.message:"Unknown");
  process.exitCode=2;
});
