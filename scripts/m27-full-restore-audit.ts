/** Read-only full-row/schema verification of 19 tables on an independently restored TLS DB.
 * This does NOT perform backup/restore, validate human identity, or enable beta.
 */
import {Pool} from "pg";
import {mkdir,writeFile} from "node:fs/promises";
import {validateFullRestorePair} from "../src/lib/beta/m24-full-restore";
import {digestM27Database,compareM27Databases} from "../src/lib/beta/m27-evidence";
async function main(){
 const primary=process.env.DATABASE_URL,restored=process.env.LOOKE_M27_RESTORE_DATABASE_URL;
 const endpoints=validateFullRestorePair(primary,restored);
 const pool=(url:string)=>new Pool({connectionString:url,max:1,connectionTimeoutMillis:8000,statement_timeout:60000});
 const a=pool(primary!),b=pool(restored!);
 try{
  const check=async(p:Pool)=>{
   const c=await p.connect();
   try{return await digestM27Database(c,true);}finally{c.release();}
  };
  const [source,recovered]=await Promise.all([check(a),check(b)]);
  const result=compareM27Databases(source,recovered);
  const output={milestone:"M27",sourceDatabase:endpoints.primaryDatabase,
   restoredDatabase:endpoints.restoredDatabase,checkedAt:new Date().toISOString(),
   comparison:result,source,recovered,readOnly:true,
   actualBackupRestoredByThisTool:false,backupOriginVerified:false,
   independentHumanWitnessVerified:false,releaseDecision:"NO_GO",transactionsSent:0};
  await mkdir("artifacts/m27",{recursive:true});
  await writeFile("artifacts/m27/full-restore.json",JSON.stringify(output,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({milestone:"M27",tables:result.tableCount,
   comparison:result.comparison,differences:result.differences,
   independentHumanRestoreWitness:false,releaseDecision:"NO_GO"}));
  if(result.comparison!=="MATCHED_FULL_ROWS")process.exitCode=2;
 }finally{await Promise.allSettled([a.end(),b.end()]);}
}
main().catch(e=>{console.error("M27 independent restore comparison BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
