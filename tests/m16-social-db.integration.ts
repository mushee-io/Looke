import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {randomBytes,randomUUID} from "node:crypto";
import {query,socialDb} from "../src/lib/social/db";

const wallet="0x"+randomBytes(20).toString("hex");
const stranger="0x"+randomBytes(20).toString("hex");
const short=(value:string)=>"u"+value.slice(2,17);
let uploadId="",postId="";
before(async()=>{
  await query("INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,'M16 disposable')",[wallet,short(wallet)]);
  await query("INSERT INTO social_profiles(address,handle,display_name) VALUES($1,$2,'M16 another')",[stranger,short(stranger)]);
});
after(async()=>{
  await query("DELETE FROM social_media_uploads WHERE owner=$1",[wallet]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[[wallet,stranger]]);
  await socialDb().end();
});
test("M16 PostgreSQL signed upload is owner-specific and state constrained",async()=>{
 const id="looke/social/"+wallet+"/"+randomUUID();
 const result=await query<{id:string}>(`
   INSERT INTO social_media_uploads(owner,public_id,kind,mime,declared_bytes,expires_at)
   VALUES($1,$2,'image','image/png',1024,now()+interval '15 minutes') RETURNING id
 `,[wallet,id]);
 uploadId=result.rows[0].id;
 const wrong=await query("SELECT id FROM social_media_uploads WHERE id=$1 AND owner=$2",[uploadId,stranger]);
 assert.equal(wrong.rowCount,0);
 await assert.rejects(()=>query(`
   UPDATE social_media_uploads SET state='attached' WHERE id=$1
 `,[uploadId]),/constraint|violates/i);
 const ok=await query(`
   UPDATE social_media_uploads SET state='verified',verified_url=$2,provider_asset_id=$3,verified_at=now()
   WHERE id=$1 AND state='issued' RETURNING id
 `,[uploadId,"https://res.cloudinary.com/lookecloud/image/upload/v5/"+id+".png","ciassetid123456"]);
 assert.equal(ok.rowCount,1);
});
test("M16 atomic attachment can consume a verified upload only once",async()=>{
 const conn=await socialDb().connect();
 try{
  await conn.query("BEGIN");
  const locked=await conn.query(`
    SELECT verified_url,kind FROM social_media_uploads
    WHERE id=$1 AND owner=$2 AND state='verified' FOR UPDATE
  `,[uploadId,wallet]);
  assert.equal(locked.rowCount,1);
  const created=await conn.query<{id:string}>(`
    INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
    VALUES($1,'M16 disposable media',$2,'image','pending') RETURNING id
  `,[wallet,locked.rows[0].verified_url]);
  postId=created.rows[0].id;
  const used=await conn.query(`
    UPDATE social_media_uploads SET state='attached',post_id=$3,attached_at=now()
    WHERE id=$1 AND owner=$2 AND state='verified' AND post_id IS NULL
  `,[uploadId,wallet,postId]);
  assert.equal(used.rowCount,1);
  await conn.query("COMMIT");
 }catch(error){await conn.query("ROLLBACK");throw error;}finally{conn.release();}
 const reuse=await query(`UPDATE social_media_uploads SET state='attached'
   WHERE id=$1 AND owner=$2 AND state='verified' RETURNING id`,[uploadId,wallet]);
 assert.equal(reuse.rowCount,0);
 const pending=await query<{url:string|null}>(`SELECT CASE WHEN media_status='approved' THEN media_url ELSE NULL END AS url FROM social_posts WHERE id=$1`,[postId]);
 assert.equal(pending.rows[0].url,null);
});
test("M16 notifications read cursor is scoped to exactly one wallet",async()=>{
 await query(`INSERT INTO social_notification_reads(owner,last_seen_at) VALUES($1,now())`,[wallet]);
 const read=await query<{owner:string}>(`SELECT owner FROM social_notification_reads WHERE owner=$1`,[wallet]);
 assert.equal(read.rows[0].owner,wallet);
 const other=await query(`SELECT owner FROM social_notification_reads WHERE owner=$1`,[stranger]);
 assert.equal(other.rowCount,0);
 await query(`INSERT INTO social_notification_reads(owner,last_seen_at) VALUES($1,now())
   ON CONFLICT(owner) DO UPDATE SET last_seen_at=GREATEST(social_notification_reads.last_seen_at,EXCLUDED.last_seen_at)`,[wallet]);
 assert.equal((await query(`SELECT owner FROM social_notification_reads WHERE owner=$1`,[stranger])).rowCount,0);
});
