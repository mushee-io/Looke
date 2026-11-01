export type PublicSession = { createdAt: string; expiresAt: string; current: boolean };
export function publicSessionRows(rows: {created_at: string | Date; expires_at: string | Date; is_current: boolean; token_hash?: string}[]): PublicSession[];
