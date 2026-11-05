/** One-shot authorized M32 observer. No CREATE/INSERT/UPDATE/DELETE,
 * no user-level rows, no migration, and no token or wallet action.
 */
import {mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {compareM32Sources,inspectM32RealSource,requireDistinctM32Sources} from "../src/lib/beta/m32-reconciliation";
async function inspect(url:string){
 const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:8000,statement_timeout:12000});
 try{
  const c=await pool.connect();
  try{return await inspectM32RealSource(c,true);}
  finally{c.release();}
 }finally{await pool.end();}
}
async function main(){
 const legacy=process.env.LOOKE_M32_LEGACY_DATABASE_URL;
 const current=process.env.DATABASE_URL;
 let legacyResult:Awaited<ReturnType<typeof inspect>>|null=null;
 let currentResult:Awaited<ReturnType<typeof inspect>>|null=null;
 let failure:string|null=null;
 if(legacy&&current){
  try{
   requireDistinctM32Sources(legacy,current);
   legacyResult=await inspect(legacy);
   currentResult=await inspect(current);
  }catch{
   failure="Actual distinct TLS databases or read-only source evidence could not be verified.";
  }
 }
 const report={
  checkedAt:new Date().toISOString(),
  checkedBy:"m32-one-shot-real-read-only-postgresql",
  legacyConfigured:!!legacy,currentConfigured:!!current,
  ...compareM32Sources(legacyResult,currentResult),
  legacy:legacyResult,current:currentResult,
  blockedError:failure,
  originalSourceRecordsCopied:0,backupCreatedOrRestored:false,
  migrationsExecuted:0,financialBroadcasts:0,
  independentWitnessesApproved:false,realSecurityAuditApproved:false,
  sourceIdentifiersOrCredentialsPublished:false,
 };
 await mkdir("artifacts/m32",{recursive:true});
 await writeFile("artifacts/m32/reconciliation.json",JSON.stringify(report,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({milestone:"M32",legacyConnected:!!legacyResult,currentConnected:!!currentResult,
  legacyTables:report.legacyTables,currentTables:report.currentTables,
  releaseDecision:report.releaseDecision,recordTransfers:0,error:failure},null,2));
 if(process.argv.includes("--require-connected")&&(!legacyResult||!currentResult||!currentResult.currentSchemaCompatible))
  process.exitCode=2;
}
main().catch(()=>{
 console.error("M32 actual TLS source reconciliation BLOCKED. No data was migrated.");
 process.exitCode=2;
});
