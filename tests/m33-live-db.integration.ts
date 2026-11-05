import assert from "node:assert/strict";
import {after,test} from "node:test";
import {randomUUID} from "node:crypto";
import {socialDb} from "../src/lib/social/db";
import {inspectM33CurrentSource} from "../src/lib/beta/m33-live-integration";
after(async()=>{await socialDb().end();});
function requireDisposable(){
 assert.equal(process.env.LOOKE_M33_DISPOSABLE_DB_TESTS,"true");
 assert.ok((process.env.DATABASE_URL||"").includes("looke_social_ci"),
  "Never run writable fixture setup against an operator source");
}
test("M33 reads actual PostgreSQL 19-table current social schema without copying any user rows",async()=>{
 requireDisposable();
 const c=await socialDb().connect();
 try{
  const result=await inspectM33CurrentSource(c,false);
  assert.equal(result.schemaCompatible,true);
  assert.equal(result.actualCurrentTables,19);
  assert.equal(result.verifiedUserRecords,false);
  assert.equal(result.recordsModified,0);
  assert.equal(result.releaseDecision,"NO_GO");
 }finally{c.release();}
});
test("Incomplete PostgreSQL schema, even with a real profile table, cannot pass M33",async()=>{
 requireDisposable();
 const schema="m33_ci_"+randomUUID().replaceAll("-","");
 const c=await socialDb().connect();
 try{
  await c.query('CREATE SCHEMA "'+schema+'"');
  try{
   await c.query('SET search_path TO "'+schema+'"');
   await c.query("CREATE TABLE social_profiles(id uuid PRIMARY KEY,address text,suspended boolean)");
   const result=await inspectM33CurrentSource(c,false);
   assert.equal(result.schemaCompatible,false);
   assert.equal(result.actualCurrentTables,1);
   assert.ok(result.missingTables.includes("social_posts"));
   assert.equal(result.verifiedUserRecords,false);
   assert.equal(result.releaseDecision,"NO_GO");
  }finally{
   await c.query("SET search_path TO public");
   await c.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
  }
 }finally{c.release();}
});
test("M33 refuses a plaintext connection where an actual TLS source is required",async()=>{
 requireDisposable();
 const c=await socialDb().connect();
 try{
  const ssl=await c.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
  if(ssl.rows[0]?.ssl===false)
   await assert.rejects(()=>inspectM33CurrentSource(c,true),/TLS/);
 }finally{c.release();}
});
test("Real PostgreSQL rejects writes during read-only transaction, regardless of application flags",async()=>{
 requireDisposable();
 const c=await socialDb().connect();
 try{
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try{
   assert.equal((await c.query<{transaction_read_only:string}>("SHOW transaction_read_only")).rows[0]?.transaction_read_only,"on");
   await assert.rejects(c.query("CREATE TABLE m33_forbidden_real_write(id int)"),/read-only transaction/i);
  }finally{await c.query("ROLLBACK");}
 }finally{c.release();}
});
