import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {classifyM32Legacy,compareM32Sources,inspectM32RealSource,
 legacyM32Mappings,requireDistinctM32Sources} from "../src/lib/beta/m32-reconciliation";
import {requiredM31Tables,requiredSourceColumns} from "../src/lib/beta/m31-source-compatibility";
import {GET as previewGET} from "../src/app/api/experience/m32-reconciliation/route";
const column=(table_name:string,column_name:string)=>({table_name,column_name});
const legacy=[
 column("looke_profiles","id"),column("looke_profiles","evm_address"),
 column("looke_profiles","created_at"),
 column("looke_posts","id"),column("looke_posts","profile_id"),
 column("looke_posts","text"),column("looke_posts","moderation_status"),
 column("looke_post_media","id"),column("looke_post_media","owner_profile_id"),
 column("looke_post_media","cloud_public_id"),column("looke_post_media","status"),
 column("looke_sessions","token_hash"),column("looke_sessions","profile_id"),
 column("looke_sessions","expires_at"),
 column("looke_challenges","id"),column("looke_challenges","evm_address"),
 column("looke_challenges","message"),column("looke_challenges","consumed_at"),
 column("looke_coin_events","tx_hash"),column("looke_coin_events","log_index"),
 column("looke_coin_events","coin_address"),column("looke_coin_events","block_number"),
 column("looke_post_reports","id"),column("looke_post_reports","post_id"),
 column("looke_post_reports","reason"),
];
test("M32 genuine legacy-only metadata does not imply migrated 19-table social source",()=>{
 const r=classifyM32Legacy(legacy,{looke_profiles:0,looke_posts:0,looke_sessions:0});
 assert.equal(r.observedLegacyTables,7);
 assert.equal(r.observedCurrentTables,0);
 assert.equal(r.currentSchemaCompatible,false);
 assert.equal(r.status,"legacy_requires_manual_reconciliation");
 assert.equal(r.releaseDecision,"NO_GO");
 assert.equal(r.migrationsExecuted,0);
 assert.equal(r.sessionTokensTransferred,0);
 assert.ok(r.mappings.every(m=>m.autoTransferAllowed===false));
 assert.equal(r.mappings.find(m=>m.legacyTable==="looke_posts")?.rowCount,0);
});
test("Missing original signing, owner, media or moderation fields cannot pass M32 mapping",()=>{
 const corrupt=classifyM32Legacy(legacy.filter(x=>x.column_name!=="evm_address"&&x.column_name!=="cloud_public_id"));
 assert.deepEqual(corrupt.mappings.find(m=>m.legacyTable==="looke_profiles")?.missingColumns,["evm_address"]);
 assert.deepEqual(corrupt.mappings.find(m=>m.legacyTable==="looke_post_media")?.missingColumns,["cloud_public_id"]);
 assert.ok(corrupt.blockers.includes("legacy_source_columns_incompatible"));
 const spoofed=classifyM32Legacy([...legacy,column("looke_users;DROP TABLE social_profiles","id")],
  {looke_profiles:-1,"looke_users;DROP TABLE social_profiles":1});
 assert.equal(spoofed.observedLegacyTables,7);
 assert.ok(spoofed.blockers.includes("untrusted_aggregate_counts"));
 assert.equal(spoofed.releaseDecision,"NO_GO");
});
test("Even technically compatible current schema with fake positive counts cannot approve transfer",()=>{
 const currentRows=requiredM31Tables.flatMap(t=>
  [...new Set(["id",...(requiredSourceColumns[t]??[])])].map(c=>column(t,c)));
 const target=classifyM32Legacy(currentRows);
 assert.equal(target.currentSchemaCompatible,true);
 const legacyResult=classifyM32Legacy(legacy,{looke_profiles:8,looke_posts:3});
 const compared=compareM32Sources(legacyResult,target);
 assert.equal(compared.observedLegacyRows,11);
 assert.equal(compared.readyToMigrate,false);
 assert.equal(compared.realUsersMigrated,0);
 assert.equal(compared.approvedMediaMigrated,0);
 assert.equal(compared.releaseDecision,"NO_GO");
 assert.ok(compared.blockers.includes("original_wallet_consent_and_account_reauthentication_missing"));
 assert.ok(legacyM32Mappings.some(m=>m.policy==="sessions_must_not_transfer"));
});
test("A shared database with different credentials is NOT an independently separated source",()=>{
 assert.throws(()=>requireDistinctM32Sources(
  "postgres://reader:a@db.example:5432/looke","postgresql://other:b@db.example/looke"),/separate databases/);
 assert.throws(()=>requireDistinctM32Sources("https://a.example","postgres://a@b/x"),/PostgreSQL/);
 assert.doesNotThrow(()=>requireDistinctM32Sources(
  "postgres://a@legacy.example/old","postgres://b@new.example/current"));
});
test("Actual TLS denial blocks read-only source inspection before any user record can be read",async()=>{
 const queries:string[]=[];
 const db={query:async(q:string)=>{queries.push(q);return {rows:[{ssl:false}]};}};
 await assert.rejects(()=>inspectM32RealSource(db as never,true),/encrypted PostgreSQL/);
 assert.equal(queries.length,1);
 assert.ok(queries[0].includes("pg_stat_ssl"));
});
test("Preview without both operator-approved sources is NO-GO with no real data or secret disclosure",async()=>{
 const old={env:process.env.VERCEL_ENV,db:process.env.DATABASE_URL,
  legacy:process.env.LOOKE_M32_LEGACY_DATABASE_URL};
 delete process.env.DATABASE_URL;
 delete process.env.LOOKE_M32_LEGACY_DATABASE_URL;
 try{
  process.env.VERCEL_ENV="production";
  assert.equal((await previewGET()).status,404);
  process.env.VERCEL_ENV="preview";
  const x=await previewGET();
  assert.equal(x.status,200);
  const a=await x.json();
  assert.equal(a.sourceStatus,"missing_authorized_dual_source");
  assert.equal(a.releaseDecision,"NO_GO");
  assert.equal(a.publicBetaOpen,false);
  assert.equal(a.originalSourcesQueried,false);
  assert.equal(a.legacyConnected,false);
  assert.equal(a.currentConnected,false);
  const body=JSON.stringify(a);
  assert.ok(!body.includes("postgres://"));
  assert.ok(!body.includes("looke_ultra_staging_password"));
 }finally{
  if(old.env===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old.env;
  if(old.db===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old.db;
  if(old.legacy===undefined)delete process.env.LOOKE_M32_LEGACY_DATABASE_URL;
  else process.env.LOOKE_M32_LEGACY_DATABASE_URL=old.legacy;
 }
});
test("M32 read-only runtime has no database mutation, wallet broadcast or recurring loop",()=>{
 for(const file of ["src/lib/beta/m32-reconciliation.ts",
  "src/app/api/experience/m32-reconciliation/route.ts","scripts/m32-reconcile.ts"]){
  const s=readFileSync(resolve(file),"utf8");
  for(const forbidden of ["eth_sendTransaction","writeContract(","setInterval(",
   "INSERT INTO","UPDATE social_","DELETE FROM","DROP TABLE","ALTER TABLE","CREATE TABLE",
   "request_rollback(","deployContract("])
   assert.equal(s.includes(forbidden),false,file+" contains forbidden write: "+forbidden);
 }
});
