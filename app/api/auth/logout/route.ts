import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { database } from "@/lib/server/database";
import { SESSION_COOKIE, tokenHash, validOrigin } from "@/lib/server/session";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({error:"Invalid origin"},{status:403});
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    try { await database()`DELETE FROM looke_sessions WHERE token_hash=${tokenHash(token)}`; }
    catch { return NextResponse.json({error:"Could not revoke session"},{status:503}); }
  }
  const response = NextResponse.json({authenticated:false});
  response.cookies.set(SESSION_COOKIE,"",{path:"/",maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax"});
  return response;
}
