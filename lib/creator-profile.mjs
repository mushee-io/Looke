// Profile normalization shared by M5 APIs and regression tests.
// Social handles are not wallet addresses, identities or verified endorsements.
const RESERVED = new Set([
  "admin","administrator","api","auth","billing","creators","dev","developers",
  "explore","feed","help","looke","moderator","official","owner","privacy",
  "root","security","settings","staff","support","system","team","terms","verify","wallet"
]);

export function canonicalCreatorHandle(value) {
  if (typeof value !== "string") return null;
  const handle = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,29}$/.test(handle) || RESERVED.has(handle)) return null;
  return handle;
}

export function normalizeCreatorProfile(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new Error("Expected profile object");
  const handle = canonicalCreatorHandle(data.handle);
  if (!handle || typeof data.displayName !== "string" || typeof data.bio !== "string")
    throw new Error("Invalid profile fields");
  const displayName = data.displayName.trim();
  const bio = data.bio.trim().replace(/\r\n?/g,"\n");
  const hasUnsafeControl = s => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s);
  if (Array.from(displayName).length > 80 || Array.from(bio).length > 280 ||
      hasUnsafeControl(displayName) || hasUnsafeControl(bio))
    throw new Error("Invalid profile fields");
  return { handle, displayName, bio };
}

export function creatorProfilePath(handle) {
  const canonical = canonicalCreatorHandle(handle);
  if (!canonical) throw new Error("Invalid creator handle");
  return "/creators/" + encodeURIComponent(canonical);
}
