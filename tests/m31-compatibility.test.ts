import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {allM27Tables} from "../src/lib/beta/m27-evidence";
import {classifyM31Schema,inspectM31Schema,requiredM31Tables,
 requiredSourceColumns,m31SourceDecision} from "../src/lib/beta/m31-source-compatibility";
import {GET as previewGET} from "../src/app/api/experience/m31-source-readiness/route";
const row=(table_name:string,column_name:string)=>({table_name,column_name});
function validColumns(){
 return allM27Tables.flatMap(([name])=>
  [...new Set(["id",...(requiredSourceColumns[name]??[])])].map(x=>row(name,x)));
}
test("Connected actual legacy-only looke_* schema is NOT equivalent to current 19-table acceptance schema",()=>{
 const legacy=["looke_profiles","looke_posts","looke_post_media","looke_sessions",
  "looke_challenges","looke_coin_events","looke_trend_proposals"].map(s=>row(s,"id"));
 const result=classifyM31Schema(legacy);
 assert.equal(result.status,"legacy_only_incompatible");
 assert.equal(result.legacyTables,7);
 assert.equal(result.socialTables,0);
 assert.equal(result.actualCurrentTables,0);
 assert.equal(result.schemaCompatible,false);
 assert.equal(result.missingTables.length,19);
 assert.equal(result.humanAcceptanceVerified,false);
 assert.equal(result.databaseMutated,false);
 assert.equal(result.releaseDecision,"NO_GO");
});
test("All 19 distinct tables plus exact witness/moderation/Points columns are necessary",()=>{
 const valid=validColumns();
 assert.equal(requiredM31Tables.length,19);
 const compatible=classifyM31Schema(valid);
 assert.equal(compatible.status,"schema_compatible_unverified_records");
 assert.equal(compatible.schemaCompatible,true);
 assert.equal(compatible.missingTables.length,0);
 assert.equal(compatible.missingColumns.length,0);
 assert.equal(compatible.realDataAccepted,false);
 const missing=classifyM31Schema(valid.filter(x=>x.table_name!=="social_beta_release_witnesses"));
 assert.equal(missing.schemaCompatible,false);
 assert.ok(missing.missingTables.includes("social_beta_release_witnesses"));
 const broken=classifyM31Schema(valid.filter(x=>!(x.table_name==="social_beta_wallet_challenges"&&x.column_name==="consumed_at")));
 assert.equal(broken.status,"incomplete_current_schema");
 assert.deepEqual(broken.missingColumns,["social_beta_wallet_challenges.consumed_at"]);
 const forged=classifyM31Schema([...valid,row("social_posts;DROP TABLE users","id")]);
 assert.equal(forged.schemaCompatible,true); // Invalid arbitrary names ignored; no SQL injection
 assert.equal(forged.socialTables,19);
});
test("Legacy schema and no actual API credentials cannot be a GO decision even with fabricated positive booleans",()=>{
 const inputs={
  primarySchemaCompatible:true,restoreSchemaCompatible:true,
  providerCredentialsPresent:true,actualApprovedProviderRows:2,
  actualCreatorReceiptConfirmed:true,actualNativeUniqConfirmed:true,
  actualPointsSourcesReconciled:true,originalHumanWitnessesConfirmed:true,
  independentAuditFindingRetestsConfirmed:true,realHumanRestoreWitnessed:true,
  independentlyWitnessedRollback:true,releaseFlagsClosed:true,
 };
 const reported=m31SourceDecision(inputs);
 assert.equal(reported.blocked.length,0);
 assert.equal(reported.releaseDecision,"NO_GO");
 assert.equal(reported.publicBetaOpen,false);
 assert.equal(reported.productionPromotionAllowed,false);
 assert.equal(reported.socialMediaWritesEnabled,false);
 assert.equal(reported.pointsAccountingEnabled,false);
 assert.equal(reported.tokenClaimsAllowed,false);
 assert.equal(reported.financialTransactionAllowed,false);
 assert.equal(reported.privateMessagingEnabled,false);
 assert.equal(reported.externallyVerifiedHumanApprovalAccepted,false);
 const no=m31SourceDecision({...inputs,primarySchemaCompatible:false,
  restoreSchemaCompatible:false,providerCredentialsPresent:false,
  actualApprovedProviderRows:0,originalHumanWitnessesConfirmed:false});
 assert.ok(no.blocked.includes("current_19_table_primary_schema_missing_or_legacy_only"));
 assert.ok(no.blocked.includes("separately_restored_19_table_tls_schema_missing"));
 assert.equal(no.releaseDecision,"NO_GO");
});
test("Actual TLS requirement and masked errors enforce source authorization separation",async()=>{
 const fake={query:async(sql:string)=>sql.includes("pg_stat_ssl")?
  {rows:[{ssl:false}],rowCount:1}:{rows:[],rowCount:0}};
 await assert.rejects(()=>inspectM31Schema(fake as never,true),/TLS/);
 const old={DB:process.env.DATABASE_URL,VE:process.env.VERCEL_ENV};
 delete process.env.DATABASE_URL;
 process.env.VERCEL_ENV="preview";
 try{
  const r=await previewGET();assert.equal(r.status,200);
  const body=await r.json() as Record<string,unknown>;
  assert.equal(body.sourceStatus,"not_connected");
  assert.equal(body.releaseDecision,"NO_GO");
  assert.equal(body.schemaCompatible,false);
  const raw=JSON.stringify(body);
  assert.ok(!raw.includes("postgres://"));
 }finally{
  if(old.DB===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old.DB;
  if(old.VE===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old.VE;
 }
});
test("Production M31 diagnostics 404 and source auditors cannot mutate data or start background jobs",async()=>{
 const orig=process.env.VERCEL_ENV;process.env.VERCEL_ENV="production";
 try{assert.equal((await previewGET()).status,404);}
 finally{if(orig===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=orig;}
 const files=[
  "src/app/api/experience/m31-source-readiness/route.ts",
  "scripts/m31-source-schema-audit.ts",
  "src/lib/beta/m31-source-compatibility.ts",
 ];
 for(const path of files){
  const src=readFileSync(resolve(path),"utf8");
  for(const banned of ["eth_sendTransaction","writeContract(","request_rollback(","setInterval(","DROP TABLE","CREATE TABLE","ALTER TABLE"])
   assert.ok(!src.includes(banned)||src.includes("not a valid SQL"),path+" included "+banned);
 }
 const source=readFileSync(resolve("scripts/m31-source-schema-audit.ts"),"utf8");
 assert.ok(source.includes("digestM27Database"));
 assert.ok(source.includes("validateFullRestorePair"));
 assert.ok(source.includes("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"));
});
