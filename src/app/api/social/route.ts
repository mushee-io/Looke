import { type NextRequest, NextResponse } from "next/server";
import { address, comment, follow, handle, post, profile, report, uuid } from "../../../lib/social/validation";
import { HttpError, requireViewer, verifyRequestOrigin, viewer, writesEnabled } from "../../../lib/social/auth";
import { failure, readJson } from "../../../lib/social/http";
import { query, rateLimit, socialDb } from "../../../lib/social/db";
import {uploadId,uploadEnabled} from "../../../lib/social/upload-provider";
import { z } from "zod";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function cacheData(value:unknown){
  return NextResponse.json(value,{headers:{"cache-control":"no-store"}});
}

export async function GET(req:NextRequest){
  try{
    const p=req.nextUrl.searchParams;
    const action=p.get("action")||"feed";
    const current=await viewer(req);
    const wallet=current?.address??null;
    const cursor=p.get("cursor")?uuid.parse(p.get("cursor")):null;
    if(action==="me"){
      if(!wallet)return cacheData({authenticated:false,profile:null});
      const r=await query(`SELECT address,handle,display_name,bio,avatar_url,created_at
        FROM social_profiles WHERE address=$1`,[wallet]);
      return cacheData({authenticated:true,profile:r.rows[0]??null,suspended:current?.suspended??false});
    }
    if(action==="feed"){
      const scope=p.get("scope")==="following"?"following":"global";
      const search=z.string().trim().max(64).parse(p.get("search")??"").toLowerCase();
      const result=await query(`
        SELECT p.id,p.author,p.body,p.asset_chain,p.asset_type,p.asset_id,p.created_at,
          CASE WHEN p.media_status='approved' THEN p.media_url ELSE NULL END AS media_url,
          CASE WHEN p.media_status='approved' THEN p.media_kind ELSE NULL END AS media_kind,
          pr.handle,pr.display_name,pr.avatar_url,
          (SELECT count(*)::integer FROM social_comments c WHERE c.post_id=p.id AND c.hidden=false) AS comment_count,
          (SELECT count(*)::integer FROM social_follows f WHERE f.followed=p.author) AS follower_count
        FROM social_posts p JOIN social_profiles pr ON pr.address=p.author
        WHERE p.hidden=false AND p.deleted_at IS NULL AND pr.suspended=false
          AND ($1::uuid IS NULL OR (p.created_at,p.id) <
            (SELECT created_at,id FROM social_posts WHERE id=$1))
          AND ($2::text IS NULL OR NOT EXISTS(
            SELECT 1 FROM social_blocks b WHERE
              (b.blocker=$2 AND b.blocked=p.author) OR (b.blocked=$2 AND b.blocker=p.author)))
          AND ($3::text <> 'following' OR ($2::text IS NOT NULL AND
            (p.author=$2 OR EXISTS(SELECT 1 FROM social_follows f WHERE f.follower=$2 AND f.followed=p.author))))
          AND ($4::text='' OR position($4::text in lower(p.body))>0
            OR position($4::text in lower(pr.handle))>0
            OR position($4::text in lower(pr.display_name))>0)
        ORDER BY p.created_at DESC,p.id DESC LIMIT 21`,[cursor,wallet,scope,search]);
      return cacheData({posts:result.rows.slice(0,20),nextCursor:result.rows.length>20?result.rows[19]?.id:null});
    }
    if(action==="profile"){
      const id=handle.parse(p.get("handle")||"");
      const r=await query(`
        SELECT p.address,p.handle,p.display_name,p.bio,p.avatar_url,p.created_at,
          (SELECT count(*)::integer FROM social_follows f WHERE f.followed=p.address) AS follower_count,
          (SELECT count(*)::integer FROM social_follows f WHERE f.follower=p.address) AS following_count,
          ($2::text IS NOT NULL AND EXISTS(SELECT 1 FROM social_follows f WHERE f.follower=$2 AND f.followed=p.address)) AS is_following
        FROM social_profiles p WHERE p.handle=$1 AND p.suspended=false
          AND ($2::text IS NULL OR NOT EXISTS(SELECT 1 FROM social_blocks b
            WHERE (b.blocker=$2 AND b.blocked=p.address) OR (b.blocked=$2 AND b.blocker=p.address)))`,[id,wallet]);
      if(!r.rows.length)throw new HttpError(404,"Profile not found.");
      return cacheData({profile:r.rows[0]});
    }
    if(action==="directory"){
      const q=z.string().trim().max(30).parse(p.get("search")||"").toLowerCase();
      const r=await query(`
        SELECT address,handle,display_name,bio,avatar_url FROM social_profiles
        WHERE suspended=false AND (handle LIKE $1 OR lower(display_name) LIKE $1)
          AND ($2::text IS NULL OR NOT EXISTS(SELECT 1 FROM social_blocks b
            WHERE (b.blocker=$2 AND b.blocked=social_profiles.address)
               OR (b.blocked=$2 AND b.blocker=social_profiles.address)))
        ORDER BY created_at DESC LIMIT 20`,[`%${q}%`,wallet]);
      return cacheData({profiles:r.rows});
    }
    if(action==="comments"){
      const id=uuid.parse(p.get("postId"));
      const r=await query(`
        SELECT c.id,c.post_id,c.author,c.body,c.created_at,p.handle,p.display_name
        FROM social_comments c JOIN social_profiles p ON p.address=c.author
        JOIN social_posts original ON original.id=c.post_id
        WHERE c.post_id=$1 AND c.hidden=false AND p.suspended=false
          AND original.hidden=false AND original.deleted_at IS NULL
          AND ($2::text IS NULL OR NOT EXISTS(SELECT 1 FROM social_blocks b
            WHERE (b.blocker=$2 AND b.blocked=c.author) OR (b.blocked=$2 AND b.blocker=c.author)))
        ORDER BY c.created_at ASC LIMIT 50`,[id,wallet]);
      return cacheData({comments:r.rows});
    }
    if(action==="messages")throw new HttpError(501,"Private messages are not enabled until client encryption and key recovery are independently reviewed.");
    return NextResponse.json({error:"Unknown social read action."},{status:400});
  }catch(error){return failure(error);}
}

async function assertNotBlocked(user:string,target:string){
  const r=await query(`SELECT 1 FROM social_blocks WHERE
    (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1) LIMIT 1`,[user,target]);
  if(r.rowCount)throw new HttpError(403,"This interaction is blocked.");
}

async function moderate(actor:string,input:Record<string,unknown>){
  const moderators=(process.env.LOOKE_SOCIAL_MODERATORS||"")
    .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!moderators.includes(actor))throw new HttpError(403,"Moderator role required.");
  const schema=z.object({
    operation:z.enum(["hide_post","hide_comment","suspend_profile","restore_post","restore_comment","restore_profile","approve_media","reject_media"]),
    targetId:z.string().min(1).max(90),
    reason:z.string().trim().min(8).max(500),
  });
  const data=schema.parse(input);
  const id=data.operation.includes("profile")?address.parse(data.targetId):uuid.parse(data.targetId);
  if(id===actor)throw new HttpError(403,"Moderators may not suspend their own wallet.");
  const map:{
    [K in typeof data.operation]:{sql:string}
  }={
    hide_post:{sql:"UPDATE social_posts SET hidden=true WHERE id=$1 RETURNING id"},
    restore_post:{sql:"UPDATE social_posts SET hidden=false WHERE id=$1 RETURNING id"},
    hide_comment:{sql:"UPDATE social_comments SET hidden=true WHERE id=$1 RETURNING id"},
    restore_comment:{sql:"UPDATE social_comments SET hidden=false WHERE id=$1 RETURNING id"},
    suspend_profile:{sql:"UPDATE social_profiles SET suspended=true WHERE address=$1 RETURNING address"},
    restore_profile:{sql:"UPDATE social_profiles SET suspended=false WHERE address=$1 RETURNING address"},
    approve_media:{sql:"UPDATE social_posts SET media_status='approved' WHERE id=$1 AND media_url IS NOT NULL AND media_status='pending' AND hidden=false AND deleted_at IS NULL RETURNING id"},
    reject_media:{sql:"UPDATE social_posts SET media_status='rejected' WHERE id=$1 AND media_url IS NOT NULL AND media_status='pending' RETURNING id"},
  };
  const conn=await socialDb().connect();
  try{
    await conn.query("BEGIN");
    const changed=await conn.query(map[data.operation].sql,[id]);
    if(changed.rowCount!==1)throw new HttpError(404,"Moderation target not found.");
    await conn.query(`INSERT INTO social_moderation_audit(moderator,action,target_id,reason) VALUES($1,$2,$3,$4)`,
      [actor,data.operation,id,data.reason]);
    await conn.query("COMMIT");
  }catch(error){await conn.query("ROLLBACK");throw error;}
  finally{conn.release();}
  return {ok:true,audited:true};
}

export async function POST(req:NextRequest){
  try{
    verifyRequestOrigin(req);
    const input=await readJson(req);
    const action=input.action;
    if(action==="message" || action==="conversation")throw new HttpError(501,"DM sending is disabled until independently reviewed end-to-end encryption and key recovery are available.");
    if(!writesEnabled())throw new HttpError(503,"Social writes are disabled until database and moderation checks pass.");
    const active=await requireViewer(req),actor=active.address;
    if(action==="profile"){
      await rateLimit(actor,"profile",10,3600);
      const v=profile.parse({handle:input.handle,displayName:input.displayName,bio:input.bio,avatarUrl:input.avatarUrl});
      const result=await query(`
        UPDATE social_profiles SET handle=$1,display_name=$2,bio=$3,avatar_url=NULLIF($4,''),updated_at=now()
        WHERE address=$5 RETURNING address,handle,display_name,bio,avatar_url`,
        [v.handle,v.displayName,v.bio,v.avatarUrl,actor]);
      return cacheData({profile:result.rows[0]});
    }
    if(action==="post"){
      await rateLimit(actor,"post",12,600);
      const v=post.parse({body:input.body,asset:input.asset??null,media:input.media??null});
      // M16: a hosted URL alone is not provenance or upload permission.
      // Only one-use, provider-confirmed and owner-bound upload intents can attach media.
      if(v.media!==null)throw new HttpError(400,"Raw media URLs cannot be posted. Authorize and verify a hosted upload first.");
      const intentId=input.mediaUploadId==null?null:uploadId.parse(input.mediaUploadId);
      if(intentId&&!uploadEnabled())throw new HttpError(503,"Media posting is disabled pending hosting/moderation approval.");
      const conn=await socialDb().connect();
      try{
        await conn.query("BEGIN");
        let mediaUrl:string|null=null,kind:string|null=null;
        if(intentId){
          const signed=await conn.query<{verified_url:string;kind:string}>(`
            SELECT verified_url,kind FROM social_media_uploads
            WHERE id=$1 AND owner=$2 AND state='verified'
              AND verified_at>now()-interval '30 minutes'
            FOR UPDATE
          `,[intentId,actor]);
          if(signed.rowCount!==1||!signed.rows[0].verified_url)
            throw new HttpError(409,"Upload verification expired, consumed or belongs to another wallet.");
          mediaUrl=signed.rows[0].verified_url;
          kind=signed.rows[0].kind;
        }
        const created=await conn.query<{id:string;created_at:Date;media_status:string}>(`
          INSERT INTO social_posts(author,body,asset_chain,asset_type,asset_id,media_url,media_kind,media_status)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,created_at,media_status
        `,[actor,v.body,v.asset?.assetChain??null,v.asset?.assetType??null,v.asset?.assetId??null,
          mediaUrl,kind,mediaUrl?"pending":"none"]);
        if(intentId){
          const consumed=await conn.query(`
            UPDATE social_media_uploads SET state='attached',post_id=$3,attached_at=now()
            WHERE id=$1 AND owner=$2 AND state='verified' AND post_id IS NULL
          `,[intentId,actor,created.rows[0].id]);
          if(consumed.rowCount!==1)throw new HttpError(409,"Upload permission already used.");
        }
        await conn.query("COMMIT");
        return cacheData({ok:true,post:created.rows[0],
          note:mediaUrl?"Verified hosted media awaits moderator approval before it appears in Looke.":undefined});
      }catch(error){await conn.query("ROLLBACK");throw error;}
      finally{conn.release();}
    }
    if(action==="comment"){
      await rateLimit(actor,"comment",30,600);
      const v=comment.parse({postId:input.postId,body:input.body});
      const target=await query<{author:string}>(`
        SELECT p.author FROM social_posts p JOIN social_profiles pr ON pr.address=p.author
        WHERE p.id=$1 AND p.hidden=false AND p.deleted_at IS NULL AND pr.suspended=false`,[v.postId]);
      if(!target.rows.length)throw new HttpError(404,"Post not found.");
      await assertNotBlocked(actor,target.rows[0].author);
      const r=await query(`INSERT INTO social_comments(post_id,author,body) VALUES($1,$2,$3) RETURNING id,created_at`,[v.postId,actor,v.body]);
      return cacheData({ok:true,comment:r.rows[0]});
    }
    if(action==="follow"||action==="unfollow"||action==="block"||action==="unblock"){
      await rateLimit(actor,"relationship",60,600);
      const target=follow.parse({target:input.target}).target;
      if(target===actor)throw new HttpError(400,"You cannot follow or block yourself.");
      if(action==="follow"){
        await assertNotBlocked(actor,target);
        const r=await query(`
          INSERT INTO social_follows(follower,followed)
          SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM social_profiles WHERE address=$2 AND suspended=false)
          ON CONFLICT DO NOTHING RETURNING followed`,[actor,target]);
        return cacheData({ok:true,following:Boolean(r.rowCount)});
      }
      if(action==="unfollow"){
        await query("DELETE FROM social_follows WHERE follower=$1 AND followed=$2",[actor,target]);
        return cacheData({ok:true,following:false});
      }
      if(action==="block"){
        const conn=await socialDb().connect();
        try{
          await conn.query("BEGIN");
          await conn.query(`INSERT INTO social_blocks(blocker,blocked)
            SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM social_profiles WHERE address=$2)
            ON CONFLICT DO NOTHING`,[actor,target]);
          await conn.query("DELETE FROM social_follows WHERE (follower=$1 AND followed=$2) OR (follower=$2 AND followed=$1)",[actor,target]);
          await conn.query("COMMIT");
        }catch(error){await conn.query("ROLLBACK");throw error;}
        finally{conn.release();}
        return cacheData({ok:true,blocked:true});
      }
      await query("DELETE FROM social_blocks WHERE blocker=$1 AND blocked=$2",[actor,target]);
      return cacheData({ok:true,blocked:false});
    }
    if(action==="report"){
      await rateLimit(actor,"report",10,3600);
      const v=report.parse({targetType:input.targetType,targetId:input.targetId,reason:input.reason,details:input.details??""});
      const targetColumn=v.targetType==="post"?"post_id":"comment_id";
      const r=await query(`
        INSERT INTO social_reports(reporter,${targetColumn},reason,details)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
        [actor,v.targetId,v.reason,v.details]);
      return cacheData({ok:true,submitted:Boolean(r.rowCount)});
    }
    if(action==="moderate"){
      await rateLimit(actor,"moderate",60,3600);
      return cacheData(await moderate(actor,input));
    }
    return NextResponse.json({error:"Unknown social write action."},{status:400});
  }catch(error){return failure(error);}
}
