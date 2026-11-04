/** One-time read-only crosscheck; no fake fallback or scheduled monitoring. */
import {mkdir,writeFile} from "node:fs/promises";
import {collectDualRpcProof} from "../src/lib/ops/m10-crosscheck";

async function main(){
  const proof=await collectDualRpcProof();
  await mkdir("artifacts/m10",{recursive:true});
  await writeFile("artifacts/m10/dual-rpc.json",JSON.stringify(proof,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(proof,null,2));
  console.log("Independent crosschecks only; no wallet signatures, transactions or beta release.");
  if(!proof.allVerified){
    console.log("::warning::Independent dual-RPC evidence missing or conflicting; M10 acceptance BLOCKED.");
    if(process.argv.includes("--strict"))process.exitCode=2;
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
