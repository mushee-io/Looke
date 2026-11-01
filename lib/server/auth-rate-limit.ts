import "server-only";
import { database } from "./database";
import { authIpBucketKey, trustedVercelIp } from "../auth-ip.mjs";

export type AuthRateResult = "allowed" | "limited" | "unavailable";

/**
 * Fixed 10-minute rate buckets in dedicated PostgreSQL.
 * Production fails closed until the source-IP trust boundary and server secret
 * are available. Vercel WAF should independently rate limit these routes too.
 */
export async function checkAuthRateLimit(request: Request, scope: "challenge" | "verify"): Promise<AuthRateResult> {
  if (process.env.NODE_ENV !== "production") return "allowed";
  try {
    const ip = trustedVercelIp(request.headers, process.env.VERCEL === "1");
    const secret = process.env.LOOKE_AUTH_RATE_SECRET;
    if (!ip || !secret || secret.length < 32) return "unavailable";

    const bucket = authIpBucketKey(secret, scope, ip);
    const limit = scope === "challenge" ? 12 : 30;
    const sql = database();
    // The unique-key UPSERT is atomic even with multiple serverless workers.
    const attempts = await sql`
      INSERT INTO looke_auth_rate_limits(key_hash, attempts, window_started_at)
      VALUES(${bucket}, 1, now())
      ON CONFLICT(key_hash) DO UPDATE SET
        attempts = CASE
          WHEN looke_auth_rate_limits.window_started_at <= now() - interval '10 minutes'
          THEN 1 ELSE looke_auth_rate_limits.attempts + 1 END,
        window_started_at = CASE
          WHEN looke_auth_rate_limits.window_started_at <= now() - interval '10 minutes'
          THEN now() ELSE looke_auth_rate_limits.window_started_at END
      RETURNING attempts
    `;
    return Number(attempts[0]?.attempts) <= limit ? "allowed" : "limited";
  } catch {
    // Database or rate limiter failure may not silently disable production protection.
    return "unavailable";
  }
}
