import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyMessage, getAddress, isAddress } from "viem";
import { database } from "@/lib/server/database";
import { challengeMatchesRequest } from "@/lib/auth-challenge.mjs";
import { validChallengeId } from "@/lib/challenge-id.mjs";
import { SESSION_COOKIE, SESSION_SECONDS, tokenHash, parseJson, validOrigin } from "@/lib/server/session";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({error:"Invalid origin"}, {status:403});
  try {
    const payload = await parseJson(request) as { challengeId?: unknown; address?: unknown; signature?: unknown };
    if (typeof payload?.address !== "string" || !isAddress(payload.address) ||
      !validChallengeId(payload.challengeId) ||
      typeof payload.signature !== "string" || !/^0x[0-9a-f]{130}$/i.test(payload.signature)) {
      return NextResponse.json({error:"Invalid signature request"}, {status:400});
    }
    const address = getAddress(payload.address).toLowerCase();
    const sql = database();
    const challenges = await sql`SELECT id, message, evm_address FROM looke_challenges WHERE id=${payload.challengeId} AND evm_address=${address} AND consumed_at IS NULL AND expires_at > now() LIMIT 1`;
    if (!challenges.length) return NextResponse.json({error:"Challenge expired or already used"}, {status:401});
    if (!challengeMatchesRequest(challenges[0].message, new URL(request.url).host, address)) return NextResponse.json({error:"Challenge origin or context mismatch"}, {status:401});
    const valid = await verifyMessage({ address: getAddress(address), message: challenges[0].message, signature: payload.signature as `0x${string}` });
    if (!valid) return NextResponse.json({error:"Signature verification failed"}, {status:401});
    const consumed = await sql`UPDATE looke_challenges SET consumed_at=now() WHERE id=${payload.challengeId} AND consumed_at IS NULL AND expires_at > now() RETURNING id`;
    if (!consumed.length) return NextResponse.json({error:"Challenge already consumed"}, {status:401});
    const profiles = await sql`INSERT INTO looke_profiles(evm_address) VALUES(${address}) ON CONFLICT(evm_address) DO UPDATE SET evm_address=excluded.evm_address RETURNING id, evm_address, handle, display_name`;
    const token = randomBytes(32).toString("hex");
    await sql`INSERT INTO looke_sessions(token_hash,profile_id,expires_at) VALUES (${tokenHash(token)},${profiles[0].id}, now() + interval '7 days')`;
    const response = NextResponse.json({authenticated:true,profile:profiles[0]});
    response.cookies.set(SESSION_COOKIE,token,{path:"/",httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",maxAge:SESSION_SECONDS});
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch {
    return NextResponse.json({error:"Login failed or database is not configured"}, {status:503});
  }
}
