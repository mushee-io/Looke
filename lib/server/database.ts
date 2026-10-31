import "server-only";
import postgres from "postgres";
let client: ReturnType<typeof postgres> | null = null;
export function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Looke database is not configured");
  // Never leak connection strings in responses or logs.
  return client ??= postgres(url, { max: 3, idle_timeout: 10, connect_timeout: 5, ssl: "require" });
}
