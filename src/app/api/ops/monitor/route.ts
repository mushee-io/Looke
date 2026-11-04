import { NextResponse } from "next/server";
import { getOperatorHealth } from "../../../../lib/ops/monitor";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const value=await getOperatorHealth();
    return NextResponse.json(value,{
      status:value.status==="healthy"?200:503,
      headers:{"cache-control":"no-store, max-age=0","x-robots-tag":"noindex"},
    });
  }catch{
    return NextResponse.json({
      service:"looke-m7",status:"degraded",beta:"closed",error:"Dependency monitoring unavailable.",
    },{status:503,headers:{"cache-control":"no-store, max-age=0","x-robots-tag":"noindex"}});
  }
}
