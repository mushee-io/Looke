import {NextRequest,NextResponse} from "next/server";
import {readPoolQuote,TradeReadError} from "@/lib/server/trade-pool";

export const dynamic="force-dynamic";
/**
 * Read-only constant-product estimate from a configured Ultra EVM testnet pool.
 * Never creates calldata, approvals, swap payloads or transaction receipts.
 */
export async function GET(request:NextRequest) {
 const q=request.nextUrl.searchParams;
 try{
  const quote=await readPoolQuote({
    pool:q.get("pool")??"",tokenIn:q.get("tokenIn")??"",
    amountIn:q.get("amountIn")??"",slippageBps:q.get("slippageBps")??"50"
  });
  return NextResponse.json(quote,{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  return NextResponse.json({
    error:e instanceof TradeReadError?e.message:"Read-only pool quote unavailable",
    tradeEnabled:false,
  },{status:e instanceof TradeReadError?e.status:503,headers:{"Cache-Control":"no-store"}});
 }
}
