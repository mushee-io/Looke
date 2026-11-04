import { type NextRequest, NextResponse } from "next/server";
import { createChallenge, logout, sessionResponse, verifyChallenge, verifyRequestOrigin, viewer } from "../../../../lib/social/auth";
import { failure, readJson } from "../../../../lib/social/http";
import { challenge, signature } from "../../../../lib/social/validation";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
  try{
    const user=await viewer(req);
    return NextResponse.json({authenticated:Boolean(user),user},{headers:{"cache-control":"no-store"}});
  }catch(error){return failure(error);}
}

export async function POST(req:NextRequest){
  try{
    verifyRequestOrigin(req);
    const input=await readJson(req);
    const action=input.action;
    if(action==="challenge"){
      const data=challenge.parse({address:input.address});
      return NextResponse.json(await createChallenge(data.address),{headers:{"cache-control":"no-store"}});
    }
    if(action==="verify"){
      const data=signature.parse({challengeId:input.challengeId,signature:input.signature});
      const result=await verifyChallenge(data.challengeId,data.signature);
      return sessionResponse(result.token,result.user);
    }
    if(action==="logout")return logout(req);
    return NextResponse.json({error:"Unsupported authentication action."},{status:400});
  }catch(error){return failure(error);}
}
