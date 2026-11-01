import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { checkedSocialUuid } from "@/lib/social-interactions.mjs";
export async function POST(request:Request) {
  if(!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  try {
    const profile=await currentProfile();
    if(!profile) return NextResponse.json({error:"Sign in first"},{status:401});
    const body=await parseJson(request) as {profileId?:unknown;follow?:unknown};
    let targetId:string;
    try {targetId=checkedSocialUuid(body?.profileId);}
    catch{return NextResponse.json({error:"Invalid creator ID"},{status:400});}
    if(typeof body?.follow!=="boolean")return NextResponse.json({error:"Invalid follow action"},{status:400});
    if(targetId===profile.id)return NextResponse.json({error:"Cannot follow yourself"},{status:400});
    const sql=database();
    if(body.follow) {
      const target=await sql`SELECT id FROM looke_profiles WHERE id=${targetId} LIMIT 1`;
      if(!target.length) return NextResponse.json({error:"Creator not found"},{status:404});
      await sql`INSERT INTO looke_follows(follower_id,followed_id) VALUES(${profile.id},${targetId}) ON CONFLICT DO NOTHING`;
    } else await sql`DELETE FROM looke_follows WHERE follower_id=${profile.id} AND followed_id=${targetId}`;
    return NextResponse.json({ok:true,following:body.follow});
  } catch {return NextResponse.json({error:"Following unavailable"},{status:503});}
}
