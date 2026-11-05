/** M32: read-only planning for the *real* legacy Looke PostgreSQL lineage.
 * A similarity in column names is never permission to transfer identities,
 * sessions, posts, moderated media, claims or wallet evidence.
 */
import type {PoolClient} from "pg";
import {classifyM31Schema, type DBColumn} from "./m31-source-compatibility";

export const legacyM32Mappings=[
 {table:"looke_profiles",successor:"social_profiles",required:["id","evm_address","created_at"],policy:"wallet_reauthentication_required"},
 {table:"looke_posts",successor:"social_posts",required:["id","profile_id","text","moderation_status"],policy:"owner_and_moderation_reapproval"},
 {table:"looke_post_media",successor:"social_media_uploads",required:["id","owner_profile_id","cloud_public_id","status"],policy:"original_provider_and_moderation_proof"},
 {table:"looke_sessions",successor:"social_sessions",required:["token_hash","profile_id","expires_at"],policy:"sessions_must_not_transfer"},
 {table:"looke_challenges",successor:"social_auth_challenges",required:["id","evm_address","message","consumed_at"],policy:"nonces_must_not_transfer"},
 {table:"looke_coin_events",successor:"social_creator_events",required:["tx_hash","log_index","coin_address","block_number"],policy:"independent_chain_receipt_required"},
 {table:"looke_post_reports",successor:"social_reports",required:["id","post_id","reason"],policy:"independent_moderation_review_required"},
 {table:"looke_participation_snapshots",successor:"social_points_ledger",required:[],policy:"never_convert_legacy_points_automatically"},
 {table:"looke_uniq_item_drafts",successor:"social_posts",required:[],policy:"native_uniq_drafts_are_not_minted_assets"},
] as const;
export type M32Scan=ReturnType<typeof classifyM32Legacy>;
export function classifyM32Legacy(rows:readonly DBColumn[],rawCounts:Readonly<Record<string,number>>={}){
 const metadata=new Map<string,Set<string>>();
 for(const r of rows){
  if(!/^[a-z_][a-z0-9_]*$/.test(r.table_name)||!/^[a-z_][a-z0-9_]*$/.test(r.column_name)) continue;
  if(!metadata.has(r.table_name))metadata.set(r.table_name,new Set());
  metadata.get(r.table_name)!.add(r.column_name);
 }
 const current=classifyM31Schema(rows);
 const mappings=legacyM32Mappings.map(m=>{
  const columns=metadata.get(m.table);
  const missingColumns=m.required.filter(c=>!columns?.has(c));
  const count=rawCounts[m.table];
  const rowCount=columns&&Number.isSafeInteger(count)&&count>=0?count:null;
  return {legacyTable:m.table,currentTable:m.successor,exists:!!columns,
   missingColumns,rowCount,policy:m.policy,autoTransferAllowed:false as const};
 });
 const legacyTotal=[...metadata.keys()].filter(x=>x.startsWith("looke_")).length;
 const malformedCounts=Object.entries(rawCounts).filter(([table,value])=>
   !legacyM32Mappings.some(m=>m.table===table)||!Number.isSafeInteger(value)||value<0);
 const blockers=[
  ...(legacyTotal===0?["legacy_source_schema_missing"]:[]),
  ...(mappings.some(m=>m.exists&&m.missingColumns.length>0)?["legacy_source_columns_incompatible"]:[]),
  ...(malformedCounts.length?["untrusted_aggregate_counts"]:[]),
  ...(!current.schemaCompatible?["complete_current_19_table_schema_unverified"]:[]),
  "wallet_identity_and_human_consents_unverified",
  "original_hosted_media_and_moderation_unverified",
  "independent_chain_and_uniq_proofs_unverified",
  "separate_verified_restore_and_audit_absent",
 ];
 return {milestone:"M32" as const,
  status:legacyTotal===0?"no_legacy_schema":current.schemaCompatible?"current_schema_present_not_accepted":"legacy_requires_manual_reconciliation",
  observedLegacyTables:legacyTotal,observedCurrentTables:current.actualCurrentTables,
  currentSchemaCompatible:current.schemaCompatible,mappings,blockers,
  copiedRecords:0 as const,recordsApproved:0 as const,sessionTokensTransferred:0 as const,
  walletSignaturesVerified:0 as const,migrationsExecuted:0 as const,
  releaseDecision:"NO_GO" as const,publicBetaOpen:false as const,
  noAutomaticTransfer:true as const};
}
export function requireDistinctM32Sources(legacyUrl:string,currentUrl:string){
 const a=new URL(legacyUrl),b=new URL(currentUrl);
 if(!["postgres:","postgresql:"].includes(a.protocol)||!["postgres:","postgresql:"].includes(b.protocol))
  throw Error("PostgreSQL sources required.");
 if(a.hostname.toLowerCase()===b.hostname.toLowerCase()&&
    (a.port||"5432")===(b.port||"5432")&&
    decodeURIComponent(a.pathname)===decodeURIComponent(b.pathname))
  throw Error("Legacy and current sources must be separate databases, not different logins to one database.");
}
export async function inspectM32RealSource(db:Pick<PoolClient,"query">,enforceTLS=true){
 if(enforceTLS){
  const ssl=await db.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
  if(ssl.rows[0]?.ssl!==true)throw Error("A genuine encrypted PostgreSQL session is mandatory.");
 }
 await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 try{
  const readOnly=await db.query<{transaction_read_only:string}>("SHOW transaction_read_only");
  if(readOnly.rows[0]?.transaction_read_only!=="on")throw Error("Read-only PostgreSQL transaction was not established.");
  const result=await db.query<DBColumn>(
   "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() "+
   "AND (left(table_name,6)='looke_' OR left(table_name,7)='social_') ORDER BY table_name,ordinal_position");
  const known=new Set(result.rows.map(x=>x.table_name));
  const counts:Record<string,number>={};
  for(const m of legacyM32Mappings){
   if(!known.has(m.table))continue;
   // Names are from this compiled constant allowlist, not query parameters.
   const count=await db.query<{total:number}>('SELECT count(*)::integer AS total FROM "'+m.table+'"');
   const value=count.rows[0]?.total;
   if(!Number.isSafeInteger(value)||value<0)throw Error("Unsafe legacy aggregate result.");
   counts[m.table]=value;
  }
  const report=classifyM32Legacy(result.rows,counts);
  await db.query("COMMIT");
  return report;
 }catch(e){
  await db.query("ROLLBACK");
  throw e;
 }
}
export function compareM32Sources(legacy:M32Scan|null,current:M32Scan|null){
 return {milestone:"M32" as const,legacyConnected:!!legacy,currentConnected:!!current,
  legacyTables:legacy?.observedLegacyTables??0,
  currentTables:current?.observedCurrentTables??0,
  currentSchemaCompatible:current?.currentSchemaCompatible===true,
  observedLegacyRows:legacy?.mappings.filter(m=>m.rowCount!==null)
   .reduce((n,m)=>n+(m.rowCount??0),0)??0,
  legacyDataVerified:!!legacy, // source observation, NOT identity/ownership acceptance
  realUsersMigrated:0 as const,approvedMediaMigrated:0 as const,
  releaseDecision:"NO_GO" as const,publicBetaOpen:false as const,
  readyToMigrate:false as const,
  blockers:[
   ...(!legacy?["authorized_legacy_tls_source_missing"]:[]),
   ...(!current?["authorized_current_tls_source_missing"]:[]),
   ...(!current?.currentSchemaCompatible?["current_19_table_social_schema_missing_or_incomplete"]:[]),
   "original_wallet_consent_and_account_reauthentication_missing",
   "separate_restored_backup_audit_and_moderator_approval_missing",
   "explicit_migration_plan_review_and_operator_approval_required",
  ]};
}
