/** Compare primary and separately restored databases, READ ONLY, never migrate.
 * Requires two distinct operator-provided TLS verify-ca/full PostgreSQL URLs.
 */
import {Pool} from "pg";
import {mkdir,writeFile} from "node:fs/promises";
import {validateRestorePair,auditReadOnlySnapshot,compareRestoredSnapshots} from "../src/lib/beta/m22-restore";
async function main(){
 const primary=process.env.DATABASE_URL,restored=process.env.LOOKE_M22_RESTORE_DATABASE_URL;
 const pair=validateRestorePair(primary,restored);
 const connect=(url:string)=>new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000,statement_timeout:12000});
 const a=connect(primary!),b=connect(restored!);
 try{
  const [first,second]=await Promise.all([
   (async()=>{const c=await a.connect();try{return await auditReadOnlySnapshot(c);}finally{c.release();}})(),
   (async()=>{const c=await b.connect();try{return await auditReadOnlySnapshot(c);}finally{c.release();}})(),
  ]);
  const check=compareRestoredSnapshots(first,second);
  const result={milestone:"M22",readOnly:true,primaryDatabase:pair.primaryDatabase,
   restoredDatabase:pair.restoredDatabase,checkedAt:new Date().toISOString(),
   check,releaseApproved:false,noTransactionsSent:true};
  await mkdir("artifacts/m22",{recursive:true});
  await writeFile("artifacts/m22/restored-db-audit.json",JSON.stringify(result,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({milestone:"M22",status:check.status,tablesCompared:check.tablesCompared,
   drift:check.drift,restoreWitnessApproved:false,releaseApproved:false},null,2));
  if(check.status!=="sample_matched")process.exitCode=2;
 }finally{await Promise.allSettled([a.end(),b.end()]);}
}
main().catch(e=>{console.error("M22 restore audit BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
