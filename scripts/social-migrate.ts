import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { socialDb } from "../src/lib/social/db";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Social migrations are not automatic.");
  const db=socialDb();
  for(const filename of ["001_social_foundation.sql","002_social_media_review.sql"]){
    const sql=await readFile(resolve("db/migrations",filename),"utf8");
    await db.query(sql);
    console.log("Applied Looke social migration "+filename);
  }
  await db.end();
}
main().catch(error => { console.error(error); process.exitCode=1; });
