import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * Use only Vercel's documented platform-set x-vercel-forwarded-for when running
 * in its managed runtime. Never trust arbitrary forwarding headers in other hosts.
 */
export function trustedVercelIp(headers, isVercelRuntime) {
  if (!isVercelRuntime) return null;
  const forwarded = headers.get("x-vercel-forwarded-for");
  if (!forwarded || forwarded.includes(",") || forwarded.length > 64) return null;
  const ip = forwarded.trim();
  return isIP(ip) ? ip : null;
}

/** HMAC IP with a server secret so the database never stores the raw address. */
export function authIpBucketKey(secret, scope, ip) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("Missing rate-limit secret");
  if (!["challenge", "verify"].includes(scope) || typeof ip !== "string" || !isIP(ip)) {
    throw new Error("Invalid rate-limit bucket");
  }
  return createHmac("sha256", secret).update("looke:auth:" + scope + ":" + ip).digest("hex");
}
