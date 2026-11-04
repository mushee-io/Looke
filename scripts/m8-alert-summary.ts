/**
 * One-time CI diagnostics, NOT a recurring schedule.
 * Generates Actions annotations; does not send network webhooks or create issues.
 */
import {readFile} from "node:fs/promises";
import type {RpcEvidence} from "../src/lib/ops/m8-probe";
import {evaluateAlerts,githubAnnotations} from "../src/lib/ops/m8-alerts";
async function main(){
  let rpc:RpcEvidence|null=null;
  try{rpc=JSON.parse(await readFile("artifacts/m8/rpc-evidence.json","utf8")) as RpcEvidence;}
  catch{/* Missing evidence stays blocked */}
  const alerts=evaluateAlerts(rpc,null,false);
  for(const line of githubAnnotations(alerts))console.log(line);
  console.log(JSON.stringify({
    stage:"operator-pre-acceptance",publicBetaOpen:false,
    protectedStagingVerified:false,alerts,
  },null,2));
  console.log("No scheduled build, webhook or deployment mutation was started.");
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
