import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {compareCursor,indexMutation,indexWritesEnabled,riskMutation,scanLimit,safetyLagSeconds} from "../src/lib/social/m20";

const read=(p:string)=>readFileSync(resolve(p),"utf8");
const id="11111111-1111-4111-8111-111111111111";
const person="0x1111111111111111111111111111111111111111";
const another="0x2222222222222222222222222222222222222222";
test("M20 safe-by-default indexing never accepts a remote user scan flag",()=>{
 const old=process.env.LOOKE_M20_INDEX_WRITES_ENABLED;
 try{
  delete process.env.LOOKE_M20_INDEX_WRITES_ENABLED;
  assert.equal(indexWritesEnabled(),false);
  process.env.LOOKE_M20_INDEX_WRITES_ENABLED="yes";
  assert.equal(indexWritesEnabled(),false);
  process.env.LOOKE_M20_INDEX_WRITES_ENABLED="true";
  assert.equal(indexWritesEnabled(),true);
 }finally{
  if(old===undefined)delete process.env.LOOKE_M20_INDEX_WRITES_ENABLED;
  else process.env.LOOKE_M20_INDEX_WRITES_ENABLED=old;
 }
});
test("M20 index mutation accepts only bounded, audited scan or rewind",()=>{
 assert.deepEqual(indexMutation.parse({action:"scan"}),{action:"scan"});
 assert.equal(indexMutation.parse({action:"rewind",reason:"Missing event replay after archive recovery"}).action,"rewind");
 for(const action of ["seed","mint","claim","delete","schedule","stream","rebuild_ledger"]){
  assert.throws(()=>indexMutation.parse({action}));
 }
 assert.throws(()=>indexMutation.parse({action:"scan",limit:999999}));
 assert.throws(()=>indexMutation.parse({action:"scan",cursor:id}));
 assert.throws(()=>indexMutation.parse({action:"rewind",reason:"short"}));
 assert.equal(scanLimit,100);
 assert.equal(safetyLagSeconds,120);
});
test("Index total-order cursor is deterministic for same timestamps and distinct kinds",()=>{
 const at=new Date("2026-11-05T01:00:00.000Z");
 const a={occurred_at:at,kind:"comment",source_id:"11111111-1111-4111-8111-111111111111"};
 const b={...a,kind:"post"};
 const c={...a,source_id:"22222222-2222-4222-8222-222222222222"};
 assert.equal(compareCursor(a,a),0);
 assert.equal(compareCursor(a,b),-1);
 assert.equal(compareCursor(b,a),1);
 assert.equal(compareCursor(a,c),-1);
 assert.equal(compareCursor({...a,occurred_at:new Date(at.getTime()+1)},c),1);
 assert.throws(()=>compareCursor({...a,occurred_at:new Date("invalid")},b));
});
test("Risk review decisions are evidence-linked and cannot enforce or claim balances",()=>{
 assert.equal(riskMutation.parse({
  owner:person,signal:"repeated_counterparty",counterparty:another,
  disposition:"review",note:"Three independent reaction events checked",
 }).disposition,"review");
 assert.equal(riskMutation.parse({
  owner:person,signal:"high_daily_activity",counterparty:null,
  disposition:"dismissed",note:"High activity was manually reviewed",
 }).disposition,"dismissed");
 assert.throws(()=>riskMutation.parse({
  owner:person,signal:"repeated_counterparty",counterparty:null,
  disposition:"review",note:"Enough explanation for manual review",
 }));
 assert.throws(()=>riskMutation.parse({
  owner:person,signal:"high_daily_activity",counterparty:another,
  disposition:"review",note:"Enough explanation for manual review",
 }));
 assert.throws(()=>riskMutation.parse({
  owner:person,signal:"repeated_counterparty",counterparty:another,
  disposition:"auto_suspend",note:"Enough explanation for manual review",
 }));
});
test("M20 endpoint boundaries: real sources, moderator auth, atomic recovery, no scheduler",()=>{
 const index=read("src/app/api/social/index/route.ts");
 const health=read("src/app/api/social/ops/health/route.ts");
 const activity=read("src/app/api/social/ops/activity/route.ts");
 const risk=read("src/app/api/social/ops/risk/route.ts");
 const migration=read("db/migrations/007_durable_creator_index_and_review.sql");
 for(const c of [index,health,risk])assert.match(c,/assertModerator\(actor\)|assertModerator\(reviewer\)/);
 assert.match(activity,/requireViewer\(req\)/);
 assert.match(activity,/WHERE owner=\$1/);
 assert.match(index,/verifyRequestOrigin\(req\)/);
 assert.match(index,/FOR UPDATE/);
 assert.match(index,/ON CONFLICT\(kind,source_id\) DO NOTHING/);
 assert.match(index,/ROLLBACK/);
 assert.match(index,/social_index_runs/);
 assert.match(health,/reconcileApproved\(conn,40\)/);
 assert.match(risk,/proof\.rows\[0\]\.events<threshold/);
 assert.match(migration,/PRIMARY KEY\(kind,source_id\)/);
 assert.match(migration,/social_index_checkpoints/);
 assert.match(migration,/social_risk_review_events/);
 for(const code of [index,health,activity,risk]){
  assert.ok(!code.includes("eth_sendTransaction"));
  assert.ok(!code.includes("mintToken("));
  assert.ok(!code.includes("claimRewards("));
  assert.ok(!code.includes("cron.schedule"));
 }
});
