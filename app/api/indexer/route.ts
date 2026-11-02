import {NextRequest,NextResponse} from "next/server";
import {requestedStream,syncConfirmedStream,IndexingHalt} from "@/lib/server/market-indexer";
import {operatorAuthorized,recordIndexerHeartbeat} from "@/lib/server/indexer-operations";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
/**
 * Protected bounded operator/cron ingestion of ONE Ultra testnet stream.
 * A status/heartbeat update never rewrites the M13 canonical event cursor.
 */
export async function POST(request:NextRequest){
 if(!operatorAuthorized(request,"LOOKE_INDEXER_SECRET"))
  return NextResponse.json({error:"Unauthorized"},{status:401,headers:HEADERS});
 let stream:ReturnType<typeof requestedStream>;
 try{
  const kind=request.nextUrl.searchParams.get("stream")??"coins";
  stream=requestedStream(kind,request.nextUrl.searchParams.get("pool"));
 }catch(error){
  return NextResponse.json({error:error instanceof IndexingHalt?error.message:"Invalid indexer stream",
   tradeEnabled:false},{status:error instanceof IndexingHalt?error.status:400,headers:HEADERS});
 }
 try{
  const result=await syncConfirmedStream(stream);
  try{
   await recordIndexerHeartbeat({key:stream.key,status:result.status,
    indexed:typeof result.indexed==="number"?result.indexed:0,
    confirmedThrough:result.confirmedThrough});
  }catch{
   return NextResponse.json({
    error:"Event ingestion may have advanced but the M20 heartbeat database was unavailable; check the canonical cursor before retrying",
    telemetryRecorded:false,tradeEnabled:false
   },{status:503,headers:HEADERS});
  }
  return NextResponse.json({...result,network:"Ultra EVM Testnet",chainId:18881,
    finalityDepth:12,telemetryRecorded:true,tradeEnabled:false},{headers:HEADERS});
 }catch(error){
  try{await recordIndexerHeartbeat({
   key:stream.key,status:"failed",error
  });}catch{/* Keep the original ingestion failure; no false success */}
  return NextResponse.json({
   error:error instanceof IndexingHalt?error.message:
     "Market ingestion failed without advancing the failed batch cursor",
   tradeEnabled:false
  },{status:error instanceof IndexingHalt?error.status:503,headers:HEADERS});
 }
}
