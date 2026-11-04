import {NextRequest,NextResponse} from "next/server";
import {activeMarkets,recentSwaps} from "../../../lib/trading-server";
import {indexCreatorLaunches} from "../../../lib/ops/m13-index";
import {metricsForVerifiedMarket} from "../../../lib/ops/m13-metrics";
import {parseMarketQuery,rankVerifiedMarkets} from "../../../lib/ops/m13-discovery";
import type {DiscoverFeed,DiscoverMarket} from "../../../lib/discover";

export const runtime="nodejs";
export const dynamic="force-dynamic";

/**
 * Genuine Ultra EVM Testnet discovery. Query semantics are explicitly
 * bounded: verified allowlisted AMM pairs + last indexed factory block page.
 * Every output metric is null when its on-chain proof is incomplete.
 */
export async function GET(request:NextRequest){
  let options:ReturnType<typeof parseMarketQuery>;
  try{options=parseMarketQuery(request.nextUrl.searchParams);}
  catch{return NextResponse.json({error:"Invalid discovery sorting, filter or pagination."},{status:400});}
  try{
    const [result,index]=await Promise.all([activeMarkets(),indexCreatorLaunches()]);
    const origins=new Map(index.launches.map(l=>[l.token.toLowerCase(),l]));
    const rows:DiscoverMarket[]=await Promise.all(result.markets.map(async m=>{
      let observedQuoteVolume:string|null=null,observedSwapCount:number|null=null,
        partial=true,activityError:string|null=null;
      try{
        const scan=await recentSwaps(m.id,900);
        observedQuoteVolume=scan.observedQuoteVolume;
        observedSwapCount=scan.observedSwapCount;
        partial=scan.partial;
      }catch{
        activityError="Recent actual swap logs unavailable. No trading volume is claimed.";
      }
      const metrics=await metricsForVerifiedMarket(m,origins.get(m.baseToken.toLowerCase())??null);
      return {
        id:m.id,baseSymbol:m.baseSymbol,quoteSymbol:m.quoteSymbol,
        baseToken:m.baseToken,quoteToken:m.quoteToken,pair:m.pair,
        poolPrice:m.poolPrice,reserveBase:m.reserveBase,reserveQuote:m.reserveQuote,
        observedQuoteVolume,observedSwapCount,partial,activityError,
        ...metrics,
      };
    }));
    const selection=rankVerifiedMarkets(rows,options);
    const feed:DiscoverFeed={
      chainId:18881,network:"Ultra EVM Testnet",source:"verified-on-chain",
      asOf:new Date().toISOString(),markets:selection.rows,errors:result.errors,
      executionEnabled:result.executionEnabled,
      volumeWindow:"bounded-recent-blocks-not-24h",
      pagination:{total:selection.total,page:selection.page,limit:selection.limit,hasMore:selection.hasMore},
      indexer:{status:index.status,complete:index.complete,nextCursor:index.nextCursor,
        fromBlock:index.fromBlock,throughBlock:index.throughBlock,
        verifiedLaunchesInPage:index.launches.length,errors:index.errors},
    };
    return NextResponse.json(feed,{headers:{"cache-control":"no-store"}});
  }catch{
    return NextResponse.json({
      error:"Verified Ultra Testnet markets or RPC unavailable. No sample tokens or statistics substituted.",
    },{status:503,headers:{"cache-control":"no-store"}});
  }
}
