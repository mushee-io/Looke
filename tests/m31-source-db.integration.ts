import assert from "node:assert/strict";
import {test,after} from "node:test";
import {socialDb} from "../src/lib/social/db";
import {inspectM31Schema,requiredM31Tables,classifyM31Schema,m31SourceDecision} from "../src/lib/beta/m31-source-compatibility";
import {digestM27Database,compareM27Databases} from "../src/lib/beta/m27-evidence";
import {GET} from "../src/app/api/experience/m31-source-readiness/route";

after(async()=>{await socialDb().end();});
test("Disposable actual PostgreSQL migrations produce all nineteen current source tables",async()=>{
 const c=await socialDb().connect();
 try{
  const result=await inspectM31Schema(c,false);
  assert.equal(result.status,"schema_compatible_unverified_records");
  assert.equal(result.schemaCompatible,true);
  assert.equal(result.actualCurrentTables,19);
  assert.deepEqual(result.missingTables,[]);
  assert.deepEqual(result.missingColumns,[]);
  assert.equal(result.releaseDecision,"NO_GO");
  assert.equal(new Set(requiredM31Tables).size,19);
 }finally{c.release();}
});
test("Nineteen real PostgreSQL source/evidence table hashes never establish independent backup witnessing",async()=>{
 const c=await socialDb().connect();
 try{
  const source=await digestM27Database(c,false);
  assert.equal(source.length,19);
  const diff=compareM27Databases(source,source.map(x=>({...x})));
  assert.equal(diff.comparison,"MATCHED_FULL_ROWS");
  assert.equal(diff.operatorRestoreWitnessAccepted,false);
  assert.equal(diff.backupOriginVerified,false);
  assert.equal(diff.releaseAuthorized,false);
 }finally{c.release();}
});
test("Omitted external signer ledger or nonce-consumption column cannot pass compatibility",async()=>{
 const c=await socialDb().connect();
 try{
  const rows=await c.query<{table_name:string;column_name:string}>(
   "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name LIKE 'social%' ORDER BY table_name,ordinal_position");
  const missing=classifyM31Schema(rows.rows.filter(x=>x.table_name!=="social_beta_release_witnesses"));
  assert.equal(missing.schemaCompatible,false);
  assert.ok(missing.missingTables.includes("social_beta_release_witnesses"));
  const stale=classifyM31Schema(rows.rows.filter(x=>!(
   x.table_name==="social_beta_wallet_challenges"&&x.column_name==="consumed_at")));
  assert.equal(stale.schemaCompatible,false);
  assert.ok(stale.missingColumns.includes("social_beta_wallet_challenges.consumed_at"));
 }finally{c.release();}
});
test("TLS requirement, production 404 and redacted connection errors never expose credentials",async()=>{
 const c=await socialDb().connect();
 try{
  const tls=await c.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
  if(!tls.rows[0].ssl)await assert.rejects(()=>inspectM31Schema(c,true),/TLS/);
 }finally{c.release();}
 const original=process.env.VERCEL_ENV;
 try{
  process.env.VERCEL_ENV="production";
  assert.equal((await GET()).status,404);
  process.env.VERCEL_ENV="preview";
  const response=await GET();
  const data=await response.json() as Record<string,unknown>;
  assert.equal(data.releaseDecision,"NO_GO");
  assert.equal(data.publicBetaOpen,false);
  const raw=JSON.stringify(data);
  assert.ok(!raw.includes("ci_only_password"));
  assert.ok(!raw.includes("postgres://"));
 }finally{if(original===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=original;}
});
test("Even all valid externally checked technical signals cannot autonomously approve go-live",()=>{
 const r=m31SourceDecision({
  primarySchemaCompatible:true,restoreSchemaCompatible:true,
  providerCredentialsPresent:true,actualApprovedProviderRows:4,
  actualCreatorReceiptConfirmed:true,actualNativeUniqConfirmed:true,
  actualPointsSourcesReconciled:true,originalHumanWitnessesConfirmed:true,
  independentAuditFindingRetestsConfirmed:true,realHumanRestoreWitnessed:true,
  independentlyWitnessedRollback:true,releaseFlagsClosed:true,
 });
 assert.deepEqual(r.blocked,[]);
 assert.equal(r.releaseDecision,"NO_GO");
 assert.equal(r.productionPromotionAllowed,false);
 assert.equal(r.financialTransactionAllowed,false);
 assert.equal(r.externallyVerifiedHumanApprovalAccepted,false);
});
