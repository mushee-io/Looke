/** Non-destructive live Vercel alias check. Requires VERCEL_TOKEN; never uses POST/PATCH/PUT.
 * This is a technical observation, not a signed-out browser challenge or authorization.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {m27ReleaseRehearsal} from "../src/lib/beta/m27-evidence";
const PRODUCTION_ALIAS="looke-alpha.vercel.app";
const PINNED_DEPLOYMENT="dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG";
const PROJECT="prj_QXWBZ7UU1AtxXJ7XbckAwLrRZbdO";
async function main(){
 const token=process.env.VERCEL_TOKEN;
 const sha=process.env.LOOKE_M27_PREVIEW_SHA||process.env.VERCEL_GIT_COMMIT_SHA;
 if(!token||!sha||!/^[a-f0-9]{40}$/.test(sha))
  throw Error("Real Vercel read-only API token and exact 40-character Preview SHA are required.");
 const response=await fetch("https://api.vercel.com/v4/aliases/"+PRODUCTION_ALIAS+"?projectId="+PROJECT,{
  method:"GET",headers:{authorization:"Bearer "+token,accept:"application/json"},
  cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000),
 });
 if(!response.ok)throw Error("Vercel alias verification failed: HTTP "+response.status);
 const body=await response.json() as {alias?:{deploymentId?:string};deploymentId?:string};
 const deploymentId=body.alias?.deploymentId??body.deploymentId;
 if(!deploymentId||!/^dpl_[a-zA-Z0-9]+$/.test(deploymentId))
  throw Error("Actual Vercel alias deployment identity could not be validated.");
 const pinned=deploymentId===PINNED_DEPLOYMENT;
 const report=m27ReleaseRehearsal({
  flagsClosed:[
   "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED",
   "LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED",
   "LOOKE_M4_TRADING_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED",
   "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M24_INCIDENT_WRITES_ENABLED",
   "LOOKE_M25_REVIEW_WRITES_ENABLED","LOOKE_M26_WITNESS_WRITES_ENABLED",
  ].every(x=>process.env[x]!=="true"),
  publicBetaFlag:process.env.LOOKE_PUBLIC_BETA_ENABLED==="true",
  realKeyCount:0,roleWallets:[],providerStatus:null,pointsComplete:false,pointsIssues:0,
  recoveryMatches:false,humanRestoreWitness:false,externalAuditContentApproved:false,
  independentlyWitnessedHumans:false,assetsVerified:false,
  productionAliasMatches:pinned,incidentDrillObserved:false,
 });
 const output={milestone:"M27",readOnly:true,checkedAt:new Date().toISOString(),
  exactPreviewCommit:sha,alias:PRODUCTION_ALIAS,actualDeploymentId:deploymentId,
  expectedDeploymentId:PINNED_DEPLOYMENT,productionAliasPinned:pinned,
  snapshotOnly:true,realRollbackPerformed:false,
  signedOutSSOIndependentlyWitnessed:false,report};
 await mkdir("artifacts/m27",{recursive:true});
 await writeFile("artifacts/m27/release-rehearsal.json",JSON.stringify(output,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({alias:PRODUCTION_ALIAS,pinned,previewCommit:sha,
  status:report.decision,rollbackPerformed:false}));
 if(!pinned)process.exitCode=2;
}
main().catch(e=>{console.error("M27 read-only production rehearsal BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
