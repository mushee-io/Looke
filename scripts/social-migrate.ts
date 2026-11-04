import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { socialDb } from "../src/lib/social/db";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Social migrations are not automatic.");
  const sql = await readFile(resolve("db/migrations/001_social_foundation.sql"), "utf8");
  const db = socialDb();
  await db.query(sql);
  console.log("Looke M5 social database migration completed.");
  await db.end();
}
main().catch(error => { console.error(error); process.exitCode=1; });
