/**
 * Read-only discovery presentation model. Market entries originate exclusively
 * from verified Ultra EVM Testnet contract reads; no sample coins or statistics.
 */
export type DiscoverSort = "trending"|"top"|"new"|"watchlist";
export type DiscoverMarket = {
  id:string;
  baseSymbol:string;
  quoteSymbol:string;
  baseToken:string;
  quoteToken:string;
  pair:string;
  poolPrice:string;
  reserveBase:string;
  reserveQuote:string;
  observedQuoteVolume:string|null;
  observedSwapCount:number|null;
  partial:boolean;
  activityError:string|null;
  marketCap:string|null;
  holders:number|null;
  change24h:string|null;
  createdAt:string|null;
  statistics?:{
    capUnit:string;
    holderCoverage:"complete-from-deployment"|"unavailable";
    changeWindow:"verified-24h-reserves"|"unavailable";
    priceSource:"on-chain-pool-reserves";
  };
};
export type DiscoverFeed={
  chainId:18881;
  network:"Ultra EVM Testnet";
  source:"verified-on-chain";
  asOf:string;
  markets:DiscoverMarket[];
  errors:{id:string;reason:string}[];
  executionEnabled:boolean;
  volumeWindow:"bounded-recent-blocks-not-24h";
  pagination?:{total:number;page:number;limit:number;hasMore:boolean};
  indexer?:{status:"verified"|"unconfigured"|"blocked";complete:boolean;nextCursor:string|null;
    fromBlock:string|null;throughBlock:string|null;verifiedLaunchesInPage:number;errors:string[]};
};
export function cleanDiscoveryQuery(value:string):string {
  return value.trim().toLocaleLowerCase("en-US").slice(0,64);
}
function finiteNumber(value:string|null):number{
  if(value===null)return -1;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:-1;
}
export function selectDiscoverMarkets(
  markets:DiscoverMarket[],sort:DiscoverSort,query:string,watchlist:ReadonlySet<string>,
):DiscoverMarket[]{
  // New can rank only real CoinCreated event times, never inferred token ages.
  const needle=cleanDiscoveryQuery(query);
  const filtered=markets.filter(m=>
    (!needle||[m.id,m.baseSymbol,m.quoteSymbol,m.baseToken,m.pair]
      .some(x=>x.toLocaleLowerCase("en-US").includes(needle))) &&
    (sort!=="watchlist"||watchlist.has(m.id)),
  );
  return [...filtered].sort((a,b)=>{
    if(sort==="new")return (b.createdAt??"").localeCompare(a.createdAt??"")||a.id.localeCompare(b.id);
    const first=sort==="top"?finiteNumber(a.marketCap??a.reserveQuote):finiteNumber(a.observedQuoteVolume);
    const second=sort==="top"?finiteNumber(b.marketCap??b.reserveQuote):finiteNumber(b.observedQuoteVolume);
    return second-first||a.id.localeCompare(b.id);
  });
}
export function compactOnChainNumber(value:string|null,precision=2):string{
  if(value===null)return "—";
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)return "—";
  if(n>=1_000_000_000)return (n/1_000_000_000).toFixed(precision)+"b";
  if(n>=1_000_000)return (n/1_000_000).toFixed(precision)+"m";
  if(n>=1_000)return (n/1_000).toFixed(precision)+"k";
  return n.toLocaleString("en-US",{maximumFractionDigits:precision});
}
