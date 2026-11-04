/** Disposable CI or staging read-only PostgreSQL operational verification. */
import {Pool} from "pg";
import {inspectSocialDatabase,localDbOverrideAllowed} from "../src/lib/ops/m8-db-audit";
const url=process.env.DATABASE_URL;
async function main(){
  if(!url)throw new Error("Social DB not configured. No database readiness is claimed.");
  const allowLocal=localDbOverrideAllowed(url,process.env.LOOKE_M8_ALLOW_LOCAL_PLAINTEXT_DB);
  const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
  try {
    const client=await pool.connect();
    try{
      const report=await inspectSocialDatabase(client,allowLocal);
      console.log(JSON.stringify(report,null,2));
      if(report.status!=="verified")process.exitCode=2;
    }finally{client.release();}
  }finally{await pool.end();}
}
main().catch(error=>{
  console.error("Read-only social DB audit BLOCKED:",error instanceof Error?error.message:"unknown");
  process.exitCode=2;
});
