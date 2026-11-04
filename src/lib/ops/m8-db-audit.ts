import type {PoolClient} from "pg";

/**
 * Read-only schema and TLS diagnostics. Accepts only a database connection,
 * never sends credentials, rows or wallet identity to the caller.
 */
export const REQUIRED_TABLES=[
  "social_profiles","social_auth_challenges","social_sessions",
  "social_follows","social_blocks","social_posts","social_comments",
  "social_reports","social_moderation_audit","social_rate_windows",
  "social_dm_public_keys","social_dm_envelopes",
] as const;
const INDEXED=["social_profiles","social_auth_challenges","social_sessions","social_follows",
  "social_blocks","social_posts","social_comments","social_reports",
  "social_moderation_audit","social_rate_windows"] as const;
export type DbAudit = {
  checkedAt:string;status:"verified"|"blocked";
  serverMajor:number;encryptedTransport:boolean;
  requiredRelations:number;presentRelations:number;
  missingRelations:string[];missingIndexes:string[];
  readOnlyTransaction:boolean;
  betaActivated:false;
};
export function validateAudit(input:{
  serverVersion:number;ssl:boolean;relations:string[];indexed:string[];
  readOnlyTransaction:boolean;
},allowLocalPlaintext=false,now=new Date()):DbAudit {
  const major=Math.floor(input.serverVersion/10000);
  const rel=new Set(input.relations),idx=new Set(input.indexed);
  const missingRelations=REQUIRED_TABLES.filter(t=>!rel.has(t));
  const missingIndexes=INDEXED.filter(t=>!idx.has(t));
  const ready=major>=15&&input.readOnlyTransaction&&
    (input.ssl||allowLocalPlaintext)&&!missingRelations.length&&!missingIndexes.length;
  return {
    checkedAt:now.toISOString(),status:ready?"verified":"blocked",
    serverMajor:major,encryptedTransport:input.ssl,
    requiredRelations:REQUIRED_TABLES.length,
    presentRelations:REQUIRED_TABLES.length-missingRelations.length,
    missingRelations:[...missingRelations],missingIndexes:[...missingIndexes],
    readOnlyTransaction:input.readOnlyTransaction,betaActivated:false,
  };
}
export async function inspectSocialDatabase(
  client:PoolClient,allowLocalPlaintext=false,
):Promise<DbAudit>{
  // Transaction READ ONLY, including the schema discovery. Rollback is unconditional.
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    const version=await client.query<{version:number;ssl:boolean;read_only:string}>(`
      SELECT current_setting('server_version_num')::integer AS version,
        COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS ssl,
        current_setting('transaction_read_only') AS read_only`);
    const relations=await client.query<{tablename:string}>(`
      SELECT c.relname AS tablename FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
        AND c.relname = ANY($1::text[])`,[[...REQUIRED_TABLES]]);
    const indexes=await client.query<{tablename:string}>(`
      SELECT DISTINCT tablename FROM pg_indexes
      WHERE schemaname='public' AND tablename=ANY($1::text[])`,[[...INDEXED]]);
    const row=version.rows[0];
    if(!row)throw new Error("Postgres returned no version/transport data.");
    return validateAudit({
      serverVersion:row.version,ssl:row.ssl,
      relations:relations.rows.map(x=>x.tablename),
      indexed:indexes.rows.map(x=>x.tablename),
      readOnlyTransaction:row.read_only==="on",
    },allowLocalPlaintext);
  } finally {
    await client.query("ROLLBACK");
  }
}
export function localDbOverrideAllowed(url:string|undefined,flag:string|undefined){
  if(flag!=="true"||!url)return false;
  try {
    const parsed=new URL(url);
    return parsed.protocol==="postgres:"||parsed.protocol==="postgresql:"
      ? ["127.0.0.1","localhost","::1"].includes(parsed.hostname)
      : false;
  } catch {return false;}
}
