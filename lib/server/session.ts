import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "./database";

export const SESSION_COOKIE = "looke_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function currentProfile() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const sql = database();
  const rows = await sql`
    SELECT p.id, p.evm_address, p.handle, p.display_name, p.bio
    FROM looke_sessions s
    JOIN looke_profiles p ON p.id = s.profile_id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > now()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // All state-changing API calls must come from Looke's own page.
  return !!origin && origin === new URL(request.url).origin;
}
export function parseJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("Expected application/json");
  }
  return request.json();
}
