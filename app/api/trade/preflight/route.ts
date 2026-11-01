import {NextRequest,NextResponse} from "next/server";
import {readPoolQuote,readWalletPreflight,TradeReadError} from "@/lib/server/trade-pool";
import {isAddress} from "viem";
import {isQuoteFresh,tradePreflightReadiness} from "@/lib/market/trade-guard.mjs";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
 const q=request.nextUrl.searchParams;
 const pool=q.get("pool")??"",tokenIn=q.get("tokenIn")??"";
 const amountIn=q.get("amountIn")??"",slippageBps=q.get("slippageBps")??"50";
 const wallet=q.get("wallet")??"";
 if(wallet&&!isAddress(wallet))
  return NextResponse.json({error:"Invalid wallet address"},{status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const quote=await readPoolQuote({pool,tokenIn,amountIn,slippageBps});
  const walletData=wallet
    ?await readWalletPreflight(wallet,tokenIn,quote.observedBlock,amountIn):null;
  const preflight=tradePreflightReadiness({
   chainMatches:quote.chainId===18881,poolAllowlisted:true,codePresent:true,
   reservesPositive:true,quoteFresh:isQuoteFresh(quote.expiresAt),
   impactBps:quote.priceImpactBps,
   walletBalanceEnough:walletData?.tokenBalanceEnough??false,
   hasRouterAudit:false,
  });
  // Never return transaction calldata or a spender approval instruction.
  return NextResponse.json({
   quote,wallet:walletData,preflight,
   blockers:[
    "No audited/verified Ultra EVM testnet router or execution contract configured.",
    "Real swap gas, ERC-20 allowance, MEV protection and revert simulation not verified.",
    ...(!wallet?["Connect or enter a testnet wallet to inspect its public balances."]:[]),
    ...(quote.highImpact?["High pool price impact; order needs risk review."]:[]),
    ...(walletData&&!walletData.tokenBalanceEnough?["Insufficient input-token balance at the observed block."]:[]),
   ],
   executionEnabled:false,
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(e){
  return NextResponse.json({error:e instanceof TradeReadError?e.message:"Ultra testnet preflight unavailable"},
   {status:e instanceof TradeReadError?e.status:503,headers:{"Cache-Control":"no-store"}});
 }
}
