/** M33: source-backed Testnet proof input and release guards.
 * No operator signature, wallet transaction or financial execution.
 */
import {validEvmAddress,validHash} from "./policy";
import {positiveId,validateNativeAccount,ULTRA_NATIVE_TESTNET} from "../ultra-native";
import {m30ReleaseFlagsClosed} from "./m30-operator-readiness";

export type M33ProofInput=
 | {kind:"factory"|"coin";address:string;tx:string}
 | {kind:"uniq";factoryId:string;tokenId:string;owner:string};
export class M33InvalidInput extends Error{}
export function parseM33ProofInput(params:URLSearchParams):M33ProofInput{
 const allowed=new Set(["mode","kind","address","tx","factoryId","tokenId","owner"]);
 if([...params.keys()].some(k=>!allowed.has(k))||params.toString().length>500)
  throw new M33InvalidInput("Unsupported or oversized proof request.");
 for(const key of allowed)if(params.getAll(key).length>1)
  throw new M33InvalidInput("Duplicate proof inputs are not accepted.");
 const kind=params.get("kind");
 if(kind==="factory"||kind==="coin"){
  const address=params.get("address")||"",tx=params.get("tx")||"";
  if(params.has("owner")||params.has("factoryId")||params.has("tokenId")||
   !validEvmAddress(address)||!validHash(tx)||/^0x0{64}$/i.test(tx))
   throw new M33InvalidInput("Valid nonzero Ultra EVM factory address and transaction hash required.");
  return {kind,address,tx};
 }
 if(kind==="uniq"){
  if(params.has("address")||params.has("tx"))
   throw new M33InvalidInput("Native Uniq verification cannot accept EVM transaction inputs.");
  try{
   return {kind,factoryId:positiveId(params.get("factoryId")||""),
    tokenId:positiveId(params.get("tokenId")||""),
    owner:validateNativeAccount(params.get("owner")||"")};
  }catch{throw new M33InvalidInput("Valid Ultra native owner, factory and token IDs required.");}
 }
 throw new M33InvalidInput("Choose factory, coin or uniq verification.");
}
export function m33Configuration(env:Record<string,string|undefined>){
 const flagsClosed=m30ReleaseFlagsClosed(env);
 return {milestone:"M33" as const,readOnly:true as const,
  releaseDecision:"NO_GO" as const,publicBetaOpen:false as const,
  socialWritesAllowed:false as const,mediaWritesAllowed:false as const,
  financialBroadcastAllowed:false as const,tokenClaimsAllowed:false as const,
  privateMessagingAllowed:false as const,transactionsSent:0 as const,
  flagsClosed,postgresConfigured:Boolean(env.DATABASE_URL),
  cloudinaryConfigured:Boolean(env.LOOKE_CLOUDINARY_CLOUD_NAME&&
   env.LOOKE_CLOUDINARY_API_KEY&&env.LOOKE_CLOUDINARY_API_SECRET),
  walletSignatureRequested:false as const,liveRPCVerifiedByConfig:false as const,
  actualMediaAssetVerifiedByConfig:false as const,
  humanReleaseApproved:false as const};
}
export type M33ProofOutput={
 kind:M33ProofInput["kind"];verified:true;network:string;
 source:"canonical-ultra-testnet";
 reference:string;blockOrConfirmations:number;
 details:Record<string,string|number>;transactionsSent:0;
 releaseDecision:"NO_GO";publicBetaOpen:false;
};
export function m33ProofResult(input:M33ProofInput,proof:Record<string,unknown>):M33ProofOutput{
 if(input.kind==="uniq"){
  const irreversible=proof.irreversibleBlock;
  if(!Number.isSafeInteger(irreversible)||Number(irreversible)<1||
   proof.owner!==input.owner||proof.factoryId!==input.factoryId||
   proof.tokenId!==input.tokenId||proof.chainId!==ULTRA_NATIVE_TESTNET.chainId)
   throw Error("Independent native Uniq evidence mismatch.");
  return {kind:"uniq",verified:true,network:"Ultra native Testnet",
   source:"canonical-ultra-testnet",reference:input.tokenId,
   blockOrConfirmations:irreversible as number,
   details:{owner:input.owner,factoryId:input.factoryId,tokenId:input.tokenId},
   transactionsSent:0,releaseDecision:"NO_GO",publicBetaOpen:false};
 }
 const confirmations=proof.confirmations;
 const address=input.kind==="factory"?proof.address:proof.coin;
 const txHash=input.kind==="factory"?proof.transactionHash:proof.txHash;
 if(proof.chainId!==18881||!Number.isSafeInteger(confirmations)||
    Number(confirmations)<2||typeof address!=="string"||
    !validEvmAddress(address)||txHash!==input.tx||
    (input.kind==="factory"&&address.toLowerCase()!==input.address.toLowerCase())||
    (input.kind==="coin"&&!validEvmAddress(String(proof.creator||""))))
  throw Error("Canonical EVM receipt and Testnet confirmations do not match.");
 return {kind:input.kind,verified:true,network:"Ultra EVM Testnet 18881",
  source:"canonical-ultra-testnet",reference:address,
  blockOrConfirmations:confirmations as number,
  details:input.kind==="coin"?
   {coin:address,creator:String(proof.creator||""),factory:input.address,txHash:input.tx}:
   {factory:address,txHash:input.tx,coinCount:String(proof.coinCount||"0")},
  transactionsSent:0,releaseDecision:"NO_GO",publicBetaOpen:false};
}

/** Current source: real TLS PostgreSQL, bounded metadata, consistent READ ONLY snapshot.
 * A compatible schema does not establish user records or any acceptance signature.
 */
export async function inspectM33CurrentSource(db:Pick<import("pg").PoolClient,"query">,enforceTLS=true){
 if(enforceTLS){
  const ssl=await db.query<{ssl:boolean}>("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()");
  if(ssl.rows[0]?.ssl!==true)throw Error("Actual TLS PostgreSQL source required.");
 }
 await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 try{
  const mode=await db.query<{transaction_read_only:string}>("SHOW transaction_read_only");
  if(mode.rows[0]?.transaction_read_only!=="on")throw Error("Read-only PostgreSQL transaction not active.");
  const inspected=await (await import("./m31-source-compatibility")).inspectM31Schema(db,false);
  await db.query("COMMIT");
  return {schemaCompatible:inspected.schemaCompatible,
   actualCurrentTables:inspected.actualCurrentTables,
   missingTables:inspected.missingTables,missingColumns:inspected.missingColumns,
   releaseDecision:"NO_GO" as const,verifiedUserRecords:false as const,
   recordsModified:0 as const};
 }catch(e){await db.query("ROLLBACK");throw e;}
}
