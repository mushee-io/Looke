/** One-time M31 REAL schema and row-count verification. Never selects user PII,
 * never migrates legacy staging to the newer social_* acceptance schema, never
 * creates a backup, and never changes Vercel settings.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {inspectM31Schema,m31SourceDecision} from "../src/lib/beta/m31-source-compatibility";
import {m30ConfigPreflight} from "../src/lib/beta/m30-operator-readiness";
import {validateFullRestorePair} from "../src/lib/beta/m24-full-restore";
import {digestM27Database,compareM27Databases} from "../src/lib/beta/m27-evidence";
type Scan={status:string;schemaCompatible:boolean;missingTables:string[];
 missingColumns:string[];legacyTables:number;socialTables:number;actualCurrentTables:number;
 counts?:Record<string,number>;tableDigest?:string};
const makePool=(url:string)=>new Pool({
 connectionString:url,max:1,connectionTimeoutMillis:8000,statement_timeout:60000,
});
async function inspect(pool:Pool,fullRows=false):Promise<Scan>{
 const conn=await pool.connect();
 try{
  const schema=await inspectM31Schema(conn,true);
  const output:Scan={
   status:schema.status,schemaCompatible:schema.schemaCompatible,
   missingTables:schema.missingTables,missingColumns:schema.missingColumns,
   legacyTables:schema.legacyTables,socialTables:schema.socialTables,
   actualCurrentTables:schema.actualCurrentTables,
  };
  if(!schema.schemaCompatible)return output;
  if(fullRows){
   // Existing implementation reads all rows in a REPEATABLE READ READ ONLY
   // transaction and returns only hashes/counts of each of 19 fixed tables.
   const digest=await digestM27Database(conn,true);
   output.tableDigest=String(digest.length)+" complete hashed tables";
  }else{
   await conn.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   try{
    const r=await conn.query<{
     accounts:number;posts:number;attached_uploads:number;
     consumed_challenges:number;approved_points:number;
    }>(`SELECT
      (SELECT count(*)::integer FROM social_profiles) AS accounts,
      (SELECT count(*)::integer FROM social_posts) AS posts,
      (SELECT count(*)::integer FROM social_media_uploads WHERE state='attached') AS attached_uploads,
      (SELECT count(*)::integer FROM social_beta_wallet_challenges WHERE consumed_at IS NOT NULL) AS consumed_challenges,
      (SELECT count(*)::integer FROM social_points_ledger WHERE status='approved') AS approved_points`);
    output.counts=r.rows[0];
    await conn.query("COMMIT");
   }catch(e){await conn.query("ROLLBACK");throw e;}
  }
  return output;
 }finally{conn.release();}
}
async function main(){
 const config=m30ConfigPreflight(process.env);
 const primaryURL=process.env.DATABASE_URL,restoreURL=process.env.LOOKE_M27_RESTORE_DATABASE_URL;
 const full=process.argv.includes("--full-restore-rows");
 let source:Scan|null=null,restore:Scan|null=null;
 let sourceError:string|null=null,restoreError:string|null=null;
 let restoreDigestMatched=false;
 if(primaryURL){
  const p=makePool(primaryURL);
  try{source=await inspect(p,false);}
  catch{sourceError="Primary TLS PostgreSQL connection or schema inspection failed; database not accepted.";}
  finally{await p.end();}
 }
 if(primaryURL&&restoreURL){
  try{
   // Reject identical logical endpoint/DB even when credentials differ.
   validateFullRestorePair(primaryURL,restoreURL);
   const p=makePool(restoreURL);
   try{restore=await inspect(p,false);}
   finally{await p.end();}
   if(full&&source?.schemaCompatible&&restore?.schemaCompatible){
    const p1=makePool(primaryURL),p2=makePool(restoreURL);
    try{
     const a=await p1.connect(),b=await p2.connect();
     try{
      const [d1,d2]=await Promise.all([digestM27Database(a,true),digestM27Database(b,true)]);
      restoreDigestMatched=compareM27Databases(d1,d2).comparison==="MATCHED_FULL_ROWS";
     }finally{a.release();b.release();}
    }finally{await Promise.allSettled([p1.end(),p2.end()]);}
   }
  }catch{restoreError="Distinct independently restored TLS PostgreSQL source or 19-table consistency not verified.";}
 }
 const decision=m31SourceDecision({
  primarySchemaCompatible:source?.schemaCompatible??false,
  restoreSchemaCompatible:restore?.schemaCompatible??false,
  providerCredentialsPresent:config.canAttemptRealProviderInspection,
  actualApprovedProviderRows:0,actualCreatorReceiptConfirmed:false,
  actualNativeUniqConfirmed:false,actualPointsSourcesReconciled:false,
  originalHumanWitnessesConfirmed:false,independentAuditFindingRetestsConfirmed:false,
  realHumanRestoreWitnessed:false,independentlyWitnessedRollback:false,
  releaseFlagsClosed:config.releaseFlagsClosed,
 });
 const result={
  milestone:"M31",checkedAt:new Date().toISOString(),
  checkedVia:"direct read-only TLS PostgreSQL aggregate/schema inspection",
  liveSourceConfigured:!!primaryURL,liveRestoreConfigured:!!restoreURL,
  source,restore,sourceError,restoreError,restoreDigestMatched,
  actualBackupCreatedOrRestoredByThisTool:false,
  cloudinaryMetadataIndependentlyAuthenticatedHere:false,
  currentUltratestnetCoinAndUniqProvedHere:false,
  actualDistinctHumanWitnessesVerified:false,
  externalAuditFindingsIndependentlyReviewed:false,
  financiallyRelevantWrites:0,
  decision,
 };
 await mkdir("artifacts/m31",{recursive:true});
 await writeFile("artifacts/m31/source-compatibility.json",JSON.stringify(result,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({milestone:"M31",sourceStatus:source?.status??"missing_connection",
  currentRequiredTables:source?.actualCurrentTables??0,
  restoreStatus:restore?.status??"missing_separate_restore",
  sourceError,restoreError,fullRestoreDigestMatched:restoreDigestMatched,
  releaseDecision:"NO_GO"},null,2));
 if(process.argv.includes("--require-compatible")&&
  (!source?.schemaCompatible||!config.releaseFlagsClosed||sourceError||restoreError||
    (restoreURL&&!restore?.schemaCompatible)||
    (full&&(!restoreURL||!restoreDigestMatched))))
  process.exitCode=2;
 // An explicitly requested full restore comparison MUST be exact on two distinct
 // real TLS databases; never report a successful exit on mismatched hashes.
 if(full&&(!restoreURL||!restoreDigestMatched))process.exitCode=2;
}
main().catch(()=>{console.error("M31 actual read-only database inspection BLOCKED, no source release accepted.");process.exitCode=2;});
