import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {GET as engagementGET,POST as engagementPOST} from "../src/app/api/social/engagement/route";
import {GET as notificationsGET} from "../src/app/api/experience/notifications/route";

const owner="0x"+randomBytes(20).toString("hex");
const fan="0x"+randomBytes(20).toString("hex");
const outsider="0x"+randomBytes(20).toString("hex");
const people=[owner,fan,outsider];
const handle=(v:string)=>"u"+v.slice(2,17);
const token=()=>randomBytes(32).toString("hex");
const tokens=new Map<string,string>();
let postId="",pendingId="";
function cookie(wallet:string){return "looke_social_dev="+tokens.get(wallet);}
function request(wallet:string|null,method:"GET"|"POST",path:string,body?:Record<string,unknown>,origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(wallet?{cookie:cookie(wallet)}:{}),
   ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
  },
  ...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function mutate(wallet:string|null,action:string,id=postId,origin?:string){
 const response=await engagementPOST(request(wallet,"POST","/api/social/engagement",{action,postId:id},origin));
 return {status:response.status,json:await response.json() as {
  ok?:boolean;changed?:boolean;engagement?:{like_count:number;repost_count:number;
    liked_by_me:boolean;reposted_by_me:boolean;bookmarked_by_me:boolean};
 }};
}
before(async()=>{
 for(const wallet of people){
  await query("INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,$3)",
   [wallet,handle(wallet),"M17 disposable test identity"]);
  const secret=token();tokens.set(wallet,secret);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
   VALUES($1,$2,now()+interval '30 minutes')`,
   [createHash("sha256").update(secret).digest("hex"),wallet]);
 }
 const first=await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M17 real Postgres CI fixture') RETURNING id`,[owner]);
 postId=first.rows[0].id;
 const pending=await query<{id:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'Unapproved disposable media','https://cdn.looke.xyz/m17.png','image','pending') RETURNING id`,[owner]);
 pendingId=pending.rows[0].id;
});
after(async()=>{
 await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[people]);
 await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[people]);
 await socialDb().end();
});
test("Unauthenticated and cross-origin writes fail without database mutations",async()=>{
 assert.equal((await mutate(null,"like")).status,401);
 assert.equal((await mutate(fan,"like",postId,"https://malicious.example")).status,403);
 assert.equal((await mutate(fan,"sendMessage")).status,400);
 const r=await query("SELECT id FROM social_post_likes WHERE post_id=$1",[postId]);
 assert.equal(r.rowCount,0);
});
test("Only visible, unblocked posts can be liked, reposted and privately saved",async()=>{
 assert.equal((await mutate(fan,"like",pendingId)).status,404);
 assert.equal((await mutate(owner,"repost")).status,403);
 assert.equal((await mutate(owner,"like")).status,403);
 const liked=await mutate(fan,"like");assert.equal(liked.status,200);
 assert.equal(liked.json.engagement?.like_count,1);
 const duplicate=await mutate(fan,"like");assert.equal(duplicate.json.changed,false);
 assert.equal(duplicate.json.engagement?.like_count,1);
 const reposted=await mutate(fan,"repost");assert.equal(reposted.status,200);
 assert.equal(reposted.json.engagement?.repost_count,1);
 const saved=await mutate(fan,"bookmark");assert.equal(saved.status,200);
 assert.equal(saved.json.engagement?.bookmarked_by_me,true);
 assert.equal((await query("SELECT id FROM social_post_likes WHERE post_id=$1",[postId])).rowCount,1);
 assert.equal((await query("SELECT id FROM social_post_reposts WHERE post_id=$1",[postId])).rowCount,1);
 assert.equal((await query("SELECT id FROM social_post_bookmarks WHERE post_id=$1",[postId])).rowCount,1);
});
test("Account activity is private, derived from actual engagements and hides pending posts",async()=>{
 const r=await engagementGET(request(fan,"GET","/api/social/engagement?view=activity&kind=all"));
 assert.equal(r.status,200);
 const body=await r.json() as {events:{kind:string;post_id:string}[]};
 assert.equal(body.events.length,3);
 assert.ok(body.events.every(x=>x.post_id===postId));
 const other=await engagementGET(request(outsider,"GET","/api/social/engagement?view=activity"));
 assert.equal((await other.json() as {events:unknown[]}).events.length,0);
 const noCookie=await engagementGET(request(null,"GET","/api/social/engagement?view=activity"));
 assert.equal(noCookie.status,401);
 const onlySaves=await engagementGET(request(fan,"GET","/api/social/engagement?view=activity&kind=bookmarks"));
 assert.deepEqual((await onlySaves.json() as {events:{kind:string}[]}).events.map(x=>x.kind),["bookmarks"]);
});
test("Likes and reposts generate only genuine, owner-scoped notifications",async()=>{
 const ownerResult=await notificationsGET(request(owner,"GET","/api/experience/notifications"));
 const data=await ownerResult.json() as {events:{type:string;postId:string}[]};
 assert.ok(data.events.some(e=>e.type==="Likes"&&e.postId===postId));
 assert.ok(data.events.some(e=>e.type==="Reposts"&&e.postId===postId));
 const otherResult=await notificationsGET(request(outsider,"GET","/api/experience/notifications"));
 const other=await otherResult.json() as {events:unknown[]};
 assert.equal(other.events.length,0);
});
test("Blocking prevents new engagement, filters activity and notifications; undo remains owner-scoped",async()=>{
 await query("INSERT INTO social_blocks(blocker,blocked) VALUES($1,$2)",[owner,fan]);
 assert.equal((await mutate(fan,"like")).status,404);
 const unseen=await engagementGET(request(fan,"GET","/api/social/engagement?view=activity"));
 assert.equal((await unseen.json() as {events:unknown[]}).events.length,0);
 const ownerNotifications=await notificationsGET(request(owner,"GET","/api/experience/notifications"));
 assert.equal((await ownerNotifications.json() as {events:unknown[]}).events.length,0);
 const undo=await mutate(fan,"unrepost");
 assert.equal(undo.status,200);
 assert.equal(undo.json.engagement?.repost_count,0);
 assert.equal((await mutate(outsider,"unbookmark")).status,200);
 assert.equal((await query("SELECT 1 FROM social_post_bookmarks WHERE actor=$1 AND post_id=$2",[fan,postId])).rowCount,1);
 assert.equal((await mutate(fan,"unbookmark")).status,200);
 assert.equal((await mutate(fan,"unlike")).status,200);
});
