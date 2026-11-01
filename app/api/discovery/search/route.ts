import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { normalizeDiscoveryQuery } from "@/lib/discovery.mjs";

export const dynamic = "force-dynamic";

/**
 * Public text discovery. Uses PostgreSQL's built-in indexed full-text search and
 * excludes hidden/removed posts. Never returns wallets, sessions or private reports.
 */
export async function GET(request:NextRequest) {
 let query:string;
 try {query=normalizeDiscoveryQuery(request.nextUrl.searchParams.get("q"));}
 catch{return NextResponse.json({error:"Search must contain 2–80 valid characters"},{status:400});}
 try{
  const sql=database();
  const [creators,posts]=await Promise.all([
   sql`
    SELECT p.id,p.handle,p.display_name,p.bio,
      (SELECT count(*)::int FROM looke_follows f WHERE f.followed_id=p.id) AS followers,
      (SELECT count(*)::int FROM looke_posts po WHERE po.profile_id=p.id AND po.moderation_status='visible') AS posts
    FROM looke_profiles p
    WHERE p.handle IS NOT NULL
      AND to_tsvector('simple',coalesce(p.handle,'') || ' ' || coalesce(p.display_name,'') || ' ' || coalesce(p.bio,''))
         @@ plainto_tsquery('simple',${query})
    ORDER BY ts_rank_cd(
      to_tsvector('simple',coalesce(p.handle,'') || ' ' || coalesce(p.display_name,'') || ' ' || coalesce(p.bio,'')),
      plainto_tsquery('simple',${query})) DESC,
      followers DESC,p.created_at DESC
    LIMIT 12
   `,
   sql`
    SELECT p.id,p.text,p.created_at,u.handle AS author_handle,
       coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS author,
       (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes,
       (SELECT count(*)::int FROM looke_comments c WHERE c.post_id=p.id AND c.moderation_status='visible') AS comments
    FROM looke_posts p JOIN looke_profiles u ON u.id=p.profile_id
    WHERE p.moderation_status='visible'
      AND to_tsvector('simple',p.text) @@ plainto_tsquery('simple',${query})
    ORDER BY ts_rank_cd(to_tsvector('simple',p.text),plainto_tsquery('simple',${query})) DESC,
      p.created_at DESC,p.id DESC
    LIMIT 20
   `
  ]);
  return NextResponse.json({query,creators,posts},{headers:{"Cache-Control":"public, no-store"}});
 }catch{
  return NextResponse.json({error:"Discovery search unavailable",creators:[],posts:[]},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
