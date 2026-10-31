import { NextResponse } from "next/server";
import { currentProfile } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const profile = await currentProfile(); return NextResponse.json({authenticated:!!profile,profile}, {headers:{"Cache-Control":"no-store"}}); }
  catch { return NextResponse.json({authenticated:false,profile:null,reason:"database_unavailable"}, {status:503}); }
}
