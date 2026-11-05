import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {POST as authPOST,GET as authGET} from "../src/app/api/social/auth/route";
import {GET as socialGET,POST as socialPOST} from "../src/app/api/social/route";
import {GET as moderationGET} from "../src/app/api/social/moderation/route";
import {GET as acceptanceGET} from "../src/app/api/social/ops/acceptance/route";
import {GET as pointsGET} from "../src/app/api/social/points/route";
import {GET as indexGET,POST as indexPOST} from "../src/app/api/social/index/route";
import {POST as engagePOST} from "../src/app/api/social/engagement/route";
import {POST as riskPOST} from "../src/app/api/social/ops/risk/route";

const identity=privateKeyToAccount(bytesToHex(randomBytes(32)));
const otherSigner=privateKeyToAccount(bytesToHex(randomBytes(32)));
const wallets=[identity.address.toLowerCase(),otherSigner.address.toLowerCase(),
 "0x"+randomBytes(20).toString("hex")];
const [creator,fan,moderator]=wallets;
const tokens=new Map<string,string>();
const handle=(a:string)=>"u"+a.slice(2,17);
const flags=[
 "LOOKE_SOCIAL_MODERATORS","LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
 "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED","LOOKE_SOCIAL_APP_ORIGIN",
];
const prev=new Map<string,string|undefined>();
let uploaded="",mediaPost="",plainPost="",seasonId="",ledgerId="";
let originalCheckpoint:{cursor_at:Date;cursor_kind:string;cursor_id:string;revision:string}|null=null;
function request(actor:string|null,method:"GET"|"POST",path:string,body?:Record<string,unknown>,
 origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor?{cookie:COOKIE_NAME+"="+tokens.get(actor)}:{}),
   ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
  },
  ...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
async function submit(actor:string|null,body:Record<string,unknown>,origin?:string){
 return socialPOST(request(actor,"POST","/api/social",body,origin));
}
async function authenticatedAction(actor:string|null,body:Record<string,unknown>,origin?:string){
 return authPOST(request(actor,"POST","/api/social/auth",body,origin));
}
before(async()=>{
 for(const k of flags)prev.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_MODERATORS=moderator;
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="true";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="true";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="true";
 process.env.LOOKE_M20_INDEX_WRITES_ENABLED="true";
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 for(const a of wallets){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
   VALUES($1,$2,'M21 disposable security fixture',now()-interval '4 days')`,[a,handle(a)]);
 }
 for(const a of [fan,moderator]){
  const t=randomBytes(32).toString("hex");tokens.set(a,t);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
   VALUES($1,$2,now()+interval '30 minutes')`,
   [createHash("sha256").update(t).digest("hex"),a]);
 }
 const cp=await query<{cursor_at:Date;cursor_kind:string;cursor_id:string;revision:string}>(`
  SELECT cursor_at,cursor_kind,cursor_id,revision FROM social_index_checkpoints WHERE stream='creator_activity'`);
 originalCheckpoint=cp.rows[0];
});
after(async()=>{
 try{
  if(ledgerId)await query("DELETE FROM social_points_review_audit WHERE ledger_id=$1",[ledgerId]);
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_index_runs WHERE operator=$1",[moderator]);
  await query("DELETE FROM social_moderation_audit WHERE moderator=$1",[moderator]);
  await query("DELETE FROM social_risk_review_events WHERE reviewer=$1",[moderator]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[wallets]);
  await query("DELETE FROM social_auth_challenges WHERE address=$1",[creator]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[wallets]);
  if(originalCheckpoint)await query(`
   UPDATE social_index_checkpoints SET cursor_at=$1,cursor_kind=$2,cursor_id=$3,
    revision=$4 WHERE stream='creator_activity'`,
   [originalCheckpoint.cursor_at,originalCheckpoint.cursor_kind,
    originalCheckpoint.cursor_id,originalCheckpoint.revision]);
 }finally{
  for(const k of flags){const v=prev.get(k);if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("Actual EIP-191 CI wallet signature is origin-bound, single-use and wallet-specific",async()=>{
 assert.equal((await authenticatedAction(null,{action:"challenge",address:creator},"https://evil.example")).status,403);
 const r=await authenticatedAction(null,{action:"challenge",address:creator});
 assert.equal(r.status,200);
 const challenge=await json(r);
 assert.equal(challenge.network,"Ultra EVM Testnet (18881)");
 const message=challenge.message as string,challengeId=challenge.challengeId as string;
 const badSignature=await otherSigner.signMessage({message});
 assert.equal((await authenticatedAction(null,{action:"verify",challengeId,signature:badSignature})).status,401);
 const correct=await identity.signMessage({message});
 const signed=await authenticatedAction(null,{action:"verify",challengeId,signature:correct});
 assert.equal(signed.status,200);
 const cookie=signed.cookies.get(COOKIE_NAME)?.value;
 assert.ok(cookie&&/^[0-9a-f]{64}$/.test(cookie));
 tokens.set(creator,cookie!);
 const me=await json(await authGET(request(creator,"GET","/api/social/auth")));
 assert.equal(me.authenticated,true);
 assert.equal((me.user as {address:string}).address,creator);
 assert.equal((await authenticatedAction(null,{action:"verify",challengeId,signature:correct})).status,401);
 assert.equal((await authGET(request(null,"GET","/api/social/auth"))).status,200);
 const noSession=await json(await authGET(request(null,"GET","/api/social/auth")));
 assert.equal(noSession.authenticated,false);
});
test("Media attachment is one-use and owned by the wallet; pending post is not publicly visible",async()=>{
 const publicId="looke/social/"+creator+"/"+randomUUID();
 const verifiedUrl="https://res.cloudinary.com/lookecloud/image/upload/v123/"+publicId+".png";
 uploaded=(await query<{id:string}>(`
  INSERT INTO social_media_uploads(owner,public_id,kind,mime,declared_bytes,
   expires_at,state,verified_url,provider_asset_id,verified_at)
  VALUES($1,$2,'image','image/png',1024,now()+interval '15 minutes',
   'verified',$3,'ci-provider-fixture-id123',now()) RETURNING id`,
  [creator,publicId,verifiedUrl])).rows[0].id;
 // Test-only DB fixture, not a Cloudinary API receipt or real hosted upload.
 assert.equal((await submit(fan,{action:"post",body:"Cross-wallet upload theft",mediaUploadId:uploaded})).status,409);
 assert.equal((await submit(creator,{action:"post",body:"Raw URLs are not authorized",
  media:{url:verifiedUrl,kind:"image"}})).status,400);
 const posted=await submit(creator,{action:"post",body:"M21 creator media needing review",
  mediaUploadId:uploaded});
 assert.equal(posted.status,200);
 mediaPost=((await json(posted)).post as {id:string;media_status:string}).id;
 assert.equal((await submit(creator,{action:"post",body:"Second reuse prohibited",mediaUploadId:uploaded})).status,409);
 const db=await query<{state:string;post_id:string}>(`
  SELECT state,post_id FROM social_media_uploads WHERE id=$1`,[uploaded]);
 assert.equal(db.rows[0].state,"attached");assert.equal(db.rows[0].post_id,mediaPost);
 const feed=await json(await socialGET(request(null,"GET","/api/social?action=feed")));
 assert.ok(!(feed.posts as {id:string}[]).some(p=>p.id===mediaPost));
 assert.equal((await engagePOST(request(fan,"POST","/api/social/engagement",
  {action:"like",postId:mediaPost}))).status,404);
});
test("Moderation is authorization-bound and makes a genuine CI post visible only after audit",async()=>{
 assert.equal((await moderationGET(request(creator,"GET","/api/social/moderation"))).status,403);
 const queue=await json(await moderationGET(request(moderator,"GET","/api/social/moderation")));
 assert.ok((queue.media as {id:string}[]).some(m=>m.id===mediaPost));
 const input={action:"moderate",operation:"approve_media",targetId:mediaPost,
  reason:"CI moderator manually reviewed disposable image fixture"};
 assert.equal((await submit(creator,input)).status,403);
 assert.equal((await submit(moderator,input,"https://evil.example")).status,403);
 assert.equal((await submit(moderator,input)).status,200);
 assert.equal((await submit(moderator,input)).status,404);
 const audit=await query<{action:string}>(`
  SELECT action FROM social_moderation_audit WHERE moderator=$1 AND target_id=$2`,
  [moderator,mediaPost]);
 assert.deepEqual(audit.rows.map(x=>x.action),["approve_media"]);
 const feed=await json(await socialGET(request(null,"GET","/api/social?action=feed")));
 assert.ok((feed.posts as {id:string}[]).some(x=>x.id===mediaPost));
 assert.equal((await engagePOST(request(creator,"POST","/api/social/engagement",
  {action:"like",postId:mediaPost}))).status,403);
 assert.equal((await engagePOST(request(fan,"POST","/api/social/engagement",
  {action:"like",postId:mediaPost}))).status,200);
});
test("Real signed-in creator receives private Points history and risk has no invented verdict",async()=>{
 const posted=await submit(creator,{action:"post",body:"M21 verified creator post for Points reconciliation"});
 assert.equal(posted.status,200);
 plainPost=((await json(posted)).post as {id:string}).id;
 await query("UPDATE social_posts SET created_at=now()-interval '5 minutes' WHERE id=$1",[plainPost]);
 seasonId=(await query<{id:string}>(`
  INSERT INTO social_points_seasons(slug,title,state,starts_at,ends_at,
   vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M21 disposable reviewed Points season','active',
   now()-interval '1 day',now()+interval '1 day',
   now()+interval '2 days',now()+interval '3 days',
   now()+interval '10 days') RETURNING id`,
  ["m21-ci-"+randomBytes(6).toString("hex")])).rows[0].id;
 const postedAt=(await query<{created_at:Date}>(
  "SELECT created_at FROM social_posts WHERE id=$1",[plainPost])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`
  INSERT INTO social_points_ledger(
   season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at
  ) VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
   'CI independent source-link check only',$6,now()) RETURNING id`,
  [seasonId,creator,plainPost,postedAt,postedAt.toISOString().slice(0,10),moderator])).rows[0].id;
 await query(`INSERT INTO social_points_review_audit(ledger_id,moderator,decision,reason)
  VALUES($1,$2,'approved','CI independent source-link check only')`,[ledgerId,moderator]);
 const mine=await json(await pointsGET(request(creator,"GET","/api/social/points?owner="+fan)));
 assert.equal(mine.ownerScoped,true);assert.equal(mine.claimingEnabled,false);
 assert.equal(mine.tokensIssued,false);
 assert.equal((mine.history as {id:string}[])[0].id,ledgerId);
 const stranger=await json(await pointsGET(request(fan,"GET","/api/social/points?owner="+creator)));
 assert.equal((stranger.history as unknown[]).length,0);
 const risk=await riskPOST(request(moderator,"POST","/api/social/ops/risk",{
  owner:creator,signal:"repeated_counterparty",counterparty:fan,
  disposition:"escalated",note:"Must have real on-record signals before review",
 }));
 assert.equal(risk.status,409);
});
test("M20 recovery is repeatable and keeps M21 read-only source reconciliations intact",async()=>{
 const run=await indexPOST(request(moderator,"POST","/api/social/index",{action:"scan"}));
 assert.equal(run.status,200);
 const scanned=await json(run);assert.ok((scanned.scanned as number)>=1);
 const health=await json(await acceptanceGET(request(moderator,"GET","/api/social/ops/acceptance")));
 assert.equal(health.authorized,true);
 assert.equal(health.readOnly,true);
 const report=health.report as {status:string;required:number;verified:number;publicBetaOpen:boolean;
  transactionsSent:number;blocked:string[]};
 assert.equal(report.status,"blocked");assert.equal(report.publicBetaOpen,false);
 assert.equal(report.transactionsSent,0);assert.equal(report.required,18);
 assert.ok(report.blocked.includes("walletSessionWitness"));
 assert.ok(report.blocked.includes("nativeUniqOwnershipProof"));
 assert.equal((health.reconciliation as {issues:unknown[]}).issues.length,0);
 const rewind=await indexPOST(request(moderator,"POST","/api/social/index",
  {action:"rewind",reason:"M21 recovery replay and integrity verification"}));
 assert.equal(rewind.status,200);
 const replay=await indexPOST(request(moderator,"POST","/api/social/index",{action:"scan"}));
 assert.equal(replay.status,200);
 const reopened=await json(replay);
 assert.equal(reopened.inserted,0);
 assert.ok((reopened.replayed as number)>=1);
 const ledger=await query<{status:string;points:number}>(
  "SELECT status,points FROM social_points_ledger WHERE id=$1",[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");
 assert.equal(ledger.rows[0].points,10);
});
test("Suspended accounts cannot continue being advertised as authenticated wallets",async()=>{
 await query("UPDATE social_profiles SET suspended=true WHERE address=$1",[creator]);
 try{
  const result=await json(await authGET(request(creator,"GET","/api/social/auth")));
  assert.equal(result.authenticated,false);
  assert.equal(result.user,null);
  assert.equal((await submit(creator,{action:"post",body:"Suspended account cannot post"})).status,403);
  assert.equal((await acceptanceGET(request(creator,"GET","/api/social/ops/acceptance"))).status,403);
 }finally{
  await query("UPDATE social_profiles SET suspended=false WHERE address=$1",[creator]);
 }
});
test("Failed closed beta flags prevent media/engagement/Points/index writes without leaking moderator data",async()=>{
 assert.equal((await acceptanceGET(request(creator,"GET","/api/social/ops/acceptance"))).status,403);
 assert.equal((await acceptanceGET(request(null,"GET","/api/social/ops/acceptance"))).status,401);
 const priorWrites=process.env.LOOKE_SOCIAL_WRITES_ENABLED;
 const priorMedia=process.env.LOOKE_MEDIA_UPLOADS_ENABLED;
 try{
  process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
  process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
  assert.equal((await submit(creator,{action:"post",body:"Disabled social action"})).status,503);
  assert.equal((await engagePOST(request(fan,"POST","/api/social/engagement",
   {action:"like",postId:plainPost}))).status,503);
  assert.equal((await indexPOST(request(moderator,"POST","/api/social/index",{action:"scan"}))).status,503);
  const report=await json(await acceptanceGET(request(moderator,"GET","/api/social/ops/acceptance")));
  assert.equal(report.flagsClosed,false); // M20 writes and Points still intentionally enabled in isolated CI.
 }finally{
  if(priorWrites===undefined)delete process.env.LOOKE_SOCIAL_WRITES_ENABLED;
  else process.env.LOOKE_SOCIAL_WRITES_ENABLED=priorWrites;
  if(priorMedia===undefined)delete process.env.LOOKE_MEDIA_UPLOADS_ENABLED;
  else process.env.LOOKE_MEDIA_UPLOADS_ENABLED=priorMedia;
 }
});
