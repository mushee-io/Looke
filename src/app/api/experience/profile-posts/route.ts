import {type NextRequest,NextResponse} from "next/server";
import {handle,uuid} from "../../../../lib/social/validation";
import {viewer,HttpError} from "../../../../lib/social/auth";
import {query} from "../../../../lib/social/db";
import {failure} from "../../../../lib/social/http";

export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Genuine, visible creator timeline with server-side stable pagination. */
export async function GET(request:NextRequest){
 try{
   const requested=handle.parse(request.nextUrl.searchParams.get("handle")??"");
   const raw=request.nextUrl.searchParams.get("cursor");
   const cursor=raw?uuid.parse(raw):null;
   const current=await viewer(request);
   const wallet=current?.address??null;
   const found=await query<{address:string}>(`
     SELECT p.address FROM social_profiles p
     WHERE p.handle=$1 AND p.suspended=false
       AND ($2::text IS NULL OR NOT EXISTS (
         SELECT 1 FROM social_blocks b WHERE
           (b.blocker=$2 AND b.blocked=p.address) OR
           (b.blocked=$2 AND b.blocker=p.address)
       )) LIMIT 1
   `,[requested,wallet]);
   const owner=found.rows[0]?.address;
   if(!owner)throw new HttpError(404,"Creator profile unavailable.");
   type Row={
     id:string;author:string;body:string;asset_id:string|null;asset_type:string|null;
     asset_chain:string|null;created_at:string;comment_count:number;
     media_url:string|null;media_kind:string|null;
   };
   const [posts,count]=await Promise.all([
     query<Row>(`
       SELECT p.id,p.author,p.body,p.asset_id,p.asset_type,p.asset_chain,p.created_at,
         CASE WHEN p.media_status='approved' THEN p.media_url ELSE NULL END AS media_url,
         CASE WHEN p.media_status='approved' THEN p.media_kind ELSE NULL END AS media_kind,
         (SELECT count(*)::integer FROM social_comments c
           WHERE c.post_id=p.id AND c.hidden=false) AS comment_count
       FROM social_posts p WHERE p.author=$1 AND p.hidden=false AND p.deleted_at IS NULL
         AND ($2::uuid IS NULL OR (p.created_at,p.id) <
           (SELECT created_at,id FROM social_posts WHERE id=$2 AND author=$1))
       ORDER BY p.created_at DESC,p.id DESC LIMIT 13
     `,[owner,cursor]),
     query<{count:number}>(`
       SELECT count(*)::integer AS count FROM social_posts p
       WHERE p.author=$1 AND p.hidden=false AND p.deleted_at IS NULL
     `,[owner]),
   ]);
   return NextResponse.json({
     posts:posts.rows.slice(0,12),total:count.rows[0]?.count??0,
     nextCursor:posts.rows.length>12?posts.rows[11].id:null,
     source:"real-moderated-postgres",
   },{headers:{"cache-control":"private, no-store"}});
 }catch(error){return failure(error);}
}
