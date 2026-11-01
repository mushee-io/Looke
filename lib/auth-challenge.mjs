/** Strictly bind a persisted login challenge to the current origin and wallet. */
export function challengeMatchesRequest(message, host, address) {
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
  return Number.isFinite(issued) && Number.isFinite(expires) && expires > issued && expires - issued <= 300000;
}
