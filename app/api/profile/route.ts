import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
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
    const body=await parseJson(request) as {handle?:unknown;displayName?:unknown;bio?:unknown};
    const handle=typeof body.handle==="string"?body.handle.trim().toLowerCase():null;
    const displayName=typeof body.displayName==="string"?body.displayName.trim():null;
    const bio=typeof body.bio==="string"?body.bio.trim():null;
    if(handle===null || !/^[a-z][a-z0-9_]{2,29}$/.test(handle) ||
       displayName===null || displayName.length>80 ||
       bio===null || bio.length>280) return NextResponse.json({error:"Invalid profile fields"},{status:400});
    const sql=database();
    const rows=await sql`UPDATE looke_profiles SET handle=${handle},display_name=${displayName},bio=${bio},updated_at=now() WHERE id=${profile.id} RETURNING id,handle,display_name,bio,evm_address`;
    return NextResponse.json({profile:rows[0]}, {headers:{"Cache-Control":"no-store"}});
  } catch(e) {
    if((e as {code?:string}).code==="23505") return NextResponse.json({error:"Handle already taken"},{status:409});
    return NextResponse.json({error:"Profile update unavailable"},{status:503});
  }
}
