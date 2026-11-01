/** Deterministic, side-effect-free Ultra EVM login challenge formatting. */
export function formatLoginChallenge({ host, address, nonce, issuedAt, expiresAt }) {
  if (typeof host !== "string" || !/^[a-z0-9.-]+(?::[0-9]{1,5})?$/i.test(host) ||
      typeof address !== "string" || !/^0x[0-9a-f]{40}$/.test(address) ||
      typeof nonce !== "string" || !/^[0-9a-f]{40}$/.test(nonce) ||
      !(issuedAt instanceof Date) || !(expiresAt instanceof Date) ||
      !Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) ||
      expiresAt.getTime() - issuedAt.getTime() !== 300000) {
    throw new TypeError("Invalid login challenge context");
  }
  return [
    "Looke — Sign in to your Ultra EVM testnet social account",
    "Domain: " + host,
    "Address: " + address,
    "Chain ID: 18881",
    "Nonce: " + nonce,
    "Issued At: " + issuedAt.toISOString(),
    "Expires At: " + expiresAt.toISOString(),
    "This signature is only for login. It does not authorize spending or trading."
  ].join("\n");
}
