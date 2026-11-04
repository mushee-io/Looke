/**
 * Read-only M10 acceptance packet; the only side effect is writing a local JSON report.
 * A green Actions run is NOT proof that a deployment, funded market or wallet witness exists.
 */
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";
import {collectDualRpcProof} from "../src/lib/ops/m10-crosscheck";
import {probeProtectedStaging} from "../src/lib/ops/m10-protection";
import {probeUltraLiquidity} from "../src/lib/ops/m9-liquidity";
import {inspectSocialDatabase} from "../src/lib/ops/m8-db-audit";
import {parseProofManifest} from "../src/lib/ops/acceptance";
import {inspectEvmFactory,inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";
import {rehearseRollback} from "../src/lib/ops/m8-rollback";
import {createAcceptancePacket} from "../src/lib/ops/m9-acceptance";
import {createM10Review} from "../src/lib/ops/m10-review";

async function inspectReceipts(filename?:string){
  const checked={factory:false,coin:false,uniq:false};
  if(!filename)return checked;
  const manifest=parseProofManifest(JSON.parse(await readFile(filename,"utf8")) as unknown);
  if(manifest.evmFactory.deploymentTx.toLowerCase()===manifest.creatorCoin.creationTx.toLowerCase())
    throw new Error("Factory deployment and coin creation must be different real transactions.");
  try{
    const fact=await inspectEvmFactory(manifest.evmFactory.address,manifest.evmFactory.deploymentTx);
    checked.factory=fact.confirmations>=2;
  }catch{/* no receipt proof */}
  try{
    const coin=await inspectEvmCoin(manifest.evmFactory.address,manifest.creatorCoin.creationTx);
    checked.coin=coin.confirmations>=2&&BigInt(coin.totalSupply)>0n;
  }catch{/* no coin proof */}
  try{
    const uniq=await inspectNativeUniq(manifest.nativeUniq.factoryId,manifest.nativeUniq.owner,manifest.nativeUniq.tokenId);
    checked.uniq=uniq.irreversibleBlock>0;
  }catch{/* no native ownership proof */}
  return checked;
}
async function inspectDb(){
  if(!process.env.DATABASE_URL)return null;
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:7000});
  try{
    const client=await pool.connect();
    try{return await inspectSocialDatabase(client,false);}
    finally{client.release();}
  }catch{return null;}
  finally{await pool.end();}
}
async function main(){
  const publicManifest=process.argv[2] && !process.argv[2].startsWith("--")?
    process.argv[2]:undefined;
  const [singleRpc,dualRpc,staging,liquidity,db,receipts]=await Promise.all([
    collectLiveRpcEvidence(),
    collectDualRpcProof(),
    probeProtectedStaging({
      vercelToken:process.env.VERCEL_TOKEN,
      deploymentUrl:process.env.LOOKE_M10_STAGING_URL,
      expectedRevision:process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M6_DEPLOY_REVISION,
    }),
    probeUltraLiquidity(),inspectDb(),inspectReceipts(publicManifest),
  ]);
  const rollback=rehearseRollback();
  const priorPacket=createAcceptancePacket({
    rpc:singleRpc,liquidity,db,
    stagingProtectionVerified:staging.status==="verified"&&staging.signedOutChallengeVerified,
    factoryReceiptVerified:receipts.factory,
    coinReceiptVerified:receipts.coin,uniqOwnershipVerified:receipts.uniq,
    walletWitnessVerified:false,securityApproved:false,operatorApproved:false,
    rollbackDrillPassed:rollback.restoredFlagsSafe,flags:process.env,
  });
  const review=createM10Review({singleRpc,dualRpc,staging,liquidity,
    socialDatabase:db,priorPacket});
  const artifact={review,singleRpc,dualRpc,staging,liquidity,db,receipts,
    note:"User-originated signatures, independent security acceptance, database backup recovery and hosting rollback need separate real-world review."};
  await mkdir("artifacts/m10",{recursive:true});
  await writeFile("artifacts/m10/acceptance.json",JSON.stringify(artifact,null,2)+"\n",{mode:0o600});
  console.log(JSON.stringify({status:review.status,publicBetaOpen:false,
    verified:review.gates.filter(x=>x.state==="verified").map(x=>x.id),
    blocked:review.blocked,report:"artifacts/m10/acceptance.json"},null,2));
  console.log("::notice::No wallet connected, no signatures generated, no token transactions or deployment, and no public beta activation.");
  if(process.argv.includes("--strict")&&review.blocked.length)process.exitCode=2;
}
main().catch(error=>{console.error("M10 acceptance BLOCKED:",error instanceof Error?error.message:"unknown");process.exitCode=2;});
