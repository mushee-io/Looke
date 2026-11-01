import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { normalizeCreatorProfile } from "@/lib/creator-profile.mjs";
export const dynamic="force-dynamic";
export async function GET() {
  try {
    const profile=await currentProfile();
    return NextResponse.json({profile}, {status:profile?200:401,headers:{"Cache-Control":"no-store"}});
  } catch {return NextResponse.json({error:"Database unavailable"}, {status:503});}
}
export async function PATCH(request:Request) {
  if(!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  try {
    const profile=await currentProfile();
    if(!profile) return NextResponse.json({error:"Sign in required"},{status:401});
    const body=await parseJson(request);
    let validated: {handle:string;displayName:string;bio:string};
    try {validated=normalizeCreatorProfile(body);}
    catch {return NextResponse.json({error:"Invalid creator handle, name or bio"},{status:400});}
    const {handle,displayName,bio}=validated;
    const sql=database();
    const rows=await sql`UPDATE looke_profiles SET handle=${handle},display_name=${displayName},bio=${bio},updated_at=now() WHERE id=${profile.id} RETURNING id,handle,display_name,bio,evm_address`;
    return NextResponse.json({profile:rows[0]}, {headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    if((e as {code?:string}).code==="23505") return NextResponse.json({error:"Handle already taken"},{status:409});
    return NextResponse.json({error:"Profile update unavailable"},{status:503});
  }
}
