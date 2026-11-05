/** M22 read-only PostgreSQL backup/restore comparison.
 * A successful comparison is NEVER an operator witness or backup provenance proof.
 */
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
const sourceTables=[
 ["social_profiles","address"],["social_posts","id"],["social_media_uploads","id"],
 ["social_moderation_audit","id"],["social_points_ledger","id"],
 ["social_activity_index","kind,source_id"],["social_index_runs","id"],
 ["social_risk_review_events","id"],
] as const;
export function validateRestorePair(primary:string|undefined,restored:string|undefined){
 if(!primary||!restored)throw Error("Primary and separately restored database URLs are required.");
 const a=new URL(primary),b=new URL(restored);
 for(const u of [a,b]){
  if(!["postgresql:","postgres:"].includes(u.protocol)||
     !u.hostname||!u.pathname.slice(1)||
     !["verify-full","verify-ca"].includes(u.searchParams.get("sslmode")||""))
   throw Error("Restore verification requires an actual separate TLS-verified PostgreSQL endpoint.");
 }
 if(a.hostname.toLowerCase()===b.hostname.toLowerCase()&&
    a.port===b.port&&a.pathname===b.pathname)
  throw Error("The restored database must be independently addressable, not the primary DB.");
 return {primaryHost:a.hostname,restoredHost:b.hostname,
  primaryDatabase:a.pathname.slice(1),restoredDatabase:b.pathname.slice(1)};
}
export type RestoreTable={table:string;rows:string;sampleDigest:string;sampleSize:number};
export async function auditReadOnlySnapshot(client:Pick<PoolClient,"query">):Promise<RestoreTable[]>{
 await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 try{
  const stats:RestoreTable[]=[];
  for(const [table,key] of sourceTables){
   // All names originate from this fixed internal map; no browser SQL identifiers.
   const totals=await client.query<{total:string}>(`SELECT count(*)::text AS total FROM ${table}`);
   const result=await client.query<{key:string}>(`
     SELECT ${key==="kind,source_id"?"kind || ':' || source_id":key}::text AS key
     FROM ${table} ORDER BY ${key} LIMIT 50`);
   const digest=createHash("sha256").update(
     result.rows.map(x=>x.key).join("\n"),"utf8").digest("hex");
   stats.push({table,rows:totals.rows[0].total,
     sampleDigest:digest,sampleSize:result.rows.length});
  }
  await client.query("COMMIT");
  return stats;
 }catch(e){await client.query("ROLLBACK");throw e;}
}
export function compareRestoredSnapshots(primary:RestoreTable[],restored:RestoreTable[]){
 const drift=primary.flatMap(a=>{
  const b=restored.find(x=>x.table===a.table);
  if(!b)return [{table:a.table,reason:"restored_table_missing"}];
  if(a.rows!==b.rows||a.sampleDigest!==b.sampleDigest||a.sampleSize!==b.sampleSize)
   return [{table:a.table,reason:"record_count_or_sample_differs"}];
  return [];
 });
 return {
  status:drift.length?"needs_operator_review":"sample_matched" as "needs_operator_review"|"sample_matched",
  tablesCompared:primary.length,drift,
  independentRestoreWitness:false as const,backupProvenanceValidated:false as const,
  fullRowHashCoverage:false as const,transactionsSent:0 as const,
  note:"Read-only row counts and first-50 primary-key digests are a bounded diagnostic, not a complete restore or backup integrity attestation. A human must verify actual restore logs and a complete snapshot.",
 };
}
