/** Assemble read-only protected-beta NO-GO evidence from an existing M21 probe.
 * Missing reports never become "passed". This does not call a release API.
 */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {assembleM21Report,defaultM21Gates,releaseFlagsClosed} from "../src/lib/ops/m21-acceptance";
import {deriveM22Readiness} from "../src/lib/beta/m22-readiness";

async function main(){
 let checks=defaultM21Gates(),observedM21=false;
 try{
  const doc=JSON.parse(await readFile("artifacts/m21/acceptance.json","utf8")) as {
   report?:{checks?:typeof checks};
  };
  if(doc.report?.checks){checks=doc.report.checks;observedM21=true;}
 }catch{/* No manifest -> every independent evidence gate remains blocked. */}
 const prior=assembleM21Report(checks);
 const flags=releaseFlagsClosed(process.env);
 const report=deriveM22Readiness({m21:prior,flagsClosed:flags});
 const output={milestone:"M22",observedAt:new Date().toISOString(),
  sourceM21ProbeObserved:observedM21,
  report,publicBetaActivated:false,liveTradesEnabled:false,
  tokenClaimsEnabled:false,privateMessagingEnabled:false,transactionsSent:0};
 await mkdir("artifacts/m22",{recursive:true});
 await writeFile("artifacts/m22/preflight.json",JSON.stringify(output,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({milestone:"M22",releaseDecision:report.releaseDecision,
  m21Verified:report.m21Verified,m21Total:report.m21Total,blockers:report.blockers,
  flagsClosed:flags,artifact:"artifacts/m22/preflight.json",transactionsSent:0},null,2));
 if(!flags)process.exitCode=2;
}
main().catch(e=>{console.error("M22 preflight BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
