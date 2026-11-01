/** Strictly bind a persisted login challenge to the current origin and wallet. */
export function challengeMatchesRequest(message, host, address, now = Date.now()) {
  if (typeof message !== "string" || typeof host !== "string" || typeof address !== "string") return false;
  const lines = message.split("\n");
  if (lines.length !== 8) return false;
  const expected = [
    "Looke — Sign in to your Ultra EVM testnet social account",
    "Domain: " + host,
    "Address: " + address.toLowerCase(),
    "Chain ID: 18881"
  ];
  if (!expected.every((value, i) => lines[i] === value)) return false;
  if (!/^Nonce: [a-f0-9]{40}$/.test(lines[4])) return false;
  if (!/^Issued At: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(lines[5])) return false;
  if (!/^Expires At: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(lines[6])) return false;
  if (lines[7] !== "This signature is only for login. It does not authorize spending or trading.") return false;
  const issued = Date.parse(lines[5].slice(11));
  const expires = Date.parse(lines[6].slice(12));
  // Date.parse normalizes some impossible calendar dates; require exact UTC round trips.
  if (!Number.isFinite(issued) || !Number.isFinite(expires)) return false;
  if (new Date(issued).toISOString() !== lines[5].slice(11)) return false;
  if (new Date(expires).toISOString() !== lines[6].slice(12)) return false;
  // Allow at most 30 seconds of clock skew; reject stale or future-issued challenges.
  // Database expiry and single-use consumption remain the authoritative server-side gates.
  return Number.isFinite(issued) && Number.isFinite(expires) && Number.isFinite(now)
    && expires > issued && expires - issued <= 300000
    && issued <= now + 30000 && expires > now - 30000;
}
