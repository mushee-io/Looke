import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {GET as pointsGET} from "../src/app/api/social/points/route";
import {GET as operatorGET,POST as operatorPOST} from "../src/app/api/social/points/operator/route";

const people=Array.from({length:4},()=>"0x"+randomBytes(20).toString("hex"));
const [creator,fan,moderator,stranger]=people;
const handle=(x:string)=>"u"+x.slice(2,17);
const token=new Map<string,string>();
const policies:Record<string,string|undefined>={
 LOOKE_SOCIAL_MODERATORS:undefined,LOOKE_POINTS_ACCOUNTING_ENABLED:undefined,
 LOOKE_SOCIAL_WRITES_ENABLED:undefined,
};
let seasonId="",creatorPost="",secondPost="",thirdPost="",pendingPost="",commentId="",likeId="",secondLikeId="",repostId="",firstLedger="";
function request(user:string|null,method:"GET"|"POST",path:string,body?:Record<string,unknown>,origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(user?{cookie:"looke_social_dev="+token.get(user)}:{}),
   ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
async function queue(actor:string|null,kind:string,sourceId:string,origin?:string){
 return operatorPOST(request(actor,"POST","/api/social/points/operator",
  {action:"queue",seasonId,kind,sourceId},origin));
}
async function review(actor:string|null,entryId:string,decision:string,reason="Checked real participation with no abuse indicators"){
 return operatorPOST(request(actor,"POST","/api/social/points/operator",
  {action:"review",entryId,decision,reason}));
}
before(async()=>{
 for(const key of Object.keys(policies))policies[key]=process.env[key];
 process.env.LOOKE_SOCIAL_MODERATORS=moderator;
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="true";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="true";
 for(const addr of people){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
    VALUES($1,$2,'M19 temporary creator',now()-interval '4 days')`,[addr,handle(addr)]);
  const secret=randomBytes(32).toString("hex");token.set(addr,secret);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
     VALUES($1,$2,now()+interval '30 minutes')`,
     [createHash("sha256").update(secret).digest("hex"),addr]);
 }
 const s=await query<{id:string}>(`
  INSERT INTO social_points_seasons(slug,title,state,starts_at,ends_at,
    vest_start_at,vest_cliff_at,vest_end_at,points_post,points_comment,
    points_like_received,points_repost_received)
  VALUES($1,'M19 Disposable Points Season','active',
    now()-interval '1 day',now()+interval '1 day',
    now()+interval '1 day',now()+interval '2 days',now()+interval '10 days',
    10,2,1,2) RETURNING id`,
  ["m19-ci-"+randomBytes(6).toString("hex")]);seasonId=s.rows[0].id;
 const p=await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M19 verified creator post') RETURNING id`,[creator]);
 creatorPost=p.rows[0].id;
 secondPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M19 second creator post') RETURNING id`,
  [creator])).rows[0].id;
 thirdPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M19 third creator post') RETURNING id`,
  [creator])).rows[0].id;
 pendingPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'M19 hidden pending hosted media','https://res.cloudinary.com/example/image/upload/ci.png',
   'image','pending') RETURNING id`,[creator])).rows[0].id;
 commentId=(await query<{id:string}>(`
  INSERT INTO social_comments(author,post_id,body)
  VALUES($1,$2,'M19 genuine cross-creator participation') RETURNING id`,
  [fan,creatorPost])).rows[0].id;
 likeId=(await query<{id:string}>(`
  INSERT INTO social_post_likes(actor,post_id) VALUES($1,$2) RETURNING id`,
  [fan,creatorPost])).rows[0].id;
 secondLikeId=(await query<{id:string}>(`
  INSERT INTO social_post_likes(actor,post_id) VALUES($1,$2) RETURNING id`,
  [fan,secondPost])).rows[0].id;
 repostId=(await query<{id:string}>(`
  INSERT INTO social_post_reposts(actor,post_id) VALUES($1,$2) RETURNING id`,
  [fan,creatorPost])).rows[0].id;
});
after(async()=>{
 const q=await query<{id:string}>("SELECT id FROM social_points_ledger WHERE season_id=$1",[seasonId]);
 const ids=q.rows.map(x=>x.id);
 if(ids.length)await query("DELETE FROM social_points_review_audit WHERE ledger_id=ANY($1::uuid[])",[ids]);
 await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
 await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
 await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[people]);
 await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[people]);
 for(const [k,v] of Object.entries(policies)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
 await socialDb().end();
});
test("No synthetic Points or vesting: signed-in wallet starts at actual zero",async()=>{
 assert.equal((await pointsGET(request(null,"GET","/api/social/points"))).status,401);
 const r=await pointsGET(request(creator,"GET","/api/social/points?owner="+fan));
 assert.equal(r.status,200);
 const b=await json(r);
 assert.equal(b.claimingEnabled,false);assert.equal(b.tokensIssued,false);
 assert.equal(b.ownerScoped,true);assert.equal(b.unit,"LOOKE_POINTS");
 const season=(b.seasons as {approvedPoints:string;pendingPoints:string;vesting:{unlocked:string}}[])[0];
 assert.equal(season.approvedPoints,"0");assert.equal(season.pendingPoints,"0");
 assert.equal(season.vesting.unlocked,"0");
 assert.equal((b.history as unknown[]).length,0);
 assert.equal((await operatorGET(request(creator,"GET","/api/social/points/operator"))).status,403);
 assert.equal((await operatorGET(request(null,"GET","/api/social/points/operator"))).status,401);
});
test("Operator queue records real evidence as pending, never awards points automatically",async()=>{
 assert.equal((await queue(creator,"post",creatorPost)).status,403);
 assert.equal((await queue(moderator,"post",creatorPost,"https://other.test")).status,403);
 assert.equal((await queue(moderator,"post",pendingPost)).status,404);
 const r=await queue(moderator,"post",creatorPost);
 assert.equal(r.status,200);
 const data=await json(r);firstLedger=data.id as string;
 assert.equal(data.status,"pending");assert.equal(data.sourceVerified,true);
 const duplicated=await queue(moderator,"post",creatorPost);
 assert.equal(duplicated.status,409);
 const read=await json(await pointsGET(request(creator,"GET","/api/social/points")));
 const season=(read.seasons as {approvedPoints:string;pendingPoints:string}[])[0];
 assert.equal(season.approvedPoints,"0");assert.equal(season.pendingPoints,"10");
 const other=await json(await pointsGET(request(stranger,"GET","/api/social/points")));
 assert.equal((other.history as unknown[]).length,0);
});
test("Anti-sybil limits duplicate counterparty reactions and per-day creator farming",async()=>{
 assert.equal((await queue(moderator,"post",secondPost)).status,200);
 assert.equal((await queue(moderator,"post",thirdPost)).status,409);
 const first=await queue(moderator,"like_received",likeId);
 assert.equal(first.status,200);
 assert.equal((await queue(moderator,"like_received",secondLikeId)).status,409);
 assert.equal((await queue(moderator,"repost_received",repostId)).status,200);
 assert.equal((await queue(moderator,"comment",commentId)).status,200);
 const rows=await query<{source_kind:string;owner:string}>(`
  SELECT source_kind,owner FROM social_points_ledger WHERE season_id=$1`,[seasonId]);
 assert.equal(rows.rows.length,5);
 assert.ok(rows.rows.some(x=>x.source_kind==="comment"&&x.owner===fan));
 assert.equal(rows.rows.filter(x=>x.source_kind==="like_received"&&x.owner===creator).length,1);
});
test("Review approval requires actual evidence and gives the right owner genuine approved Points",async()=>{
 assert.equal((await review(creator,firstLedger,"approved")).status,403);
 assert.equal((await review(moderator,firstLedger,"approved","short")).status,400);
 const done=await review(moderator,firstLedger,"approved");
 assert.equal(done.status,200);
 assert.equal((await review(moderator,firstLedger,"approved")).status,409);
 const view=await json(await pointsGET(request(creator,"GET","/api/social/points")));
 const balance=(view.seasons as {approvedPoints:string;pendingPoints:string;vesting:{unlocked:string;claimable:boolean}}[])[0];
 assert.equal(balance.approvedPoints,"10");assert.equal(balance.vesting.unlocked,"0");
 assert.equal(balance.vesting.claimable,false);
 assert.ok((view.history as {status:string}[]).some(x=>x.status==="approved"));
 const other=await json(await pointsGET(request(fan,"GET","/api/social/points")));
 assert.equal((other.seasons as {approvedPoints:string}[])[0].approvedPoints,"0");
});
test("Review revocation adjusts Points and leaves append-only reasoned history",async()=>{
 const reversed=await review(moderator,firstLedger,"reversed","Content removed from Points eligibility after recheck");
 assert.equal(reversed.status,200);
 assert.equal((await review(moderator,firstLedger,"reversed")).status,409);
 const view=await json(await pointsGET(request(creator,"GET","/api/social/points")));
 const one=(view.seasons as {approvedPoints:string;reversedPoints:string}[])[0];
 assert.equal(one.approvedPoints,"0");assert.equal(one.reversedPoints,"10");
 const audit=await query<{decision:string}>(`
  SELECT decision FROM social_points_review_audit WHERE ledger_id=$1`,[firstLedger]);
 assert.deepEqual(audit.rows.map(x=>x.decision).sort(),["approved","reversed"]);
});
test("Explicit closed Preview stops Points writing, while private read-only history remains",async()=>{
 const prior=process.env.LOOKE_POINTS_ACCOUNTING_ENABLED;
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 try{
  assert.equal((await queue(moderator,"post",thirdPost)).status,503);
  assert.equal((await review(moderator,firstLedger,"approved")).status,503);
  const view=await pointsGET(request(creator,"GET","/api/social/points"));
  assert.equal(view.status,200);
 }finally{if(prior===undefined)delete process.env.LOOKE_POINTS_ACCOUNTING_ENABLED;
  else process.env.LOOKE_POINTS_ACCOUNTING_ENABLED=prior;}
});
