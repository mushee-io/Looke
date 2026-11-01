/**
 * Convert database session rows into safe, user-visible metadata.
 * In particular, never serialize bearer session tokens or their SHA-256 hashes.
 */
export function publicSessionRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Expected session rows");
  return rows.map(row => ({
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    current: row.is_current === true,
  }));
}
