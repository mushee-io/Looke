import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
export async function POST(request:Request) {
  if(!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  try {
    const profile=await currentProfile();
    if(!profile) return NextResponse.json({error:"Sign in first"},{status:401});
    const body=await parseJson(request) as {profileId?:unknown;follow?:unknown};
    if(typeof body.profileId!=="string" || !/^[0-9a-f-]{36}$/i.test(body.profileId) || typeof body.follow!=="boolean") return NextResponse.json({error:"Invalid request"},{status:400});
    if(body.profileId===profile.id) return NextResponse.json({error:"Cannot follow yourself"},{status:400});
    const sql=database();
    if(body.follow) {
      const target=await sql`SELECT id FROM looke_profiles WHERE id=${body.profileId} LIMIT 1`;
      if(!target.length) return NextResponse.json({error:"Creator not found"},{status:404});
      await sql`INSERT INTO looke_follows(follower_id,followed_id) VALUES(${profile.id},${body.profileId}) ON CONFLICT DO NOTHING`;
    } else await sql`DELETE FROM looke_follows WHERE follower_id=${profile.id} AND followed_id=${body.profileId}`;
    return NextResponse.json({ok:true,following:body.follow});
  } catch {return NextResponse.json({error:"Following unavailable"},{status:503});}
}
