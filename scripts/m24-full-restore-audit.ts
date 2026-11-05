import {Pool} from "pg";
import {mkdir,writeFile} from "node:fs/promises";
import {digestFullDatabase,compareFullDatabase,validateFullRestorePair} from "../src/lib/beta/m24-full-restore";
async function main(){
 const a=process.env.DATABASE_URL,b=process.env.LOOKE_M24_RESTORE_DATABASE_URL;
 const endpoints=validateFullRestorePair(a,b);
 const connect=(url:string)=>new Pool({connectionString:url,max:1,
  connectionTimeoutMillis:7000,statement_timeout:60000});
 const p=connect(a!),r=connect(b!);
 try{
  // Two distinct actual TLS-encrypted, read-only PostgreSQL connections.
  const [source,restored]=await Promise.all([
   (async()=>{const c=await p.connect();try{return await digestFullDatabase(c,{enforceTLS:true});}finally{c.release();}})(),
   (async()=>{const c=await r.connect();try{return await digestFullDatabase(c,{enforceTLS:true});}finally{c.release();}})(),
  ]);
  const report=compareFullDatabase(source,restored);
  const output={milestone:"M24",sourceDatabase:endpoints.primaryDatabase,
   restoredDatabase:endpoints.restoredDatabase,checkedAt:new Date().toISOString(),
   readOnly:true,report,source,restored,transactionsSent:0,publicBetaOpen:false};
  await mkdir("artifacts/m24",{recursive:true});
  await writeFile("artifacts/m24/full-restore.json",JSON.stringify(output,null,2)+"\n",
   {mode:0o600});
  console.log(JSON.stringify({milestone:"M24",comparison:report.comparison,
   tableCount:report.tableCount,differences:report.differences,
   independentOperatorWitnessAccepted:false,publicBetaOpen:false,
   artifact:"artifacts/m24/full-restore.json"},null,2));
  if(report.comparison!=="MATCHED_FULL_ROWS")process.exitCode=2;
 }finally{await Promise.allSettled([p.end(),r.end()]);}
}
main().catch(e=>{console.error("M24 independent restore integrity BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
