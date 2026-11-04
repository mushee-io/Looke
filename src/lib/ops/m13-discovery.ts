import type {DiscoverMarket,DiscoverSort} from "../discover";
export type MarketQuery={q:string;sort:DiscoverSort;page:number;limit:number;quote:string};
export function parseMarketQuery(raw:URLSearchParams):MarketQuery{
  const q=(raw.get("q")??"").trim().toLocaleLowerCase("en-US").slice(0,64);
  const sort=raw.get("sort")??"trending";
  if(!["trending","top","new","watchlist"].includes(sort))throw new Error("Invalid market sort.");
  const page=raw.get("page")??"1",limit=raw.get("limit")??"8";
  if(!/^[1-9][0-9]{0,3}$/.test(page)||!/^[1-9][0-9]?$/.test(limit)||
     Number(limit)>20)throw new Error("Page must be 1–9999; page size must be 1–20.");
  const quote=(raw.get("quote")??"").trim().toUpperCase();
  if(!/^[A-Z0-9_.-]{0,24}$/.test(quote))throw new Error("Invalid quote-token filter.");
  return {q,sort:sort as DiscoverSort,page:Number(page),limit:Number(limit),quote};
}
export function rankVerifiedMarkets(rows:DiscoverMarket[],query:MarketQuery):
 {rows:DiscoverMarket[];total:number;page:number;limit:number;hasMore:boolean}{
  const matching=rows.filter(m=>
    (!query.quote||m.quoteSymbol.toUpperCase()===query.quote)&&
    (!query.q||[m.id,m.baseSymbol,m.baseToken,m.quoteSymbol,m.quoteToken,m.pair]
      .some(s=>s.toLocaleLowerCase("en-US").includes(query.q.toLocaleLowerCase("en-US")))));
  // Watchlist is client-local; server never asserts an identity or invents saved accounts.
  const sorted=matching.sort((a,b)=>{
    const num=(v:string|null)=>v===null?-1:Number.isFinite(Number(v))?Number(v):-1;
    if(query.sort==="new"){
      const byAge=(b.createdAt??"").localeCompare(a.createdAt??"");
      return byAge||a.id.localeCompare(b.id);
    }
    const value=(m:DiscoverMarket)=>{
      if(query.sort==="top")return num(m.marketCap??m.reserveQuote);
      return num(m.observedQuoteVolume);
    };
    return value(b)-value(a)||a.id.localeCompare(b.id);
  });
  const start=(query.page-1)*query.limit;
  return {rows:sorted.slice(start,start+query.limit),total:sorted.length,
    page:query.page,limit:query.limit,hasMore:start+query.limit<sorted.length};
}
export function safeAge(timestamp:string|null,now=new Date()):string|null{
  if(!timestamp)return null;
  const ms=new Date(timestamp).getTime();
  const elapsed=now.getTime()-ms;
  if(!Number.isFinite(ms)||elapsed<0)return null;
  if(elapsed<60*60_000)return Math.floor(elapsed/60_000)+"m";
  if(elapsed<24*60*60_000)return Math.floor(elapsed/3_600_000)+"h";
  return Math.floor(elapsed/86_400_000)+"d";
}
