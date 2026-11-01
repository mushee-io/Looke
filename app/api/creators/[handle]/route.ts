import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile } from "@/lib/server/session";
import { canonicalCreatorHandle } from "@/lib/creator-profile.mjs";

export const dynamic="force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{handle:string}> },
) {
  const handle=canonicalCreatorHandle((await params).handle);
  if(!handle)return NextResponse.json({error:"Invalid creator handle"},{status:400});
  try {
    const sql=database();
    const viewer=await currentProfile();
    const creators=await sql`
      SELECT p.id,p.handle,p.display_name,p.bio,p.created_at,
        (SELECT count(*)::int FROM looke_follows f WHERE f.followed_id=p.id) AS followers,
        (SELECT count(*)::int FROM looke_follows f WHERE f.follower_id=p.id) AS following,
        (SELECT count(*)::int FROM looke_posts po WHERE po.profile_id=p.id AND po.moderation_status='visible') AS post_count,
        EXISTS(SELECT 1 FROM looke_follows f WHERE f.followed_id=p.id AND f.follower_id=${viewer?.id ?? null}::uuid) AS viewer_follows
      FROM looke_profiles p WHERE p.handle=${handle} LIMIT 1
    `;
    if(!creators.length) return NextResponse.json({error:"Creator not found"},{status:404,headers:{"Cache-Control":"no-store"}});
    const posts=await sql`
      SELECT p.id,p.text,p.created_at,
        (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes
      FROM looke_posts p
      WHERE p.profile_id=${creators[0].id} AND p.moderation_status='visible'
      ORDER BY p.created_at DESC LIMIT 20
    `;
    return NextResponse.json({
      creator:creators[0], posts, ownProfile:viewer?.id === creators[0].id,
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Creator profile unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
