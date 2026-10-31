import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
export async function POST(request:Request) {
  if(!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  try {
    const profile=await currentProfile();
    if(!profile) return NextResponse.json({error:"Sign in first"},{status:401});
    const body=await parseJson(request) as {postId?:unknown;liked?:unknown};
    if(typeof body.postId!=="string" || !/^[0-9a-f-]{36}$/i.test(body.postId) || typeof body.liked!=="boolean") return NextResponse.json({error:"Invalid request"},{status:400});
    const sql=database();
    if(body.liked) {
      const existing=await sql`SELECT id FROM looke_posts WHERE id=${body.postId} AND moderation_status='visible' LIMIT 1`;
      if(!existing.length) return NextResponse.json({error:"Post unavailable"},{status:404});
      await sql`INSERT INTO looke_likes(profile_id,post_id) VALUES(${profile.id},${body.postId}) ON CONFLICT DO NOTHING`;
    } else await sql`DELETE FROM looke_likes WHERE profile_id=${profile.id} AND post_id=${body.postId}`;
    return NextResponse.json({ok:true,liked:body.liked});
  } catch {return NextResponse.json({error:"Likes unavailable"},{status:503});}
}
