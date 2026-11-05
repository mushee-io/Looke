/** Independently verify the original two M23 atomic nonce consumptions,
 * original wallet signatures and fresh observer acknowledgements against REAL SQL.
 * Never signs transactions, creates users, re-consumes challenges or approves beta.
 */
import {createHash} from "node:crypto";
import {constants} from "node:fs";
import {open,mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {verifyConsumedWalletPair} from "../src/lib/beta/m29-wallet-crosscheck";
async function main(){
 const pos=process.argv.indexOf("--file"),file=pos<0?null:process.argv[pos+1];
 if(!file||!process.env.DATABASE_URL)throw Error("Actual --file JSON and authorized DATABASE_URL are mandatory.");
 const f=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 let bytes:Buffer;
 try{
  const st=await f.stat();if(!st.isFile()||st.size<1||st.size>100000)throw Error("Small real non-symlink proof packet required.");
  bytes=await f.readFile();if(bytes.length!==st.size)throw Error("Packet was modified while reading.");
 }finally{await f.close();}
 const packet=JSON.parse(bytes.toString("utf8")) as unknown;
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:8000,statement_timeout:12000});
 try{
  const c=await pool.connect();
  let verified;
  try{
   await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   try{verified=await verifyConsumedWalletPair(c,packet);await c.query("COMMIT");}
   catch(e){await c.query("ROLLBACK");throw e;}
  }finally{c.release();}
  const report={...verified,actualPacketSha256:createHash("sha256").update(bytes).digest("hex"),
   independentlyAttendedByTwoDistinctHumans:false,goLive:"NO_GO",createdAt:new Date().toISOString()};
  await mkdir("artifacts/m29",{recursive:true});
  await writeFile("artifacts/m29/consumed-wallet-witness.json",JSON.stringify(report,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({originalNonceConsumptionVerified:true,
   twoWalletKeys:verified.walletKeysVerified,twoObserverKeys:verified.observerKeysVerified,
   humanPresenceConfirmed:false,release:"NO_GO"}));
 }finally{await pool.end();}
}
main().catch(e=>{console.error("M29 source-backed wallet witness BLOCKED:",e instanceof Error?e.message:"unknown");process.exitCode=2;});
