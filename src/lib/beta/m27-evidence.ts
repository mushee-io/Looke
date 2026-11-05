/** M27 complete-source, evidence-only operational acceptance. No financial or release writes. */
import type {PoolClient} from "pg";
import {completeTables as m26Tables} from "./m26-acceptance";
import {digestFullDatabase,compareFullDatabase,type FullTableDigest} from "./m24-full-restore";
import {reconcileApproved,type Drift} from "../social/m20-reconcile";

export const allM27Tables=[...m26Tables,["social_beta_release_witnesses","id"]] as const;
export async function digestM27Database(c:Pick<PoolClient,"query">,tls=false){
 return digestFullDatabase(c,{tableSpec:allM27Tables,enforceTLS:tls,
  pageSize:100,maxRowsPerTable:100000});
}
export function compareM27Databases(a:FullTableDigest[],b:FullTableDigest[]){
 return compareFullDatabase(a,b,allM27Tables);
}
/** Iterate EVERY approved Points entry inside a single consistent read-only snapshot.
 * On exceeding the cap, abort rather than calling a partial scan "complete".
 */
export async function reconcileEntirePointsLedger(c:Pick<PoolClient,"query">,options:{
 batchSize?:number;maxRows?:number;
}={}){
 const batchSize=options.batchSize??100,maxRows=options.maxRows??20000;
 if(!Number.isInteger(batchSize)||batchSize<1||batchSize>500||
    !Number.isInteger(maxRows)||maxRows<1||maxRows>200000)
  throw Error("Invalid bounded complete Points scan configuration.");
 await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 try{
  const check=await c.query<{transaction_read_only:string}>("SHOW transaction_read_only");
  if(check.rows[0]?.transaction_read_only!=="on")throw Error("Read-only source snapshot not established.");
  const totals=await c.query<{total:number}>(`
   SELECT count(*)::integer AS total FROM social_points_ledger WHERE status='approved'`);
  const total=totals.rows[0]?.total;
  if(!Number.isInteger(total)||total<0||total>maxRows)
   throw Error("Approved Points exceed the configured full-scan ceiling.");
  let offset=0;
  const issues:Drift[]=[];
  while(offset<total){
   const page=await reconcileApproved(c,Math.min(batchSize,total-offset),offset);
   if(page.totalApproved!==total||page.scanned!==Math.min(batchSize,total-offset))
    throw Error("Source ledger changed during full read-only scan.");
   issues.push(...page.issues);
   offset+=page.scanned;
  }
  await c.query("COMMIT");
  return {scanned:offset,totalApproved:total,complete:offset===total,
   issues,status:issues.length?"attention":total?"source_reconciled":"no_approved_points",
   independentAntiSybilHumanApproval:false as const,
   tokenClaimsEnabled:false as const,
   note:"ALL approved source entries were checked against current eligibility in a read-only snapshot; does not prove uniqueness, reviewer independence or approve token claims."};
 }catch(e){await c.query("ROLLBACK");throw e;}
}
export function m27ReleaseRehearsal(input:{
 flagsClosed:boolean;publicBetaFlag:boolean;realKeyCount:number;roleWallets:string[];
 providerStatus:string|null;pointsComplete:boolean;pointsIssues:number;
 recoveryMatches:boolean;humanRestoreWitness:boolean;externalAuditContentApproved:boolean;
 independentlyWitnessedHumans:boolean;assetsVerified:boolean;
 productionAliasMatches:boolean;incidentDrillObserved:boolean;
}){
 const blockers:string[]=[];
 if(!input.flagsClosed||input.publicBetaFlag)blockers.push("release_feature_flags_not_proven_closed");
 if(input.realKeyCount<2)blockers.push("two_actual_wallet_key_witnesses_missing");
 if(new Set(input.roleWallets.map(x=>x.toLowerCase())).size<2)blockers.push("two_independent_signer_keys_missing");
 if(input.providerStatus!=="verified")blockers.push("hosted_media_provider_not_independently_verified");
 if(!input.pointsComplete||input.pointsIssues>0)blockers.push("full_source_points_integrity_unverified");
 if(!input.recoveryMatches)blockers.push("nineteen_table_technical_restore_missing");
 if(!input.productionAliasMatches)blockers.push("pinned_production_alias_not_verified");
 if(!input.assetsVerified)blockers.push("real_creator_coin_and_uniq_proofs_missing");
 if(!input.incidentDrillObserved)blockers.push("real_rollback_rehearsal_unverified");
 if(!input.humanRestoreWitness)blockers.push("independent_restore_human_witness_missing");
 if(!input.externalAuditContentApproved)blockers.push("actual_security_audit_findings_unverified");
 if(!input.independentlyWitnessedHumans)blockers.push("two_independent_humans_unverified");
 return {
  milestone:"M27" as const,
  decision:"NO_GO" as const,publicBetaOpen:false as const,
  allowProductionPromotion:false as const,allowSocialWrites:false as const,
  allowMediaWrites:false as const,allowPointsAccounting:false as const,
  allowTokenMinting:false as const,allowTokenClaims:false as const,
  allowFinancialBroadcast:false as const,allowPrivateMessaging:false as const,
  transactionsSent:0 as const,
  blockers,recordedTechnicalObservationsOnly:true,
  humanReleaseAuthorizationAccepted:false as const,
  note:"Simulation and technical evidence only. This service has no GO transition. No independent human decision is inferred from supplied fields.",
 };
}
