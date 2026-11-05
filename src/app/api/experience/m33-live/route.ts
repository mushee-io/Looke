/** M33 protected Preview-only genuinely source-backed Ultra Testnet and
 * current social PostgreSQL checks. Never creates evidence or signs a wallet.
 */
import {NextRequest,NextResponse} from "next/server";
import {Pool} from "pg";
import {createUltraPublicClient,assertUltraTestnet} from "../../../../lib/verification";
import {ULTRA_EVM_TESTNET} from "../../../../lib/ultra";
import {getNativeTestnetInfo} from "../../../../lib/ultra-native-rpc";

import {inspectEvmCoin,inspectEvmFactory,inspectNativeUniq} from "../../../../lib/beta/acceptance";
import {uploadConfig} from "../../../../lib/social/upload-provider";
import {M33InvalidInput,m33Configuration,m33ProofResult,parseM33ProofInput,inspectM33CurrentSource,inspectM33HostedMedia} from "../../../../lib/beta/m33-live-integration";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=25;
const headers={"cache-control":"private, no-store","x-robots-tag":"noindex"};
const answer=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
const unavailable=(source:string)=>({source,status:"unavailable" as const,verified:false});
async function evmStatus(){
 try{
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  await assertUltraTestnet(client);
  const block=await client.getBlockNumber();
  if(block<1n)throw Error("Missing chain head.");
  return {source:"ultra_evm",status:"verified" as const,verified:true,chainId:18881,latestBlock:block.toString()};
 }catch{return unavailable("ultra_evm");}
}
async function nativeStatus(){
 try{
  const x=await getNativeTestnetInfo();
  if(x.last_irreversible_block_num<1||x.last_irreversible_block_num>x.head_block_num)
   throw Error("Native irreversible block not valid.");
  return {source:"ultra_native",status:"verified" as const,verified:true,
   irreversibleBlock:x.last_irreversible_block_num,headBlock:x.head_block_num};
 }catch{return unavailable("ultra_native");}
}
async function postgresStatus(){
 if(!process.env.DATABASE_URL)
  return {source:"postgres",status:"not_configured" as const,verified:false,currentTables:0,requiredTables:19};
 const p=new Pool({connectionString:process.env.DATABASE_URL,max:1,
  connectionTimeoutMillis:5000,statement_timeout:7000});
 try{
  const c=await p.connect();
  try{
   const x=await inspectM33CurrentSource(c,true);
   return {source:"postgres",status:x.schemaCompatible?"schema_verified_only" as const:
    "incompatible" as const,verified:x.schemaCompatible,
    currentTables:x.actualCurrentTables,requiredTables:19,
    hasVerifiedUserRecords:false,humanAcceptanceVerified:false};
  }finally{c.release();}
 }catch{return {source:"postgres",status:"unavailable" as const,verified:false,currentTables:0,requiredTables:19};}
 finally{await p.end().catch(()=>{});}
}
async function hostedMediaStatus(){
 let config:ReturnType<typeof uploadConfig>;
 try{config=uploadConfig();}
 catch{return {source:"cloudinary",status:"not_configured",providerVerified:false,
  matchingLookePrefixAssets:null,realModerationVerified:false};}
 try{return await inspectM33HostedMedia(config);}
 catch{return {source:"cloudinary",status:"unavailable",providerVerified:false,
  matchingLookePrefixAssets:null,realModerationVerified:false};}
}
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview")
  return answer({error:"M33 proof console is available only in the SSO-protected Preview."},404);
 const cfg=m33Configuration(process.env);
 if(!cfg.flagsClosed)
  return answer({...cfg,error:"A forbidden release flag is enabled. M33 inspections are blocked."},503);
 const mode=request.nextUrl.searchParams.get("mode")||"config";
 if(mode==="config"){
  if([...request.nextUrl.searchParams.keys()].some(k=>k!=="mode"))
   return answer({error:"Unrecognized configuration query."},400);
  return answer({...cfg,mode,liveRPCChecksPerformed:false,
   postgresQueried:false,cloudinaryAssetsQueried:false,
   note:"Configuration is not a proof. Use live checks and independent exact receipt verification."});
 }
 if(mode==="live"){
  if([...request.nextUrl.searchParams.keys()].some(k=>k!=="mode"))
   return answer({error:"Unexpected live inspection parameters."},400);
  const [evm,native,postgres,hostedMedia]=await Promise.all([evmStatus(),nativeStatus(),postgresStatus(),hostedMediaStatus()]);
  return answer({...cfg,mode,evm,native,postgres,
   hostedMedia,
   liveRPCChecksPerformed:true,cloudinaryAssetsQueried:hostedMedia.providerVerified,
   restoreVerified:false,sourceBackedPointsReconciled:false,
   note:"These are genuine current read-only network/schema checks. A live chain head, correct schema or provider key never establishes a creator coin, moderated media, a real user or independent release authorization."});
 }
 if(mode==="proof"){
  let input:ReturnType<typeof parseM33ProofInput>;
  try{input=parseM33ProofInput(request.nextUrl.searchParams);}
  catch(e){
   return answer({error:e instanceof M33InvalidInput?e.message:"Invalid proof request.",
    verified:false,releaseDecision:"NO_GO",transactionsSent:0},400);
  }
  try{
   let proof:unknown;
   if(input.kind==="uniq"){
    proof=await inspectNativeUniq(input.factoryId,input.owner,input.tokenId);
   }else if(input.kind==="factory"){
    proof=await inspectEvmFactory(input.address,input.tx);
   }else{
    proof=await inspectEvmCoin(input.address,input.tx);
   }
   return answer({...cfg,mode,proof:m33ProofResult(input,proof as unknown as Record<string,unknown>),
    independentHumanApproval:false,sourceRecordsCreated:0});
  }catch{
   return answer({...cfg,mode,proof:{kind:input.kind,verified:false,
    status:"not_verified",transactionsSent:0,releaseDecision:"NO_GO"},
    error:"Canonical Ultra Testnet evidence could not be independently verified; wrong-chain, absent, insufficient confirmations, missing code, owner mismatch or RPC denial are treated as unverified."},422);
  }
 }
 return answer({error:"Allowed M33 modes: config, live, proof."},400);
}
