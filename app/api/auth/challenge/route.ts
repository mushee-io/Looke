import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { formatLoginChallenge } from "@/lib/login-challenge.mjs";
import { getAddress, isAddress } from "viem";
import { database } from "@/lib/server/database";
import { parseJson, validOrigin } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const input = await parseJson(request) as { address?: unknown };
    if (typeof input?.address !== "string" || !isAddress(input.address)) return NextResponse.json({error:"Invalid EVM address"}, {status:400});
    const address = getAddress(input.address).toLowerCase();
    const sql = database();
    // Basic per-address challenge throttle; protect the public endpoint with a production edge rate limiter too.
    const recent = await sql`SELECT count(*)::int AS count FROM looke_challenges WHERE evm_address=${address} AND created_at > now() - interval '15 minutes'`;
    if (Number(recent[0]?.count) >= 6) return NextResponse.json({error:"Please retry later"}, {status:429});
    const nonce = randomBytes(20).toString("hex");
    const issued = new Date();
    const expiry = new Date(issued.getTime() + 5 * 60_000);
    const host = new URL(request.url).host;
    const message = formatLoginChallenge({ host, address, nonce, issuedAt: issued, expiresAt: expiry });
    const rows = await sql`INSERT INTO looke_challenges(evm_address,message,expires_at) VALUES(${address},${message},${expiry.toISOString()}) RETURNING id`;
    return NextResponse.json({ challengeId: rows[0].id, message, expiresAt: expiry.toISOString() }, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Authentication is unavailable until the database is configured"}, {status:503});
  }
}
