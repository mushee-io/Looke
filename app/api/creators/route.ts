import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/server/database";

export const dynamic = "force-dynamic";

/** Public discoverable creators. Only public profile information is returned. */
export async function GET(request: NextRequest) {
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  if (search.length > 40) return NextResponse.json({error:"Search too long"},{status:400});
  try {
    const sql = database();
    const creators = await sql`
      SELECT p.id, p.handle, p.display_name, p.bio,
        (SELECT count(*)::int FROM looke_follows f WHERE f.followed_id=p.id) AS followers,
        (SELECT count(*)::int FROM looke_posts po WHERE po.profile_id=p.id AND po.moderation_status='visible') AS posts
      FROM looke_profiles p
      WHERE p.handle IS NOT NULL
        AND (${search}='' OR strpos(p.handle,lower(${search}))>0
          OR strpos(lower(coalesce(p.display_name,'')),lower(${search}))>0)
      ORDER BY followers DESC, p.created_at DESC
      LIMIT 12
    `;
    return NextResponse.json({creators},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Creator directory unavailable",creators:[]},{status:503});
  }
}
