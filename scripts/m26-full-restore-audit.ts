/** Read-only full 18-table validation against separately restored TLS PostgreSQL.
 * No restore or release action is ever performed.
 */
import {Pool} from "pg";
import {mkdir,writeFile} from "node:fs/promises";
import {validateFullRestorePair} from "../src/lib/beta/m24-full-restore";
import {digestAllM26Tables,compareAllM26Tables} from "../src/lib/beta/m26-acceptance";
async function main(){
 const primary=process.env.DATABASE_URL,restore=process.env.LOOKE_M26_RESTORE_DATABASE_URL;
 const dbs=validateFullRestorePair(primary,restore);
 const pool=(url:string)=>new Pool({connectionString:url,max:1,connectionTimeoutMillis:8000,statement_timeout:60000});
 const a=pool(primary!),b=pool(restore!);
 try{
  const run=async(p:Pool)=>{const c=await p.connect();try{return await digestAllM26Tables(c,true);}finally{c.release();}};
  const [source,recovered]=await Promise.all([run(a),run(b)]);
  const compared=compareAllM26Tables(source,recovered);
  const manifest={milestone:"M26",date:new Date().toISOString(),readOnly:true,
   primaryDatabase:dbs.primaryDatabase,restoredDatabase:dbs.restoredDatabase,
   source,recovered,comparison:compared,independentRestoreHumanWitness:false,
   securityAuditorVerified:false,releaseAuthorized:false};
  await mkdir("artifacts/m26",{recursive:true});
  await writeFile("artifacts/m26/full-restore.json",JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({tables:source.length,status:compared.comparison,
   drift:compared.differences,independentWitness:false,release:"NO_GO"}));
  if(compared.comparison!=="MATCHED_FULL_ROWS")process.exitCode=2;
 }finally{await Promise.allSettled([a.end(),b.end()]);}
}
main().catch(e=>{console.error("M26 full restore verification BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
