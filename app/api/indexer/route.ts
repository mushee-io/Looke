import {NextRequest,NextResponse} from "next/server";
import {requestedStream,syncConfirmedStream,IndexingHalt} from "@/lib/server/market-indexer";

export const dynamic="force-dynamic";
/**
 * Protected operator/cron route. Each call ingests at most 250 blocks of one
 * confirmed Ultra EVM event stream; no wallet keys or trading actions.
 * POST /api/indexer?stream=coins
 * POST /api/indexer?stream=swaps&pool=<server-allowlisted-pool-address>
 */
export async function POST(request:NextRequest) {
 const secret=process.env.LOOKE_INDEXER_SECRET;
 if(!secret||secret.length<24||request.headers.get("authorization")!=="Bearer "+secret)
  return NextResponse.json({error:"Unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 try{
  const stream=request.nextUrl.searchParams.get("stream")??"coins";
  const requested=request.nextUrl.searchParams.get("pool");
  const result=await syncConfirmedStream(requestedStream(stream,requested));
  return NextResponse.json({...result,network:"Ultra EVM Testnet",chainId:18881,
    finalityDepth:12,tradeEnabled:false},
    {headers:{"Cache-Control":"no-store"}});
 }catch(error) {
  const message=error instanceof IndexingHalt?error.message:
    "Market ingestion failed without advancing the failed batch cursor";
  return NextResponse.json({error:message,tradeEnabled:false},
    {status:error instanceof IndexingHalt?error.status:503,headers:{"Cache-Control":"no-store"}});
 }
}
