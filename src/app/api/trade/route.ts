import { NextRequest, NextResponse } from "next/server";
import { activeMarkets, portfolio, quotedTrade, recentSwaps } from "../../../lib/trading-server";
import { validateSlippage } from "../../../lib/trading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const p=request.nextUrl.searchParams;
  const kind=p.get("kind")||"markets";
  const market=p.get("market")||"";
  try{
    let result:unknown;
    switch(kind){
      case "markets":result=await activeMarkets();break;
      case "quote":{
        const direction=p.get("direction");
        if(direction!=="buy"&&direction!=="sell")throw new Error("Direction must be buy or sell.");
        const amount=p.get("amount")||"";
        if(amount.length>64)throw new Error("Amount is too long.");
        const slippage=validateSlippage(Number(p.get("slippageBps")||"50"));
        result=await quotedTrade(market,direction,amount,slippage);
        break;
      }
      case "portfolio":{
        const account=p.get("account")||"";
        result=await portfolio(market,account);
        break;
      }
      case "activity":{
        const interval=Number(p.get("interval")||"900");
        result=await recentSwaps(market,interval);
        break;
      }
      default:return NextResponse.json({error:"Unsupported read-only trade query."},{status:400});
    }
    return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Market RPC request failed.";
    const invalid=/Invalid|must be|Amount |Slippage |not allowlisted|Unsupported|different/.test(message);
    return NextResponse.json({error:message},{status:invalid?400:503,headers:{"cache-control":"no-store"}});
  }
}
