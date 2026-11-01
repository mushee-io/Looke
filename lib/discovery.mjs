/**
 * Transparent, non-AI search and feed ranking utilities.
 * Scores are discovery heuristics, not market, financial, or reputation scores.
 */
const MODES = Object.freeze(["latest", "trending", "for-you", "following"]);
export function checkedDiscoveryMode(value) {
  if (typeof value !== "string" || !MODES.includes(value)) {
    throw new RangeError("Invalid discovery feed mode");
  }
  return value;
}
export function normalizeDiscoveryQuery(raw) {
  if (typeof raw !== "string") throw new RangeError("Search requires 2–80 characters");
  const query = raw.trim().replace(/\s+/g, " ");
  if (Array.from(query).length < 2 || Array.from(query).length > 80 ||
      /[\u0000-\u001f\u007f]/.test(query)) {
    throw new RangeError("Search requires 2–80 valid characters");
  }
  return query;
}
export function discoveryScore({likes = 0, comments = 0, reposts = 0, ageHours = 0, followed = false}) {
  const counts = [likes, comments, reposts, ageHours];
  if (!counts.every(x => typeof x === "number" && Number.isFinite(x) && x >= 0)) {
    throw new RangeError("Invalid discovery input");
  }
  const activity = 3 * likes + 2 * comments + 5 * reposts;
  const recencyDecay = 1 + ageHours / 24;
  return ((1 + Math.log1p(activity)) / recencyDecay) * (followed ? 2.5 : 1);
}
