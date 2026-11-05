import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {GET} from "../src/app/api/social/ops/m28/route";
import {reconcileEntirePointsLedger,digestM27Database,compareM27Databases} from "../src/lib/beta/m27-evidence";
import {createHash} from "node:crypto";
const operator="0x"+randomBytes(20).toString("hex");
const wallet="0x"+randomBytes(20).toString("hex");
const addresses=[operator,wallet];
const keys=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS","LOOKE_M23_PREVIEW_ORIGIN",
 "LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA","LOOKE_PUBLIC_BETA_ENABLED",
 "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED"];
const original=new Map<string,string|undefined>();
let token="",postId="",mediaId="",seasonId="",ledgerId="";
function request(actor:"moderator"|"anonymous",querystring=""){
 return new NextRequest("http://localhost:3000/api/social/ops/m28"+querystring,{
  headers:actor==="moderator"?{cookie:COOKIE_NAME+"="+token}:{},
 });
}
async function read(querystring=""){return GET(request("moderator",querystring));}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
before(async()=>{
 for(const k of keys)original.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN="https://looke-m28-ci.vercel.app";
 process.env.LOOKE_M23_PREVIEW_SHA="a".repeat(40);
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const a of addresses)await query(`INSERT INTO social_profiles(address,handle,display_name)
  VALUES($1,$2,'Disposable M28 fixture only')`,[a,"u"+a.slice(2,17)]);
 token=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '1 hour')`,
  [createHash("sha256").update(token).digest("hex"),operator]);
 postId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'M28 disposable source row',now()-interval '7 minutes') RETURNING id`,
  [wallet])).rows[0].id;
 mediaId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'Unapproved disposable media record',
   'https://res.cloudinary.com/ci/image/upload/v1/test.png','image','pending')
   RETURNING id`,[wallet])).rows[0].id;
 seasonId=(await query<{id:string}>(`INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M28 disposable Points','active',now()-interval '3 days',
   now()+interval '3 days',now()+interval '5 days',now()+interval '8 days',
   now()+interval '25 days') RETURNING id`,
  ["m28-"+randomBytes(7).toString("hex")])).rows[0].id;
 const when=(await query<{created_at:Date}>(`SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
   'Actual disposable CI source policy review',$6,now()) RETURNING id`,
  [seasonId,wallet,postId,when,when.toISOString().slice(0,10),operator])).rows[0].id;
});
after(async()=>{
 try{
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[addresses]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[addresses]);
 }finally{
  for(const k of keys){const v=original.get(k);if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("M28 rejects anonymous inspection, uses genuine DB and returns strict launch NO-GO",async()=>{
 assert.equal((await GET(request("anonymous"))).status,401);
 const r=await read();assert.equal(r.status,200);
 const x=await json(r);
 assert.equal(x.operatorAuthorized,true);
 assert.equal((x.gate as {decision:string}).decision,"NO_GO");
 assert.equal(x.publicBetaOpen,false);
 assert.equal(x.productionDeploymentAltered,false);
 assert.equal(x.transactionsSent,0);
 assert.equal((x.liveMedia as {status:string}).status,"not_checked");
 assert.equal((x.recovery as {fullTables:number}).fullTables,19);
 assert.equal((x.points as {complete:boolean}).complete,true);
 assert.equal((x.points as {totalApproved:number}).totalApproved,1);
});
test("Actual pending unmoderated media cannot be counted as authenticated provider-approved",async()=>{
 const r=await read("?inspectProvider=true");assert.equal(r.status,200);
 const x=await json(r);
 assert.equal((x.liveMedia as {status:string}).status,"blocked");
 assert.equal((x.liveMedia as {actualApprovedSourceRows:number}).actualApprovedSourceRows,0);
 const media=await query<{media_status:string}>(`SELECT media_status FROM social_posts WHERE id=$1`,[mediaId]);
 assert.equal(media.rows[0].media_status,"pending");
});
test("Invalid chain identifiers are blocked rather than guessed, with no broadcasts",async()=>{
 const r=await read("?tokenFactory=invalid&coinTx=0x00&uniqFactoryId=no&uniqOwner=bad&uniqTokenId=0");
 assert.equal(r.status,200);
 const x=await json(r);
 const chain=x.chain as {token:{status:string};uniq:{status:string};bothIndependentlyVerified:boolean;transactionBroadcasts:number};
 assert.equal(chain.token.status,"blocked");
 assert.equal(chain.uniq.status,"blocked");
 assert.equal(chain.bothIndependentlyVerified,false);
 assert.equal(chain.transactionBroadcasts,0);
});
test("Actual approved Points source drift stays visible but the ledger cannot be auto-mutated",async()=>{
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
 const r=await read();assert.equal(r.status,200);
 const x=await json(r);
 const points=x.points as {complete:boolean;issues:{ledgerId:string}[]};
 assert.equal(points.complete,true);
 assert.ok(points.issues.some(i=>i.ledgerId===ledgerId));
 const ledger=await query<{status:string;points:number}>(`
   SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");assert.equal(ledger.rows[0].points,10);
});
test("Nineteen full real PostgreSQL tables include both review and witness ledgers; no false restore claim",async()=>{
 const c=await socialDb().connect();
 try{
  const s=await digestM27Database(c,false);
  assert.equal(s.length,19);
  const matched=compareM27Databases(s,s.map(x=>({...x})));
  assert.equal(matched.comparison,"MATCHED_FULL_ROWS");
  assert.equal(matched.operatorRestoreWitnessAccepted,false);
  assert.equal(matched.releaseAuthorized,false);
 }finally{c.release();}
});
