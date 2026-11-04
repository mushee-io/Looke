import {NextResponse} from "next/server";
import {activeMarkets,recentSwaps} from "../../../lib/trading-server";
import type {DiscoverFeed,DiscoverMarket} from "../../../lib/discover";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Enumerates only verified, allowlisted markets. Bounded observed swap volume
 * is NEVER presented as 24h volume. No database or transaction writes.
 */
export async function GET(){
  try{
    const result=await activeMarkets();
    const rows:DiscoverMarket[]=await Promise.all(result.markets.map(async m=>{
      let observedQuoteVolume:string|null=null,observedSwapCount:number|null=null,
          partial=true,activityError:string|null=null;
      try{
        const a=await recentSwaps(m.id,900);
        observedQuoteVolume=a.observedQuoteVolume;
        observedSwapCount=a.observedSwapCount;
        partial=a.partial;
      }catch{
        activityError="Recent swap scan unavailable; no volume is claimed.";
      }
      return {
        id:m.id,baseSymbol:m.baseSymbol,quoteSymbol:m.quoteSymbol,
        baseToken:m.baseToken,quoteToken:m.quoteToken,pair:m.pair,
        poolPrice:m.poolPrice,reserveBase:m.reserveBase,reserveQuote:m.reserveQuote,
        observedQuoteVolume,observedSwapCount,partial,activityError,
        marketCap:null,holders:null,change24h:null,createdAt:null,
      };
    }));
    const feed:DiscoverFeed={
      chainId:18881,network:"Ultra EVM Testnet",
      source:"verified-on-chain",asOf:new Date().toISOString(),
      markets:rows,errors:result.errors,executionEnabled:result.executionEnabled,
      volumeWindow:"bounded-recent-blocks-not-24h",
    };
    return NextResponse.json(feed,{headers:{"cache-control":"no-store"}});
  }catch{
    return NextResponse.json(
      {error:"Verified Ultra EVM Testnet market data is unavailable. No sample listings were substituted."},
      {status:503,headers:{"cache-control":"no-store"}},
    );
  }
}
