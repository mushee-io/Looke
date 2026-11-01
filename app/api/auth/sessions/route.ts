import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { database } from "@/lib/server/database";
import { SESSION_COOKIE, currentProfile, tokenHash, validOrigin } from "@/lib/server/session";
import { publicSessionRows } from "@/lib/auth-sessions.mjs";

export const dynamic = "force-dynamic";

/** Lists active login sessions for the currently authenticated Looke account. */
export async function GET() {
  try {
    const profile = await currentProfile();
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!profile || !token || !/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const sql = database();
    const [rows, totals] = await Promise.all([
      sql`SELECT created_at, expires_at, token_hash = ${tokenHash(token)} AS is_current
          FROM looke_sessions
          WHERE profile_id = ${profile.id} AND expires_at > now()
          ORDER BY created_at DESC LIMIT 30`,
      sql`SELECT count(*)::int AS total FROM looke_sessions
          WHERE profile_id = ${profile.id} AND expires_at > now()`,
    ]);
    return NextResponse.json({
      sessions: publicSessionRows(rows.map(row => ({
        created_at: row.created_at as Date,
        expires_at: row.expires_at as Date,
        is_current: row.is_current === true,
      }))),
      total: Number(totals[0]?.total ?? 0),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Session management is unavailable" }, { status: 503 });
  }
}

/** Revoke every session belonging to this account (including the current browser). */
export async function DELETE(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const profile = await currentProfile();
    if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const sql = database();
    const deleted = await sql`DELETE FROM looke_sessions WHERE profile_id = ${profile.id} RETURNING 1 AS revoked`;
    const response = NextResponse.json({ authenticated: false, revokedSessions: deleted.length });
    response.cookies.set(SESSION_COOKIE, "", {
      path: "/", maxAge: 0, httpOnly: true,
      secure: process.env.NODE_ENV === "production", sameSite: "lax",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    // Never claim to have revoked sessions when the database operation failed.
    return NextResponse.json({ error: "Could not revoke sessions" }, { status: 503 });
  }
}
