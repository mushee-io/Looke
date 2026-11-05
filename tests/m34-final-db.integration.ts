import assert from "node:assert/strict";
import {after,test} from "node:test";
import {socialDb} from "../src/lib/social/db";
import {inspectM33CurrentSource} from "../src/lib/beta/m33-live-integration";
import {assessM34Acceptance} from "../src/lib/beta/m34-final-acceptance";
after(async()=>{await socialDb().end();});
test("M34 read-only acceptance verifies genuine disposable PostgreSQL schema",async()=>{
 assert.equal(process.env.LOOKE_M34_CI_DATABASE,"true");
 assert.ok((process.env.DATABASE_URL||"").includes("looke_social_ci"));
 const c=await socialDb().connect();
 try{
  const schema=await inspectM33CurrentSource(c,false);
  assert.equal(schema.schemaCompatible,true);
  assert.equal(schema.actualCurrentTables,19);
  assert.equal(schema.recordsModified,0);
  const live={milestone:"M33",mode:"live",releaseDecision:"NO_GO",
   publicBetaOpen:false,flagsClosed:true,liveRPCChecksPerformed:true,
   cloudinaryAssetsQueried:false,
   postgres:{verified:schema.schemaCompatible,status:"schema_verified_only",
    currentTables:schema.actualCurrentTables,requiredTables:19}};
  const r=assessM34Acceptance({flags:{},live});
  assert.ok(!r.blocked.includes("current_postgres_19_table_schema"));
  assert.equal(r.originalHumanApprovals,0);
  assert.equal(r.releaseDecision,"NO_GO");
  assert.equal(r.databasesModified,0);
 }finally{c.release();}
});
