import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const sql=database();
    const me=await currentProfile();
    const posts=await sql`
      SELECT p.id,p.text,p.created_at,u.id AS author_id,
        coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS author,
        u.evm_address,
        (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes,
        EXISTS(SELECT 1 FROM looke_likes l WHERE l.post_id=p.id AND l.profile_id=${me?.id ?? null}::uuid) AS user_liked,
        EXISTS(SELECT 1 FROM looke_follows f WHERE f.followed_id=p.profile_id AND f.follower_id=${me?.id ?? null}::uuid) AS user_following
      FROM looke_posts p JOIN looke_profiles u ON u.id=p.profile_id
      WHERE p.moderation_status='visible' ORDER BY p.created_at DESC LIMIT 40
    `;
    return NextResponse.json({posts}, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Social feed is not configured",posts:[]}, {status:503});
  }
}
export async function POST(request: Request) {
  if(!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  try {
    const profile=await currentProfile();
    if(!profile) return NextResponse.json({error:"Sign in before posting"},{status:401});
    const body=await parseJson(request) as {text?:unknown};
    if(typeof body?.text!=="string" || !body.text.trim() || body.text.trim().length>1200) return NextResponse.json({error:"Post must contain 1–1200 characters"},{status:400});
    const sql=database();
    const recent=await sql`SELECT count(*)::int AS count FROM looke_posts WHERE profile_id=${profile.id} AND created_at>now()-interval '1 minute'`;
    if(Number(recent[0].count)>=3) return NextResponse.json({error:"Please wait before posting again"},{status:429});
    const rows=await sql`INSERT INTO looke_posts(profile_id,text) VALUES(${profile.id},${body.text.trim()}) RETURNING id,text,created_at`;
    return NextResponse.json({post:rows[0]}, {status:201,headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Posting is unavailable; database not configured or migration missing"},{status:503});
  }
}
