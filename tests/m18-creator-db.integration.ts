import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {GET as moderationGET,POST as moderationPOST} from "../src/app/api/social/moderation/route";
import {GET as analyticsGET} from "../src/app/api/social/analytics/route";
import {GET as controlsGET,POST as controlsPOST} from "../src/app/api/social/controls/route";
import {GET as socialGET,POST as socialPOST} from "../src/app/api/social/route";
import {GET as notificationsGET} from "../src/app/api/experience/notifications/route";

const wallets=Array.from({length:4},()=>"0x"+randomBytes(20).toString("hex"));
const [owner,fan,moderator,outsider]=wallets;
const handle=(v:string)=>"u"+v.slice(2,17);
const tokens=new Map<string,string>();
let originalModerators:string|undefined;
let visibleId="",pendingId="",fanId="",reportToAct="",reportToDismiss="";
function request(actor:string|null,method:"GET"|"POST",path:string,body?:Record<string,unknown>,origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor?{cookie:"looke_social_dev="+tokens.get(actor)}:{}),
   ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
  },
  ...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function responseJson(response:Response){return response.json() as Promise<Record<string,unknown>>;}
async function setting(actor:string|null,input:Record<string,unknown>,origin?:string){
 return controlsPOST(request(actor,"POST","/api/social/controls",input,origin));
}
async function review(actor:string|null,input:Record<string,unknown>,origin?:string){
 return moderationPOST(request(actor,"POST","/api/social/moderation",input,origin));
}
before(async()=>{
 originalModerators=process.env.LOOKE_SOCIAL_MODERATORS;
 process.env.LOOKE_SOCIAL_MODERATORS=moderator;
 for(const addr of wallets){
  await query("INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,$3)",
   [addr,handle(addr),"M18 integration fixture"]);
  const token=randomBytes(32).toString("hex");tokens.set(addr,token);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
   VALUES($1,$2,now()+interval '30 minutes')`,
   [createHash("sha256").update(token).digest("hex"),addr]);
 }
 visibleId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M18 visible creator content') RETURNING id`,
  [owner])).rows[0].id;
 fanId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M18 fan public post') RETURNING id`,
  [fan])).rows[0].id;
 pendingId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'M18 pending moderator review','https://res.cloudinary.com/test/image/upload/example.png',
   'image','pending') RETURNING id`,[owner])).rows[0].id;
 await query("INSERT INTO social_post_likes(actor,post_id) VALUES($1,$2)",[fan,visibleId]);
 await query("INSERT INTO social_post_reposts(actor,post_id) VALUES($1,$2)",[fan,visibleId]);
 await query("INSERT INTO social_comments(post_id,author,body) VALUES($1,$2,'M18 real database comment')",
  [visibleId,fan]);
 await query("INSERT INTO social_follows(follower,followed) VALUES($1,$2)",[fan,owner]);
 reportToAct=(await query<{id:string}>(`
  INSERT INTO social_reports(reporter,post_id,reason,details)
  VALUES($1,$2,'spam','M18 disposable report requiring action') RETURNING id`,
  [owner,fanId])).rows[0].id;
 reportToDismiss=(await query<{id:string}>(`
  INSERT INTO social_reports(reporter,post_id,reason,details)
  VALUES($1,$2,'other','M18 disposable report for dismissal') RETURNING id`,
  [fan,visibleId])).rows[0].id;
});
after(async()=>{
 await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[wallets]);
 await query("DELETE FROM social_report_resolutions WHERE moderator=$1",[moderator]);
 await query("DELETE FROM social_moderation_audit WHERE moderator=$1",[moderator]);
 await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[wallets]);
 if(originalModerators===undefined)delete process.env.LOOKE_SOCIAL_MODERATORS;
 else process.env.LOOKE_SOCIAL_MODERATORS=originalModerators;
 await socialDb().end();
});
test("Analytics are wallet-owned real Postgres counts; pending files never contribute public engagement",async()=>{
 const response=await analyticsGET(request(owner,"GET","/api/social/analytics?owner="+fan));
 assert.equal(response.status,200);
 const data=await responseJson(response);
 assert.equal(data.ownerScoped,true);
 const summary=data.summary as {posts:number;pending_media:number;followers:number;
  likes_received:number;reposts_received:number;comments_received:number};
 assert.equal(summary.posts,1);
 assert.equal(summary.pending_media,1);
 assert.equal(summary.followers,1);
 assert.equal(summary.likes_received,1);
 assert.equal(summary.reposts_received,1);
 assert.equal(summary.comments_received,1);
 assert.equal((data.daily as unknown[]).length,14);
 assert.equal((data.topPosts as {id:string}[])[0].id,visibleId);
 const other=await responseJson(await analyticsGET(request(outsider,"GET","/api/social/analytics")));
 assert.equal((other.summary as {posts:number}).posts,0);
 assert.equal((await analyticsGET(request(null,"GET","/api/social/analytics"))).status,401);
});
test("Moderator queue is restricted to enrolled wallets, displaying real pending media and reports",async()=>{
 assert.equal((await moderationGET(request(null,"GET","/api/social/moderation"))).status,401);
 assert.equal((await moderationGET(request(owner,"GET","/api/social/moderation"))).status,403);
 const r=await moderationGET(request(moderator,"GET","/api/social/moderation"));
 assert.equal(r.status,200);
 const q=await responseJson(r);
 assert.equal(q.authorized,true);
 assert.ok((q.media as {id:string}[]).some(x=>x.id===pendingId));
 assert.ok((q.reports as {id:string}[]).some(x=>x.id===reportToAct));
 assert.ok((q.reports as {id:string}[]).some(x=>x.id===reportToDismiss));
 const publicFeed=await responseJson(await socialGET(request(null,"GET","/api/social?action=feed")));
 assert.ok(!(publicFeed.posts as {id:string}[]).some(p=>p.id===pendingId));
});
test("Private controls reject spoofed origins and accept only owner-scoped notification settings",async()=>{
 assert.equal((await setting(null,{action:"preferences"})).status,401);
 assert.equal((await setting(owner,{action:"mute",target:fan},"https://evil.example")).status,403);
 assert.equal((await setting(owner,{action:"mute",target:owner})).status,400);
 const none=await responseJson(await controlsGET(request(owner,"GET","/api/social/controls")));
 assert.equal((none.preferences as {likes:boolean}).likes,true);
 const r=await setting(owner,{action:"preferences",preferences:{
  follows:true,comments:true,likes:false,reposts:true,
 }});
 assert.equal(r.status,200);
 const mine=await responseJson(await controlsGET(request(owner,"GET","/api/social/controls")));
 assert.equal((mine.preferences as {likes:boolean}).likes,false);
 const other=await responseJson(await controlsGET(request(outsider,"GET","/api/social/controls")));
 assert.equal((other.preferences as {likes:boolean}).likes,true);
 const alerts=await responseJson(await notificationsGET(request(owner,"GET","/api/experience/notifications")));
 assert.ok(!(alerts.events as {type:string}[]).some(x=>x.type==="Likes"));
 assert.ok((alerts.events as {type:string}[]).some(x=>x.type==="Reposts"));
});
test("Muted creators are excluded from the signed-in user's feed, discovery and notifications",async()=>{
 assert.equal((await setting(owner,{action:"mute",target:fan})).status,200);
 assert.equal((await setting(owner,{action:"mute",target:fan})).status,200);
 const mine=await responseJson(await controlsGET(request(owner,"GET","/api/social/controls")));
 assert.equal((mine.mutes as {address:string}[]).filter(x=>x.address===fan).length,1);
 const feed=await responseJson(await socialGET(request(owner,"GET","/api/social?action=feed")));
 assert.ok(!(feed.posts as {author:string;reposted_by_handle?:string|null}[]).some(p=>p.author===fan));
 const dir=await responseJson(await socialGET(request(owner,"GET","/api/social?action=directory&sort=engaged&search="+handle(fan))));
 assert.ok(!(dir.profiles as {address:string}[]).some(p=>p.address===fan));
 const otherDir=await responseJson(await socialGET(request(outsider,"GET","/api/social?action=directory&sort=engaged&search="+handle(fan))));
 assert.ok((otherDir.profiles as {address:string;engagement_30d:number}[]).some(p=>p.address===fan));
 const alerts=await responseJson(await notificationsGET(request(owner,"GET","/api/experience/notifications")));
 assert.ok(!(alerts.events as {actorHandle:string}[]).some(x=>x.actorHandle===handle(fan)));
 assert.equal((await setting(owner,{action:"unmute",target:fan})).status,200);
 const clear=await responseJson(await controlsGET(request(owner,"GET","/api/social/controls")));
 assert.equal((clear.mutes as unknown[]).length,0);
});
test("Moderator report decisions are atomic, permanent and unique; actioned hides target",async()=>{
 const bad={action:"resolve_report",reportId:reportToAct,decision:"actioned",
  explanation:"Verified policy violation in test"};
 assert.equal((await review(owner,bad)).status,403);
 assert.equal((await review(moderator,bad,"https://evil.example")).status,403);
 const invalid=await review(moderator,{...bad,explanation:"x"});
 assert.equal(invalid.status,400);
 const done=await review(moderator,bad);
 assert.equal(done.status,200);
 assert.equal((await review(moderator,bad)).status,409);
 const hidden=await query<{hidden:boolean}>("SELECT hidden FROM social_posts WHERE id=$1",[fanId]);
 assert.equal(hidden.rows[0].hidden,true);
 const dismissed=await review(moderator,{action:"resolve_report",
  reportId:reportToDismiss,decision:"dismissed",explanation:"No violation found in reviewed item"});
 assert.equal(dismissed.status,200);
 const results=await query<{decision:string}>(`
  SELECT decision FROM social_report_resolutions WHERE moderator=$1 ORDER BY resolved_at`,[moderator]);
 assert.deepEqual(results.rows.map(x=>x.decision).sort(),["actioned","dismissed"]);
 const audit=await query("SELECT target_id FROM social_moderation_audit WHERE moderator=$1 AND action='hide_post' AND target_id=$2",
  [moderator,fanId]);
 assert.equal(audit.rowCount,1);
 const afterQueue=await responseJson(await moderationGET(request(moderator,"GET","/api/social/moderation")));
 assert.ok(!(afterQueue.reports as {id:string}[]).some(x=>x.id===reportToAct));
 assert.ok(!(afterQueue.reports as {id:string}[]).some(x=>x.id===reportToDismiss));
});
test("Media approval requires actual moderator and audit; unapproved files were hidden until review",async()=>{
 const body={action:"moderate",operation:"approve_media",targetId:pendingId,
  reason:"CI fixture checked under moderator authorization"};
 assert.equal((await socialPOST(request(owner,"POST","/api/social",body))).status,403);
 const result=await socialPOST(request(moderator,"POST","/api/social",body));
 assert.equal(result.status,200);
 const state=await query<{media_status:string}>("SELECT media_status FROM social_posts WHERE id=$1",[pendingId]);
 assert.equal(state.rows[0].media_status,"approved");
 const queue=await responseJson(await moderationGET(request(moderator,"GET","/api/social/moderation")));
 assert.ok(!(queue.media as {id:string}[]).some(x=>x.id===pendingId));
 const logs=await query("SELECT action FROM social_moderation_audit WHERE moderator=$1 AND target_id=$2",
  [moderator,pendingId]);
 assert.equal(logs.rowCount,1);
});
test("Closed-preview flag rejects account and moderation writes without modifying records",async()=>{
 const old=process.env.LOOKE_SOCIAL_WRITES_ENABLED;
 try{
  process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
  assert.equal((await setting(owner,{action:"unmute",target:fan})).status,503);
  assert.equal((await review(moderator,{action:"resolve_report",reportId:reportToAct,
   decision:"dismissed",explanation:"Attempt blocked by closed preview"})).status,503);
  assert.equal((await socialPOST(request(moderator,"POST","/api/social",{
   action:"moderate",operation:"reject_media",targetId:pendingId,
   reason:"Closed preview attempt rejected",
  }))).status,503);
 }finally{if(old===undefined)delete process.env.LOOKE_SOCIAL_WRITES_ENABLED;
  else process.env.LOOKE_SOCIAL_WRITES_ENABLED=old;}
});
