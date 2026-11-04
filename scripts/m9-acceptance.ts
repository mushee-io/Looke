/**
 * One-shot read-only M9 operator acceptance packet.
 * Does not assume wallet proof, security signoff or staging deployment.
 * Does not create a DB, post a GitHub issue, trade, sign, mint or deploy.
 */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {Pool} from "pg";
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";
import {probeUltraLiquidity} from "../src/lib/ops/m9-liquidity";
import {inspectSocialDatabase} from "../src/lib/ops/m8-db-audit";
import {parseProofManifest} from "../src/lib/ops/acceptance";
import {inspectEvmFactory,inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";
import {createAcceptancePacket} from "../src/lib/ops/m9-acceptance";
import {rehearseRollback} from "../src/lib/ops/m8-rollback";

async function verifiedReceipts(path?:string){
  const state={factory:false,coin:false,uniq:false};
  if(!path)return state;
  const manifest=parseProofManifest(JSON.parse(await readFile(path,"utf8")) as unknown);
  try{
    const receipt=await inspectEvmFactory(manifest.evmFactory.address,manifest.evmFactory.deploymentTx);
    state.factory=receipt.confirmations>=2;
  }catch{/* No successful receipt means blocked. */}
  try{
    const coin=await inspectEvmCoin(manifest.evmFactory.address,manifest.creatorCoin.creationTx);
    state.coin=coin.confirmations>=2&&BigInt(coin.totalSupply)>0n;
  }catch{/* No verified creator coin means blocked. */}
  try{
    const uniq=await inspectNativeUniq(manifest.nativeUniq.factoryId,
      manifest.nativeUniq.owner,manifest.nativeUniq.tokenId);
    state.uniq=uniq.irreversibleBlock>0;
  }catch{/* No verified Uniq means blocked. */}
  return state;
}
async function auditedDb(){
  const url=process.env.DATABASE_URL;
  if(!url)return null;
  const pool=new Pool({connectionString:url,max:1,connectionTimeoutMillis:7000});
  try{
    const client=await pool.connect();
    try{return await inspectSocialDatabase(client,false);}
    finally{client.release();}
  }catch{return null;}
  finally{await pool.end();}
}
async function main(){
  // Only supplied public identifiers; a missing manifest is never replaced with fake receipt data.
  const path=process.argv.find(x=>x.endsWith(".json")&&!x.includes("artifacts/"));
  const [rpc,liquidity,db,proofs]=await Promise.all([
    collectLiveRpcEvidence(),probeUltraLiquidity(),auditedDb(),verifiedReceipts(path),
  ]);
  const rollback=rehearseRollback();
  const packet=createAcceptancePacket({
    rpc,liquidity,db,
    stagingProtectionVerified:false, // No independent signed-out browser check in this CLI.
    factoryReceiptVerified:proofs.factory,coinReceiptVerified:proofs.coin,
    uniqOwnershipVerified:proofs.uniq,
    walletWitnessVerified:false,securityApproved:false,operatorApproved:false,
    rollbackDrillPassed:rollback.restoredFlagsSafe,
    flags:process.env,
  });
  await mkdir(resolve("artifacts/m9"),{recursive:true});
  await writeFile(resolve("artifacts/m9/acceptance-report.json"),
    JSON.stringify({packet,liveRpc:rpc,liquidity,db,proofs},null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify(packet,null,2));
  console.log("No token transactions, wallet signatures, private keys, deployment or beta activation.");
  if(packet.status==="blocked")console.log("::warning::M9 operational acceptance BLOCKED. Inspect artifacts/m9/acceptance-report.json.");
  if(process.argv.includes("--strict")&&packet.status==="blocked")process.exitCode=2;
}
main().catch(error=>{
 console.error("M9 acceptance BLOCKED:",error instanceof Error?error.message:"Unavailable");
 process.exitCode=2;
});
