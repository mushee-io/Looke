import { NextRequest, NextResponse } from "next/server";
import { checkBetaHealth } from "../../../../lib/beta/readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
  if(req.nextUrl.searchParams.get("mode")==="live"){
    return NextResponse.json({
      service:"looke",status:"running",beta:"closed-by-default",
      note:"Liveness is not operational readiness and does not authorize public beta.",
    },{headers:{"cache-control":"no-store"}});
  }
  try{
    const result=await checkBetaHealth();
    return NextResponse.json(result,{status:result.status==="healthy"?200:503,headers:{"cache-control":"no-store"}});
  }catch{
    return NextResponse.json({
      service:"looke",status:"degraded",beta:"closed",error:"Dependency checks unavailable.",
    },{status:503,headers:{"cache-control":"no-store"}});
  }
}
