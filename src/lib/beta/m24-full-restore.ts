/** Full-row, read-only restore integrity comparison for independent operator review.
 * Uses deterministic PostgreSQL JSONB serialization of ALL rows on each table.
 * No arbitrary SQL names, migrations, privacy-leaking row output or writes.
 */
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {validateRestorePair} from "./m22-restore";

export const tables=[
 ["social_profiles","address"],
 ["social_auth_challenges","id"],
 ["social_sessions","token_hash"],
 ["social_posts","id"],
 ["social_comments","id"],
 ["social_media_uploads","id"],
 ["social_moderation_audit","id"],
 ["social_reports","id"],
 ["social_points_ledger","id"],
 ["social_points_review_audit","id"],
 ["social_activity_index","kind,source_id"],
 ["social_index_runs","id"],
 ["social_risk_review_events","id"],
 ["social_beta_wallet_challenges","id"],
 ["social_beta_wallet_acceptances","id"],
 ["social_beta_evidence_signatures","id"],
 ["social_beta_incident_journal","id"],
] as const;
export type FullTableDigest={table:string;rows:number;sha256:string;complete:true;schemaSha256:string};
export function validateFullRestorePair(primary:string|undefined,restored:string|undefined){
 return validateRestorePair(primary,restored);
}
/** Comparing two independently created snapshots requires a quiesced/captured common
 * source cutoff. Even matching hashes do not establish backup authenticity or human signoff.
 */
export async function digestFullDatabase(client:Pick<PoolClient,"query">,params:{
 pageSize?:number;maxRowsPerTable?:number;enforceTLS?:boolean;
 tableSpec?:ReadonlyArray<readonly [string,string]>;
}={}):Promise<FullTableDigest[]>{
 const pageSize=params.pageSize??100,maxRows=params.maxRowsPerTable??100000;
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500||
    !Number.isInteger(maxRows)||maxRows<1||maxRows>1_000_000)
  throw Error("Invalid bounded full-row scan settings.");
 if(params.enforceTLS){
  const tls=await client.query<{ssl:boolean}>(`
   SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()`);
  if(!tls.rows[0]?.ssl)throw Error("Actual PostgreSQL connection is NOT using TLS.");
 }
 const selected=params.tableSpec??tables;
 // Caller-selected extended schema MUST include every original M24 table, and
 // cannot introduce free-form SQL identifiers that could become SQL injection.
 const known=new Set([...tables.map(x=>x[0]),"social_beta_release_reviews","social_beta_release_witnesses"]);
 if(selected.length<tables.length || new Set(selected.map(x=>x[0])).size!==selected.length ||
    selected.some(([name,order])=>!known.has(name)||!/^[a-z_]+(?:,[a-z_]+)?$/.test(order)) ||
    tables.some(([name])=>!selected.some(x=>x[0]===name)))
  throw Error("Explicit complete allowlisted full-table manifest required.");
 const output:FullTableDigest[]=[];
 await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 try{
  const check=await client.query<{transaction_read_only:string}>(`
   SHOW transaction_read_only`);
  if(check.rows[0]?.transaction_read_only!=="on")throw Error("Read-only transaction was not enforced.");
  for(const [table,order] of selected){
   const columns=await client.query<{column_name:string;data_type:string;is_nullable:string;ordinal_position:number}>(`
    SELECT column_name,data_type,is_nullable,ordinal_position
    FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1
    ORDER BY ordinal_position`,[table]);
   if(!columns.rows.length)throw Error("Missing required real table "+table);
   const schemaSha256=createHash("sha256")
    .update(JSON.stringify(columns.rows)).digest("hex");
   // Hash every serialized row, not just keys or a LIMIT 50 sample.
   // Only fixed, code-owned identifiers from "tables" are interpolated.
   const stream=createHash("sha256");
   let offset=0;
   const ordering=order==="kind,source_id"?"kind ASC,source_id ASC":order+" ASC";
   while(true){
    const records=await client.query<{record:string}>(`
     SELECT to_jsonb(t)::text AS record FROM ${table} t
     ORDER BY ${ordering} LIMIT $1 OFFSET $2`,[pageSize,offset]);
    for(const row of records.rows){
     stream.update(Buffer.byteLength(row.record).toString()+"\0");
     stream.update(row.record);
     stream.update("\n");
    }
    offset+=records.rows.length;
    if(offset>maxRows)throw Error("Bounded full-row verification exceeded maxRowsPerTable for "+table);
    if(records.rows.length<pageSize)break;
   }
   output.push({table,rows:offset,sha256:stream.digest("hex"),
    schemaSha256,complete:true});
  }
  await client.query("COMMIT");
  return output;
 }catch(e){await client.query("ROLLBACK");throw e;}
}
export function compareFullDatabase(primary:FullTableDigest[],restored:FullTableDigest[],
 expected:ReadonlyArray<readonly [string,string]>=tables){
 const differences=primary.flatMap(a=>{
  const b=restored.find(x=>x.table===a.table);
  if(!b)return [{table:a.table,reason:"restore_table_missing"}];
  if(!a.complete||!b.complete)return [{table:a.table,reason:"incomplete_full_row_scan"}];
  if(a.schemaSha256!==b.schemaSha256)return [{table:a.table,reason:"schema_mismatch"}];
  if(a.rows!==b.rows)return [{table:a.table,reason:"row_count_mismatch"}];
  if(a.sha256!==b.sha256)return [{table:a.table,reason:"full_row_digest_mismatch"}];
  return [];
 });
 if(primary.length!==expected.length||
    new Set(primary.map(x=>x.table)).size!==expected.length ||
    restored.length!==expected.length ||
    new Set(restored.map(x=>x.table)).size!==expected.length ||
    expected.some(([name])=>!primary.some(x=>x.table===name)||!restored.some(x=>x.table===name)))
  differences.push({table:"overall",reason:"missing_required_tables"});
 return {
  comparison: differences.length?"MISMATCH":"MATCHED_FULL_ROWS" as "MISMATCH"|"MATCHED_FULL_ROWS",
  tableCount:primary.length,differences,
  allRowsHashed: differences.length===0,operatorRestoreWitnessAccepted:false as const,
  backupOriginVerified:false as const,releaseAuthorized:false as const,
  note:"Read-only 17-table full-row/schema comparison, not a backup authenticity, common-snapshot, TLS certificate authority, disaster-recovery RTO or independent human witness attestation.",
 };
}
