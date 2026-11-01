import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { cleanPostText, checkedPostUuid } from "@/lib/post-content.mjs";

export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};

/** Read a single public visible post to resolve share links independently of feed paging. */
export async function GET(_request:Request,{params}:Params) {
 let id:string;
 try{id=checkedPostUuid((await params).id);}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try {
  const me=await currentProfile();
  const sql=database();
  const rows=await sql`
    SELECT p.id,p.text,p.created_at,p.edited_at,u.id AS author_id,
      u.handle AS author_handle,
      coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS author,
      (p.profile_id=${me?.id??null}::uuid) AS is_owner,
      (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes,
      (SELECT count(*)::int FROM looke_comments c WHERE c.post_id=p.id AND c.moderation_status='visible') AS comments,
      (SELECT count(*)::int FROM looke_reposts r WHERE r.post_id=p.id) AS reposts,
      EXISTS(SELECT 1 FROM looke_likes l WHERE l.post_id=p.id AND l.profile_id=${me?.id??null}::uuid) AS user_liked,
      EXISTS(SELECT 1 FROM looke_reposts r WHERE r.post_id=p.id AND r.profile_id=${me?.id??null}::uuid) AS user_reposted,
      EXISTS(SELECT 1 FROM looke_follows f WHERE f.followed_id=p.profile_id AND f.follower_id=${me?.id??null}::uuid) AS user_following
    FROM looke_posts p JOIN looke_profiles u ON u.id=p.profile_id
    WHERE p.id=${id}::uuid AND p.moderation_status='visible' LIMIT 1
  `;
  if(!rows.length)return NextResponse.json({error:"Post unavailable"},{status:404});
  return NextResponse.json({post:rows[0]},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Post lookup unavailable"},{status:503});}
}

/** Edit a visible post only as its author, with a 10-second edit cooldown. */
export async function PATCH(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedPostUuid((await params).id);}catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try{
   const profile=await currentProfile();
   if(!profile)return NextResponse.json({error:"Sign in required"},{status:401});
   const input=await parseJson(request) as {text?:unknown};
   let text:string;
   try{text=cleanPostText(input?.text);}
   catch{return NextResponse.json({error:"Post must contain 1–1200 valid characters"},{status:400});}
   const sql=database();
   const rows=await sql`UPDATE looke_posts
     SET text=${text},edited_at=now()
     WHERE id=${id}::uuid AND profile_id=${profile.id}::uuid
       AND moderation_status='visible'
       AND (edited_at IS NULL OR edited_at<now()-interval '10 seconds')
     RETURNING id,text,created_at,edited_at`;
   if(!rows.length)return NextResponse.json({error:"Post unavailable, not yours or recently edited"},{status:404});
   return NextResponse.json({post:rows[0]},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Post editing unavailable"},{status:503});}
}

/** Permanently remove your own post; likes/reports cascade by foreign key. */
export async function DELETE(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedPostUuid((await params).id);}catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try{
   const profile=await currentProfile();
   if(!profile)return NextResponse.json({error:"Sign in required"},{status:401});
   const sql=database();
   const deleted=await sql`DELETE FROM looke_posts WHERE id=${id}::uuid
      AND profile_id=${profile.id}::uuid RETURNING id`;
   if(!deleted.length)return NextResponse.json({error:"Post unavailable or not yours"},{status:404});
   return NextResponse.json({deleted:true,id:deleted[0].id},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Post removal unavailable"},{status:503});}
}
