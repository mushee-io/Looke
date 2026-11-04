/** M13 one-shot, READ-ONLY onchain index health. No Vercel or wallet write. */
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";
import {indexCreatorLaunches} from "../src/lib/ops/m13-index";
import {mkdir,writeFile} from "node:fs/promises";

async function main(){
  const [rpc,index]=await Promise.all([collectLiveRpcEvidence(),indexCreatorLaunches()]);
  const report={milestone:"M13",observedAt:new Date().toISOString(),
    evmRpc:rpc.evm.status,nativeRpc:rpc.native.status,
    indexerStatus:index.status,finalizedFrom:index.fromBlock,
    finalizedThrough:index.throughBlock,nextCursor:index.nextCursor,
    confirmedLaunches:index.launches.length,complete:index.complete,
    errors:index.errors,publicBetaOpen:false,transactionsSent:0,
    note:"Bounded read-only observation, not a complete creator market index or public beta approval."};
  await mkdir("artifacts/m13",{recursive:true});
  await writeFile("artifacts/m13/index-health.json",JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(report,null,2));
  if(index.status!=="verified")console.log("::warning::M13 factory indexing is not operationally activated; no synthetic events were added.");
  if(process.argv.includes("--strict")&&index.status!=="verified")process.exitCode=2;
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Index proof unavailable.");process.exitCode=2;});
