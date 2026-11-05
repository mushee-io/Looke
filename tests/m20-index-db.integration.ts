import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {GET as indexGET,POST as indexPOST} from "../src/app/api/social/index/route";
import {GET as healthGET} from "../src/app/api/social/ops/health/route";
import {GET as activityGET} from "../src/app/api/social/ops/activity/route";
import {GET as riskGET,POST as riskPOST} from "../src/app/api/social/ops/risk/route";

const persons=Array.from({length:4},()=>"0x"+randomBytes(20).toString("hex"));
const [creator,fan,moderator,outsider]=persons;
const tokens=new Map<string,string>();
const handle=(address:string)=>"u"+address.slice(2,17);
const envKeys=["LOOKE_SOCIAL_MODERATORS","LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED"];
const previous=new Map<string,string|undefined>();
const originalCheckpoint={cursorAt:"",kind:"",id:"",revision:""};
let postIds:string[]=[],likeIds:string[]=[],commentId="",repostId="",seasonId="",ledgerId="";
function request(actor:string|null,method:"GET"|"POST",path:string,data?:Record<string,unknown>,origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor?{cookie:"looke_social_dev="+tokens.get(actor)}:{}),
   ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
  },...(data?{body:JSON.stringify(data)}:{}),
 });
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
const scan=(actor:string|null,action:"scan"|"rewind"="scan",origin?:string)=>
 indexPOST(request(actor,"POST","/api/social/index",
  action==="scan"?{action}:{action,reason:"Replay requested after verified recovery rehearsal"},origin));
const riskDecision=(actor:string|null,data:Record<string,unknown>,origin?:string)=>
 riskPOST(request(actor,"POST","/api/social/ops/risk",data,origin));

before(async()=>{
 for(const k of envKeys)previous.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_MODERATORS=moderator;
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="true";
 process.env.LOOKE_M20_INDEX_WRITES_ENABLED="true";
 for(const account of persons){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
   VALUES($1,$2,'M20 disposable Testnet identity',now()-interval '4 days')`,
   [account,handle(account)]);
  const token=randomBytes(32).toString("hex");tokens.set(account,token);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
   VALUES($1,$2,now()+interval '30 minutes')`,
   [createHash("sha256").update(token).digest("hex"),account]);
 }
 const cp=await query<{cursor_at:Date;cursor_kind:string;cursor_id:string;revision:string}>(`
  SELECT cursor_at,cursor_kind,cursor_id,revision FROM social_index_checkpoints WHERE stream='creator_activity'`);
 assert.equal(cp.rowCount,1);
 originalCheckpoint.cursorAt=cp.rows[0].cursor_at.toISOString();
 originalCheckpoint.kind=cp.rows[0].cursor_kind;
 originalCheckpoint.id=cp.rows[0].cursor_id;
 originalCheckpoint.revision=cp.rows[0].revision;
 for(let i=0;i<8;i++){
  const p=await query<{id:string}>(`
    INSERT INTO social_posts(author,body,created_at)
    VALUES($1,$2,now()-interval '5 minutes'+($3::integer*interval '1 second')) RETURNING id`,
    [creator,"M20 source-backed original post "+i,i]);
  postIds.push(p.rows[0].id);
 }
 for(let i=0;i<3;i++){
  const l=await query<{id:string}>(`
   INSERT INTO social_post_likes(actor,post_id,created_at)
   VALUES($1,$2,now()-interval '4 minutes') RETURNING id`,[fan,postIds[i]]);
  likeIds.push(l.rows[0].id);
 }
 repostId=(await query<{id:string}>(`
  INSERT INTO social_post_reposts(actor,post_id,created_at)
  VALUES($1,$2,now()-interval '4 minutes') RETURNING id`,[fan,postIds[0]])).rows[0].id;
 commentId=(await query<{id:string}>(`
  INSERT INTO social_comments(author,post_id,body,created_at)
  VALUES($1,$2,'M20 authentic posted comment',now()-interval '4 minutes')
  RETURNING id`,[fan,postIds[0]])).rows[0].id;
 seasonId=(await query<{id:string}>(`
  INSERT INTO social_points_seasons(slug,title,state,starts_at,ends_at,
    vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M20 Disposable Evidence Season','active',
    now()-interval '1 day',now()+interval '1 day',
    now()+interval '2 days',now()+interval '3 days',
    now()+interval '10 days') RETURNING id`,
  ["m20-ci-"+randomBytes(6).toString("hex")])).rows[0].id;
 const created=await query<{created_at:Date}>(`SELECT created_at FROM social_posts WHERE id=$1`,[postIds[0]]);
 const at=created.rows[0].created_at;
 ledgerId=(await query<{id:string}>(`
  INSERT INTO social_points_ledger
    (season_id,owner,source_kind,source_id,source_actor,
     activity_at,activity_day,points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
    'M20 disposable verified source fixture',$6,now())
  RETURNING id`,
  [seasonId,creator,postIds[0],at,at.toISOString().slice(0,10),moderator])).rows[0].id;
 await query(`
   INSERT INTO social_points_review_audit(ledger_id,moderator,decision,reason)
   VALUES($1,$2,'approved','M20 disposable verified source fixture')`,[ledgerId,moderator]);
});
after(async()=>{
 try{
  await query(`DELETE FROM social_risk_review_events WHERE reviewer=$1`,[moderator]);
  await query(`DELETE FROM social_index_runs WHERE operator=$1`,[moderator]);
  await query(`DELETE FROM social_points_review_audit WHERE ledger_id=$1`,[ledgerId]);
  await query(`DELETE FROM social_points_ledger WHERE season_id=$1`,[seasonId]);
  await query(`DELETE FROM social_points_seasons WHERE id=$1`,[seasonId]);
  await query(`DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])`,[persons]);
  await query(`DELETE FROM social_profiles WHERE address=ANY($1::text[])`,[persons]);
  // Reset only CI-local checkpoint metadata; never touch another environment.
  await query(`UPDATE social_index_checkpoints SET
    cursor_at=$1,cursor_kind=$2,cursor_id=$3,revision=$4 WHERE stream='creator_activity'`,
    [originalCheckpoint.cursorAt,originalCheckpoint.kind,originalCheckpoint.id,originalCheckpoint.revision]);
 }finally{
  for(const k of envKeys){
   const v=previous.get(k);if(v===undefined)delete process.env[k];else process.env[k]=v;
  }
  await socialDb().end();
 }
});
test("Unauthorized readers and forged operators fail closed",async()=>{
 assert.equal((await indexGET(request(null,"GET","/api/social/index"))).status,401);
 assert.equal((await indexGET(request(creator,"GET","/api/social/index"))).status,403);
 assert.equal((await healthGET(request(creator,"GET","/api/social/ops/health"))).status,403);
 assert.equal((await riskGET(request(null,"GET","/api/social/ops/risk"))).status,401);
 assert.equal((await scan(creator)).status,403);
 assert.equal((await scan(moderator,"scan","https://evil.test")).status,403);
 const initial=await json(await activityGET(request(creator,"GET","/api/social/ops/activity")));
 assert.equal(initial.ownerScoped,true);
 assert.deepEqual(initial.activity,[]);
});
test("Manual 100-event bounded scan journals only genuine posted creator events",async()=>{
 const r=await scan(moderator);
 assert.equal(r.status,200);
 const v=await json(r);
 assert.equal(v.scanned,13);assert.equal(v.inserted,13);
 assert.equal(v.hasMore,false);
 const records=await query<{kind:string;source_id:string;owner:string;source_actor:string}>(`
  SELECT kind,source_id,owner,source_actor FROM social_activity_index
  WHERE owner=$1 OR owner=$2`,[creator,fan]);
 assert.equal(records.rowCount,13);
 assert.equal(records.rows.filter(x=>x.kind==="post"&&x.owner===creator).length,8);
 assert.equal(records.rows.filter(x=>x.kind==="like_received"&&x.owner===creator&&x.source_actor===fan).length,3);
 assert.equal(records.rows.filter(x=>x.kind==="comment"&&x.owner===fan&&x.source_actor===fan).length,1);
 assert.equal((await scan(moderator)).status,200);
 const once=await query<{count:number}>(`
  SELECT count(*)::integer AS count FROM social_activity_index WHERE owner=$1 OR owner=$2`,[creator,fan]);
 assert.equal(once.rows[0].count,13);
 const runs=await json(await indexGET(request(moderator,"GET","/api/social/index")));
 assert.equal(runs.manualOnly,true);assert.equal(runs.scanLagSeconds,120);
});
test("Account activity and Points analytics ignore spoofed owner parameters",async()=>{
 const owner=await json(await activityGET(request(creator,"GET","/api/social/ops/activity?owner="+outsider)));
 assert.equal(owner.ownerScoped,true);
 const indexed=owner.activity as {kind:string;indexed:number}[];
 assert.ok(indexed.some(x=>x.kind==="post"&&x.indexed===8));
 assert.ok(indexed.some(x=>x.kind==="like_received"&&x.indexed===3));
 const other=await json(await activityGET(request(outsider,"GET","/api/social/ops/activity?owner="+creator)));
 assert.deepEqual(other.activity,[]);
 assert.deepEqual(other.points,[]);
 assert.equal((await activityGET(request(null,"GET","/api/social/ops/activity"))).status,401);
});
test("Read-only reconciliation checks evidence, flags changed moderation, never rewrites Points",async()=>{
 const before=await json(await healthGET(request(moderator,"GET","/api/social/ops/health")));
 const good=before.reconciliation as {totalApproved:number;scanned:number;issues:unknown[];complete:boolean};
 assert.equal(good.totalApproved,1);assert.equal(good.scanned,1);assert.deepEqual(good.issues,[]);
 assert.equal(good.complete,true);
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postIds[0]]);
 const afterStatus=await json(await healthGET(request(moderator,"GET","/api/social/ops/health")));
 const drift=afterStatus.reconciliation as {issues:{ledgerId:string;reason:string}[]};
 assert.ok(drift.issues.some(x=>x.ledgerId===ledgerId&&x.reason==="source_missing_or_ineligible"));
 const ledger=await query<{status:string;points:number}>(`SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");assert.equal(ledger.rows[0].points,10);
});
test("Risk signals require genuine indexed events and persist only human audit judgments",async()=>{
 const signals=await json(await riskGET(request(moderator,"GET","/api/social/ops/risk")));
 const risk=signals.candidates as {
  repeatedCounterparties:{owner:string;counterparty:string;events:number}[];
  highDailyPosting:{owner:string;events:number}[];
 };
 assert.ok(risk.repeatedCounterparties.some(x=>x.owner===creator&&x.counterparty===fan&&x.events===4));
 assert.ok(risk.highDailyPosting.some(x=>x.owner===creator&&x.events===8));
 const invalid=await riskDecision(moderator,{
  owner:outsider,signal:"repeated_counterparty",counterparty:fan,
  disposition:"escalated",note:"The genuine event threshold must be met",
 });
 assert.equal(invalid.status,409);
 assert.equal((await riskDecision(creator,{
  owner:creator,signal:"high_daily_activity",counterparty:null,
  disposition:"review",note:"Testing denied non-moderator access",
 })).status,403);
 assert.equal((await riskDecision(moderator,{
  owner:creator,signal:"repeated_counterparty",counterparty:fan,
  disposition:"review",note:"Reviewed repeated interactions; no automated punishment",
 },"https://evil.test")).status,403);
 const good=await riskDecision(moderator,{
  owner:creator,signal:"repeated_counterparty",counterparty:fan,
  disposition:"review",note:"Reviewed repeated interactions; no automated punishment",
 });
 assert.equal(good.status,200);
 const saved=await json(good);assert.equal(saved.automatedEnforcement,false);
 const evidence=await query<{note:string}>(`
  SELECT note FROM social_risk_review_events WHERE reviewer=$1`,[moderator]);
 assert.equal(evidence.rowCount,1);
});
test("Transaction rollback leaves prior cursor and batch history unchanged",async()=>{
 const before=await query<{revision:string}>(`SELECT revision FROM social_index_checkpoints WHERE stream='creator_activity'`);
 const conn=await socialDb().connect();
 try{
  await conn.query("BEGIN");
  await conn.query(`SELECT revision FROM social_index_checkpoints WHERE stream='creator_activity' FOR UPDATE`);
  await conn.query(`UPDATE social_index_checkpoints SET revision=revision+1000 WHERE stream='creator_activity'`);
  await conn.query("ROLLBACK");
 }finally{conn.release();}
 const afterVersion=await query<{revision:string}>(`SELECT revision FROM social_index_checkpoints WHERE stream='creator_activity'`);
 assert.equal(afterVersion.rows[0].revision,before.rows[0].revision);
});
test("Audited recovery rewind + replay reconstructs an intact index without duplicate rows",async()=>{
 const original=await query<{count:number}>(`SELECT count(*)::integer AS count FROM social_activity_index
  WHERE owner=$1 OR owner=$2`,[creator,fan]);
 const rewind=await scan(moderator,"rewind");
 assert.equal(rewind.status,200);
 const rewindBody=await json(rewind);
 assert.equal(rewindBody.removedEntries,0);assert.equal(rewindBody.removedPoints,0);
 const redo=await scan(moderator);
 const rebuilt=await json(redo);
 assert.equal(rebuilt.scanned,13);assert.equal(rebuilt.inserted,0);
 assert.equal(rebuilt.replayed,13);
 const afterRestore=await query<{count:number}>(`SELECT count(*)::integer AS count FROM social_activity_index
  WHERE owner=$1 OR owner=$2`,[creator,fan]);
 assert.equal(afterRestore.rows[0].count,original.rows[0].count);
 const records=await query<{action:string}>(`SELECT action FROM social_index_runs WHERE operator=$1 ORDER BY created_at`,[moderator]);
 assert.ok(records.rows.some(x=>x.action==="rewind"));
 assert.equal((await query<{status:string}>(`SELECT status FROM social_points_ledger WHERE id=$1`,[ledgerId])).rows[0].status,"approved");
});
test("Disabled Preview forbids index and risk writes even for a moderator",async()=>{
 const old=process.env.LOOKE_M20_INDEX_WRITES_ENABLED;
 try{
  process.env.LOOKE_M20_INDEX_WRITES_ENABLED="false";
  assert.equal((await scan(moderator)).status,503);
  assert.equal((await riskDecision(moderator,{
   owner:creator,signal:"high_daily_activity",counterparty:null,
   disposition:"review",note:"Disabled operational review attempt",
  })).status,503);
  assert.equal((await healthGET(request(moderator,"GET","/api/social/ops/health"))).status,200);
 }finally{if(old===undefined)delete process.env.LOOKE_M20_INDEX_WRITES_ENABLED;
  else process.env.LOOKE_M20_INDEX_WRITES_ENABLED=old;}
});
