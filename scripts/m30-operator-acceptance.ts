/** Run M30 real-source acceptance once from an authorized operator host.
 * Without credentials/references it produces a precise BLOCKED/NO_GO report.
 * Never generates data, secrets, users, signatures, or executes an on-chain tx.
 */
import {Pool,type PoolClient} from "pg";
import {createHash} from "node:crypto";
import {constants} from "node:fs";
import {open,mkdir,writeFile} from "node:fs/promises";
import {isAddress,getAddress} from "viem";
import {m30AcceptanceReport,m30ConfigPreflight,type M30Observation,
 M30_EXPECTED_PRODUCTION,M30_PROJECT_ID} from "../src/lib/beta/m30-operator-readiness";
import {validateFullRestorePair} from "../src/lib/beta/m24-full-restore";
import {digestM27Database,compareM27Databases,reconcileEntirePointsLedger} from "../src/lib/beta/m27-evidence";
import {inspectProviderRows,type ApprovedMediaRow} from "../src/lib/beta/m28-real-evidence";
import {verifyConsumedWalletPair,m29WalletPacket} from "../src/lib/beta/m29-wallet-crosscheck";
import {verifyM29Packet,m29Manifest} from "../src/lib/beta/m29-evidence-packet";
import {inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";
import {positiveId,validateNativeAccount,ULTRA_NATIVE_TESTNET} from "../src/lib/ultra-native";

const arg=(key:string)=>{const i=process.argv.indexOf("--"+key);return i>=0?process.argv[i+1]:undefined;};
async function actualJsonFile(path:string,max=200000):Promise<unknown>{
 const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await file.stat();
  if(!stat.isFile()||stat.size<2||stat.size>max)throw Error("Invalid regular input evidence file.");
  const bytes=await file.readFile();
  if(bytes.length!==stat.size)throw Error("Changed evidence file.");
  return JSON.parse(bytes.toString("utf8")) as unknown;
 }finally{await file.close();}
}
async function actualDigestFile(path:string){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size<1||stat.size>50_000_000)throw Error("Invalid original audit file.");
  const bytes=await handle.readFile();
  if(bytes.length!==stat.size)throw Error("Audit file was modified during inspection.");
  return createHash("sha256").update(bytes).digest("hex");
 }finally{await handle.close();}
}
async function checkedTLS(c:PoolClient){
 const status=await c.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
 if(!status.rows[0]?.ssl)throw Error("Real TLS PostgreSQL connection required.");
}
function openedPool(url:string){
 return new Pool({connectionString:url,max:1,connectionTimeoutMillis:8000,statement_timeout:60000});
}
async function main(){
 const live=process.argv.includes("--live");
 const config=m30ConfigPreflight(process.env);
 const observed:M30Observation={};
 const set=(id:keyof M30Observation,ok:boolean,reason:string)=>{observed[id]={
  observed:true,sourceVerified:ok,reason,
 };};
 // Configuration-only mode cannot be mistaken for source verification.
 if(live){
  let pool:Pool|null=null;
  try{
   if(config.canQueryExistingPostgreSQL){
    pool=openedPool(process.env.DATABASE_URL!);
    const c=await pool.connect();
    try{
     await checkedTLS(c);
     try{
      const points=await reconcileEntirePointsLedger(c,{batchSize:100,maxRows:20000});
      set("points_anti_sybil",points.complete&&points.issues.length===0,
       "Complete original approved Points source scan; independent human anti-sybil analysis remains necessary.");
     }catch{set("points_anti_sybil",false,"Actual source ledger drift, cap, or query failure.");}
     const walletFile=arg("wallet-packet");
     if(walletFile){
      try{
       const packet=m29WalletPacket.parse(await actualJsonFile(walletFile));
       const expected=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA;
       if(packet.commit!==expected||packet.origin!==process.env.LOOKE_M23_PREVIEW_ORIGIN)
        throw Error("Original packet is for a different Preview.");
       await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
       try{await verifyConsumedWalletPair(c,packet);await c.query("COMMIT");
        set("wallet_sessions",true,"Two original consumed nonces and four EIP-191 keys verified; observer attendance NOT verified.");
       }catch(e){await c.query("ROLLBACK");throw e;}
      }catch{set("wallet_sessions",false,"Original one-use challenges, signed observers or exact immutable Preview did not verify.");}
     }
     if(config.canAttemptRealProviderInspection){
      try{
       const r=await c.query<ApprovedMediaRow>(`
        SELECT p.id::text AS post_id,u.owner,u.public_id,u.kind,u.mime,u.declared_bytes,
          p.media_url,
          (SELECT count(*)::integer FROM social_moderation_audit a
            WHERE a.target_id=p.id::text AND a.action='approve_media') AS moderation_count
        FROM social_media_uploads u JOIN social_posts p
          ON p.id=u.post_id AND p.author=u.owner
        WHERE u.state='attached' AND p.media_status='approved'
         AND p.hidden=false AND p.deleted_at IS NULL AND u.verified_url=p.media_url
        ORDER BY u.attached_at DESC,u.id DESC LIMIT 3`);
       const check=await inspectProviderRows(r.rows);
       set("hosted_media",check.status==="verified"&&check.verified>0,
        "Actual authenticated Cloudinary metadata matched moderated database records; human content safety is not established.");
      }catch{set("hosted_media",false,"Missing actual approved upload, moderator review or valid authenticated provider response.");}
     }
     const auditFile=arg("audit-file"),id=arg("audit-evidence-id");
     if(auditFile&&id&&/^[0-9a-f-]{36}$/i.test(id)&&config.exactImmutablePreviewIdentityConfigured){
      try{
       const result=await c.query<{evidence_sha256:string}>(`
        SELECT evidence_sha256 FROM social_beta_evidence_signatures
        WHERE id=$1 AND preview_sha=$2 AND kind='security'`,[id,process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA]);
       if(result.rowCount!==1)throw Error("Original exact-commit signed security record missing.");
       const actual=await actualDigestFile(auditFile);
       if(actual!==result.rows[0].evidence_sha256)throw Error("Actual original audit file digest drift.");
       // Security audit requires an additional full eight-source reference manifest.
       const manifestFile=arg("manifest"),directory=arg("evidence-directory");
       if(!manifestFile||!directory)throw Error("Original full signed manifest missing.");
       const manifest=m29Manifest.parse(await actualJsonFile(manifestFile));
       if(manifest.commit!==(process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA)||
          manifest.origin!==process.env.LOOKE_M23_PREVIEW_ORIGIN)
        throw Error("Original evidence manifest belongs to a different Preview.");
       await verifyM29Packet(manifest,directory);
       set("security_audit",true,"Original security-audit bytes match a genuine M23 reference and all eight signed report hashes; findings/remediation NOT independently approved.");
      }catch{set("security_audit",false,"Actual original security report, signed M23 reference, eight files or two reviewer keys did not validate.");}
     }
    }finally{c.release();}
   }
  }catch{
   set("wallet_sessions",false,"Actual authenticated TLS PostgreSQL source unavailable.");
   set("points_anti_sybil",false,"Actual authenticated TLS PostgreSQL source unavailable.");
   set("hosted_media",false,"Actual authenticated TLS PostgreSQL and provider source unavailable.");
  }finally{await pool?.end();}
  const source=process.env.DATABASE_URL,restored=process.env.LOOKE_M27_RESTORE_DATABASE_URL;
  if(source&&restored){
   try{
    validateFullRestorePair(source,restored);
    const a=openedPool(source),b=openedPool(restored);
    try{
     const scan=async(p:Pool)=>{
      const c=await p.connect();try{return await digestM27Database(c,true);}finally{c.release();}
     };
     const [x,y]=await Promise.all([scan(a),scan(b)]);
     const diff=compareM27Databases(x,y);
     set("postgres_restore19",diff.comparison==="MATCHED_FULL_ROWS",
      "Full real 19-table row/schema digests compared across separate TLS endpoints; backup provenance and human recovery witness unverified.");
    }finally{await Promise.allSettled([a.end(),b.end()]);}
   }catch{set("postgres_restore19",false,"Real distinct TLS restoration, complete rows or schema integrity could not be verified.");}
  }
  const factory=arg("token-factory"),tx=arg("coin-tx");
  if(factory||tx){
   try{
    if(!factory||!isAddress(factory)||!tx||!/^0x[0-9a-f]{64}$/i.test(tx)||/^0x0{64}$/i.test(tx))
     throw Error("Actual factory and canonical receipt required.");
    const proof=await inspectEvmCoin(getAddress(factory),tx);
    if(proof.chainId!==18881||proof.confirmations<2||proof.txHash.toLowerCase()!==tx.toLowerCase())
     throw Error("Actual finalized receipt not confirmed.");
    set("creator_coin",true,"Real EVM Testnet receipt/factory/deployed coin independently read.");
   }catch{set("creator_coin",false,"Canonical Ultra EVM receipt or real live contract state not independently confirmed.");}
  }
  if(arg("uniq-factory-id")||arg("uniq-token-id")||arg("uniq-owner")){
   try{
    const factoryId=positiveId(arg("uniq-factory-id")||"");
    const tokenId=positiveId(arg("uniq-token-id")||"");
    const owner=validateNativeAccount(arg("uniq-owner")||"");
    const proof=await inspectNativeUniq(factoryId,owner,tokenId);
    if(proof.chainId!==ULTRA_NATIVE_TESTNET.chainId||proof.irreversibleBlock<1||
       proof.factoryId!==factoryId||proof.tokenId!==tokenId||proof.owner!==owner)
      throw Error("Missing real native proof.");
    set("native_uniq",true,"Real native irreversible Uniq owner, factory and ID verified.");
   }catch{set("native_uniq",false,"Canonical irreversible Ultra native ownership not confirmed.");}
  }
  if(process.env.VERCEL_TOKEN){
   try{
    const endpoint="https://api.vercel.com/v4/aliases/looke-alpha.vercel.app?projectId="+M30_PROJECT_ID;
    const r=await fetch(endpoint,{method:"GET",headers:{
     authorization:"Bearer "+process.env.VERCEL_TOKEN,accept:"application/json"},
     redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error("Cannot retrieve live alias");
    const info=await r.json() as {alias?:{deploymentId?:string};deploymentId?:string};
    const actual=info.alias?.deploymentId??info.deploymentId;
    set("incident_rollback",actual===M30_EXPECTED_PRODUCTION,
     "Actual Vercel production alias checked with authenticated GET; this is NOT a performed or witnessed rollback.");
   }catch{set("incident_rollback",false,"Production pin cannot be independently confirmed with live Vercel read-only API.");}
  }
 }
 const report={...m30AcceptanceReport(process.env,observed),
  checkedAt:new Date().toISOString(),
  executedLiveSourceInspection:live,
  externalOperatorHumanWitnessesEstablished:false,
  realIncidentRollbackExecuted:false,
  actualBackupCreatedOrRestoredByThisTool:false,
  originalSecurityAuditRemediationIndependentlyApproved:false,
  actualFinanceOrUserWritesPerformed:false,
 };
 await mkdir("artifacts/m30",{recursive:true});
 await writeFile("artifacts/m30/operator-acceptance.json",JSON.stringify(report,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({
  milestone:"M30",live,technicallyVerified:report.technicallyVerifiedCount,
  missingEnvironmentKeys:report.configuration.missingEnvironmentKeys,
  blocked:report.steps.filter(x=>x.status!=="read_only_technical_source_verified").map(x=>x.id),
  release:report.releaseDecision,transactionsSent:0},null,2));
 // Hard error when --live is requested without required source.
 if(live&&(!config.canQueryExistingPostgreSQL||!config.releaseFlagsClosed))process.exitCode=2;
}
main().catch(()=>{console.error("M30 operator preflight BLOCKED: real source or evidence inspection unavailable.");process.exitCode=2;});
