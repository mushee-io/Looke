import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {after,test} from "node:test";
import {socialDb} from "../src/lib/social/db";
import {inspectM32RealSource} from "../src/lib/beta/m32-reconciliation";
import {requiredM31Tables} from "../src/lib/beta/m31-source-compatibility";
after(async()=>{await socialDb().end();});
function disposableOnly(){
 assert.equal(process.env.LOOKE_M32_DISPOSABLE_DB_TESTS,"true",
  "M32 SQL fixtures are strictly limited to disposable CI PostgreSQL");
 assert.ok((process.env.DATABASE_URL??"").includes("looke_social_ci"),
  "Never create test fixtures against a real operator data source");
}
test("M32 reads the actual 19 migrated social tables in a PostgreSQL read-only transaction",async()=>{
 disposableOnly();
 const c=await socialDb().connect();
 try{
  const r=await inspectM32RealSource(c,false);
  assert.equal(requiredM31Tables.length,19);
  assert.equal(r.currentSchemaCompatible,true);
  assert.equal(r.observedCurrentTables,19);
  assert.equal(r.migrationsExecuted,0);
  assert.equal(r.releaseDecision,"NO_GO");
  assert.equal(r.copiedRecords,0);
 }finally{c.release();}
});
test("Read-only M32 inspector observes real SQL legacy table/column evidence and aggregate count only",async()=>{
 disposableOnly();
 const schema="m32_ci_fixture_"+randomUUID().replaceAll("-","");
 const c=await socialDb().connect();
 try{
  await c.query('CREATE SCHEMA "'+schema+'"');
  try{
   await c.query('SET search_path TO "'+schema+'"');
   await c.query("CREATE TABLE looke_profiles(id uuid PRIMARY KEY,evm_address text NOT NULL,created_at timestamptz NOT NULL)");
   // Disposable SQL row is an isolation test fixture, NEVER real user acceptance.
   await c.query("INSERT INTO looke_profiles(id,evm_address,created_at) VALUES($1,$2,now())",
    [randomUUID(),"test-fixture-wallet-not-a-real-person"]);
   const r=await inspectM32RealSource(c,false);
   assert.equal(r.observedLegacyTables,1);
   assert.equal(r.currentSchemaCompatible,false);
   assert.equal(r.mappings.find(m=>m.legacyTable==="looke_profiles")?.rowCount,1);
   assert.equal(r.mappings.find(m=>m.legacyTable==="looke_profiles")?.missingColumns.length,0);
   assert.equal(r.copiedRecords,0);
   assert.equal(r.walletSignaturesVerified,0);
   assert.equal(r.releaseDecision,"NO_GO");
  }finally{
   await c.query("SET search_path TO public");
   await c.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
  }
 }finally{c.release();}
});
test("PostgreSQL itself blocks mutation inside explicit READ ONLY transaction",async()=>{
 disposableOnly();
 const c=await socialDb().connect();
 try{
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try{
   const r=await c.query<{transaction_read_only:string}>("SHOW transaction_read_only");
   assert.equal(r.rows[0]?.transaction_read_only,"on");
   await assert.rejects(c.query("CREATE TABLE m32_illegal_write(id int)"),/read-only transaction/i);
  }finally{await c.query("ROLLBACK");}
 }finally{c.release();}
});
