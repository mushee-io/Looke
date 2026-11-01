import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { encodeFeedCursor, decodeFeedCursor } from "@/lib/feed-pagination.mjs";
import { cleanPostText } from "@/lib/post-content.mjs";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

/** Paginated newest-first public feed with a deterministic (timestamp, ID) cursor. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("cursor");
  let cursor: {createdAt:string;id:string}|null = null;
  if(raw !== null) {
    try { cursor=decodeFeedCursor(raw); }
    catch { return NextResponse.json({error:"Invalid feed cursor"},{status:400,headers:{"Cache-Control":"no-store"}}); }
  }
  try {
    const sql=database();
    const me=await currentProfile();
    const posts=await sql`
      SELECT p.id,p.text,p.created_at,p.edited_at,p.profile_id,u.id AS author_id,
        u.handle AS author_handle,
        coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS author,
        to_char(p.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
        (p.profile_id=${me?.id ?? null}::uuid) AS is_owner,
        (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes,
        EXISTS(SELECT 1 FROM looke_likes l WHERE l.post_id=p.id AND l.profile_id=${me?.id ?? null}::uuid) AS user_liked,
        EXISTS(SELECT 1 FROM looke_follows f WHERE f.followed_id=p.profile_id AND f.follower_id=${me?.id ?? null}::uuid) AS user_following
      FROM looke_posts p JOIN looke_profiles u ON u.id=p.profile_id
      WHERE p.moderation_status='visible'
        AND (${cursor?.createdAt ?? null}::timestamptz IS NULL OR
          (p.created_at,p.id) < (${cursor?.createdAt ?? null}::timestamptz,${cursor?.id ?? null}::uuid))
      ORDER BY p.created_at DESC,p.id DESC LIMIT ${PAGE_SIZE+1}
    `;
    const page=posts.slice(0,PAGE_SIZE);
    const last=page[page.length-1];
    const nextCursor=posts.length>PAGE_SIZE && last
      ?encodeFeedCursor(last.cursor_time,last.id) : null;
    const cleaned=page.map(({cursor_time: _time,profile_id: _profileId,...post})=>post);
    return NextResponse.json({posts:cleaned,nextCursor}, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Social feed is not configured",posts:[],nextCursor:null}, {status:503,headers:{"Cache-Control":"no-store"}});
  }
}

/** Rate-limit text publishing atomically per creator to avoid concurrent-request bypass. */
export async function POST(request: Request) {
  if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
  try{
    const profile=await currentProfile();
    if(!profile)return NextResponse.json({error:"Sign in before posting"},{status:401});
    const body=await parseJson(request) as {text?:unknown};
    let text:string;
    try{text=cleanPostText(body?.text);}
    catch{return NextResponse.json({error:"Post must contain 1–1200 valid characters"},{status:400});}
    const sql=database();
    const post=await sql.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${profile.id}::text))`;
      const recent=await tx`SELECT count(*)::int AS count FROM looke_posts
         WHERE profile_id=${profile.id} AND created_at>now()-interval '1 minute'`;
      if(Number(recent[0]?.count ?? 0)>=3)throw new Error("POST_RATE_LIMIT");
      const rows=await tx`INSERT INTO looke_posts(profile_id,text)
         VALUES(${profile.id},${text}) RETURNING id,text,created_at`;
      return rows[0];
    });
    return NextResponse.json({post},{status:201,headers:{"Cache-Control":"no-store"}});
  } catch(error){
    if(error instanceof Error && error.message==="POST_RATE_LIMIT")
      return NextResponse.json({error:"Please wait before publishing again"},{status:429,headers:{"Retry-After":"60"}});
    return NextResponse.json({error:"Publishing unavailable; database or migration missing"},{status:503});
  }
}
