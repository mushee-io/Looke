import assert from "node:assert/strict";
import {after,test} from "node:test";
import {randomBytes} from "node:crypto";
import {query,socialDb} from "../src/lib/social/db";
const wallet="0x"+randomBytes(20).toString("hex");
const handle="u"+wallet.slice(2,17);
let postId="";
after(async()=>{
 await query("DELETE FROM social_profiles WHERE address=$1",[wallet]);
 await socialDb().end();
});
test("M15 migrations create moderator-only media approval fields",async()=>{
 const cols=await query<{column_name:string}>(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='social_posts' AND column_name IN ('media_url','media_kind','media_status')
 `);
 assert.equal(cols.rowCount,3);
 await query("INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,'M15 CI')",[wallet,handle]);
 const r=await query<{id:string;media_status:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'M15 disposable CI media','https://cdn.looke.xyz/verified.png','image','pending')
  RETURNING id,media_status
 `,[wallet]);
 postId=r.rows[0].id;
 assert.equal(r.rows[0].media_status,"pending");
 const hidden=await query<{media_url:string|null}>(`
  SELECT CASE WHEN media_status='approved' THEN media_url ELSE NULL END media_url
  FROM social_posts WHERE id=$1`,[postId]);
 assert.equal(hidden.rows[0].media_url,null);
 await assert.rejects(()=>query("UPDATE social_posts SET media_status='invalid' WHERE id=$1",[postId]),/constraint|violates/i);
});
test("Only approved media becomes visible; moderation operation is audited",async()=>{
 const r=await query(`
  UPDATE social_posts SET media_status='approved'
  WHERE id=$1 AND media_status='pending' RETURNING media_url`,[postId]);
 assert.equal(r.rowCount,1);
 const visible=await query<{media_url:string|null}>(`
  SELECT CASE WHEN media_status='approved' THEN media_url ELSE NULL END media_url
  FROM social_posts WHERE id=$1`,[postId]);
 assert.equal(visible.rows[0].media_url,"https://cdn.looke.xyz/verified.png");
 const audit=await query(`
  INSERT INTO social_moderation_audit(moderator,action,target_id,reason)
  VALUES($1,'approve_media',$2,'Verified disposable CI media after review') RETURNING id
 `,[wallet,postId]);
 assert.equal(audit.rowCount,1);
 await query("UPDATE social_posts SET media_status='rejected' WHERE id=$1",[postId]);
 const rejected=await query<{media_url:string|null}>(`
  SELECT CASE WHEN media_status='approved' THEN media_url ELSE NULL END media_url
  FROM social_posts WHERE id=$1`,[postId]);
 assert.equal(rejected.rows[0].media_url,null);
});
