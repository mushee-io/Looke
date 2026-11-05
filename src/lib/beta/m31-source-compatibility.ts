/** M31 real PostgreSQL compatibility classification; never provision or mutate a DB.
 * Distinguishes the connected legacy looke_* staging schema from the 19
 * current social_* acceptance/backup tables. Table names alone are insufficient:
 * verify original witness, moderation and accounting columns too.
 */
import type {PoolClient} from "pg";
import {allM27Tables} from "./m27-evidence";
export const requiredM31Tables=allM27Tables.map(x=>x[0]);
export const requiredSourceColumns:Readonly<Record<string,readonly string[]>>={
 social_profiles:["address","suspended"],
 social_posts:["id","author","media_status","hidden"],
 social_media_uploads:["id","owner","public_id","verified_url","state"],
 social_moderation_audit:["id","target_id","action"],
 social_points_ledger:["id","owner","status","points","source_id"],
 social_beta_wallet_challenges:["id","wallet","nonce","preview_sha","preview_origin","consumed_at"],
 social_beta_wallet_acceptances:["id","wallet","challenge_id","signature_sha256"],
 social_beta_evidence_signatures:["id","evidence_sha256","preview_sha"],
 social_beta_release_reviews:["id","preview_sha","evidence_id"],
 social_beta_release_witnesses:["id","review_id","preview_sha"],
};
export type DBColumn={table_name:string;column_name:string};
export function classifyM31Schema(rows:readonly DBColumn[]){
 const cols=new Map<string,Set<string>>();
 for(const r of rows){
  if(!/^[a-z_]+$/.test(r.table_name)||!/^[a-z_]+$/.test(r.column_name))
   continue; // Never interpolate or trust returned metadata as arbitrary SQL.
  if(!cols.has(r.table_name))cols.set(r.table_name,new Set());
  cols.get(r.table_name)!.add(r.column_name);
 }
 const tables=[...cols.keys()];
 const legacyTables=tables.filter(x=>x.startsWith("looke_")).length;
 const socialTables=tables.filter(x=>x.startsWith("social_")).length;
 const missingTables=requiredM31Tables.filter(x=>!cols.has(x));
 const missingColumns=Object.entries(requiredSourceColumns).flatMap(([table,fields])=>
  cols.has(table)?fields.filter(f=>!cols.get(table)!.has(f)).map(column=>table+"."+column):[]);
 const schemaCompatible=missingTables.length===0&&missingColumns.length===0;
 const status=schemaCompatible?"schema_compatible_unverified_records":
   socialTables===0&&legacyTables>0?"legacy_only_incompatible":
   socialTables===0?"missing_current_schema":"incomplete_current_schema";
 return {milestone:"M31" as const,status,requiredTables:19 as const,
  actualCurrentTables:requiredM31Tables.length-missingTables.length,
  legacyTables,socialTables,missingTables,missingColumns,
  schemaCompatible,realDataAccepted:false as const,
  humanAcceptanceVerified:false as const,
  databaseMutated:false as const,releaseDecision:"NO_GO" as const,
  note:"Read-only PostgreSQL information_schema column inspection. A matching schema does not prove actual source data, permissions for every query, an independent restored backup, human witness or go-live authorization.",
 };
}
export async function inspectM31Schema(db:Pick<PoolClient,"query">,enforceTLS=true){
 if(enforceTLS){
  const tls=await db.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
  if(tls.rows[0]?.ssl!==true)throw Error("Actual TLS PostgreSQL source is mandatory.");
 }
 const result=await db.query<DBColumn>(`
  SELECT table_name,column_name FROM information_schema.columns
  WHERE table_schema=current_schema() AND
    (left(table_name,7)='social_' OR left(table_name,6)='looke_')
  ORDER BY table_name,ordinal_position`);
 return classifyM31Schema(result.rows);
}
export function m31SourceDecision(input:{
 primarySchemaCompatible:boolean;restoreSchemaCompatible:boolean;
 providerCredentialsPresent:boolean;actualApprovedProviderRows:number;
 actualCreatorReceiptConfirmed:boolean;actualNativeUniqConfirmed:boolean;
 actualPointsSourcesReconciled:boolean;originalHumanWitnessesConfirmed:boolean;
 independentAuditFindingRetestsConfirmed:boolean;realHumanRestoreWitnessed:boolean;
 independentlyWitnessedRollback:boolean;releaseFlagsClosed:boolean;
}){
 const blockers=[
  ...(!input.primarySchemaCompatible?["current_19_table_primary_schema_missing_or_legacy_only"]:[]),
  ...(!input.restoreSchemaCompatible?["separately_restored_19_table_tls_schema_missing"]:[]),
  ...(!input.providerCredentialsPresent||input.actualApprovedProviderRows<1?
   ["authenticated_real_moderated_provider_assets_missing"]:[]),
  ...(!input.actualCreatorReceiptConfirmed?["canonical_creator_coin_receipt_missing"]:[]),
  ...(!input.actualNativeUniqConfirmed?["native_uniq_owner_evidence_missing"]:[]),
  ...(!input.actualPointsSourcesReconciled?["all_points_sources_not_independently_reconciled"]:[]),
  ...(!input.originalHumanWitnessesConfirmed?["distinct_real_people_not_witnessed"]:[]),
  ...(!input.independentAuditFindingRetestsConfirmed?["external_audit_findings_not_independently_retested"]:[]),
  ...(!input.realHumanRestoreWitnessed?["separately_restored_real_backup_human_witness_missing"]:[]),
  ...(!input.independentlyWitnessedRollback?["genuine_rollback_drill_unverified"]:[]),
  ...(!input.releaseFlagsClosed?["forbidden_release_flag_enabled"]:[]),
 ];
 return {milestone:"M31" as const,blocked: blockers,
  releaseDecision:"NO_GO" as const,publicBetaOpen:false as const,
  productionPromotionAllowed:false as const,
  socialMediaWritesEnabled:false as const,pointsAccountingEnabled:false as const,
  financialTransactionAllowed:false as const,tokenClaimsAllowed:false as const,
  privateMessagingEnabled:false as const,transactionsSent:0 as const,
  externallyVerifiedHumanApprovalAccepted:false as const,
  note:"Even genuine technical source checks do NOT autonomously permit beta or assert human identity.",
 };
}
