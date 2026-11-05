/** Full read-only account eligibility reconciliation; no Points ledger mutations. */
import {Pool} from "pg";
import {mkdir,writeFile} from "node:fs/promises";
import {reconcileEntirePointsLedger} from "../src/lib/beta/m27-evidence";
async function main(){
 if(!process.env.DATABASE_URL)throw Error("A real operator-owned DATABASE_URL is required.");
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,
  connectionTimeoutMillis:8000,statement_timeout:60000});
 try{
  const c=await pool.connect();
  let checked;
  try{checked=await reconcileEntirePointsLedger(c,{batchSize:100,maxRows:20000});}
  finally{c.release();}
  const output={milestone:"M27",checkedAt:new Date().toISOString(),report:checked,
   independentAntiSybilHumanApproval:false,pointsIssued:0,
   tokenClaimsEnabled:false,publicBetaOpen:false};
  await mkdir("artifacts/m27",{recursive:true});
  await writeFile("artifacts/m27/points-source-audit.json",JSON.stringify(output,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({milestone:"M27",scanned:checked.scanned,
   total:checked.totalApproved,status:checked.status,drift:checked.issues.length,
   complete:checked.complete,humanSybilApproval:false,publicBetaOpen:false}));
  if(checked.issues.length||!checked.complete)process.exitCode=2;
 }finally{await pool.end();}
}
main().catch(e=>{console.error("M27 full Points source audit BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
