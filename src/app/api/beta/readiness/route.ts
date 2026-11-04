import { NextRequest, NextResponse } from "next/server";
import { closedConfigReadiness, computeBetaReadiness } from "../../../../lib/beta/readiness";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
  // A static CI check is intentionally never considered actual operational acceptance.
  if(req.nextUrl.searchParams.get("mode")==="config"){
    return NextResponse.json(closedConfigReadiness(),{headers:{"cache-control":"no-store"}});
  }
  try{
    const readiness=await computeBetaReadiness();
    return NextResponse.json(readiness,{headers:{"cache-control":"no-store"}});
  }catch{
    return NextResponse.json(closedConfigReadiness(),{headers:{"cache-control":"no-store"}});
  }
}
