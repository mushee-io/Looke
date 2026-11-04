import assert from "node:assert/strict";
import {test} from "node:test";
import {
 cleanDiscoveryQuery,compactOnChainNumber,selectDiscoverMarkets,
 type DiscoverMarket,
} from "../src/lib/discover";

const make=(id:string,volume:string|null,quote:string):DiscoverMarket=>({
 id,baseSymbol:id.toUpperCase(),quoteSymbol:"UOS",
 baseToken:"0x"+"a".repeat(40),quoteToken:"0x"+"b".repeat(40),
 pair:"0x"+"c".repeat(40),poolPrice:"0.25",
 reserveBase:"1000",reserveQuote:quote,
 observedQuoteVolume:volume,observedSwapCount:volume===null?null:5,
 partial:true,activityError:null,
 marketCap:null,holders:null,change24h:null,createdAt:null,
});
const markets=[make("orb","45","150"),make("blue","82","300"),make("zero",null,"100")];
test("Trending sorts by actual observed bounded-block volume, not invented market cap",()=>{
 const result=selectDiscoverMarkets(markets,"trending","",new Set());
 assert.deepEqual(result.map(x=>x.id),["blue","orb","zero"]);
 assert.equal(result[0].marketCap,null);
 assert.equal(result[0].change24h,null);
 assert.equal(result[0].createdAt,null);
});
test("Top sorts only verified reserves; New refuses to fabricate launch chronology",()=>{
 assert.deepEqual(selectDiscoverMarkets(markets,"top","",new Set()).map(x=>x.id),["blue","orb","zero"]);
 assert.deepEqual(selectDiscoverMarkets(markets,"new","",new Set()),[]);
});
test("Watchlist is explicitly user-curated, not fake social following",()=>{
 assert.deepEqual(selectDiscoverMarkets(markets,"watchlist","",new Set(["orb"])).map(x=>x.id),["orb"]);
 assert.deepEqual(selectDiscoverMarkets(markets,"watchlist","",new Set()),[]);
});
test("Search filters name, ticker, market id or contract, case-insensitively",()=>{
 assert.deepEqual(selectDiscoverMarkets(markets,"trending"," BLUE ",new Set()).map(x=>x.id),["blue"]);
 assert.deepEqual(selectDiscoverMarkets(markets,"trending","uOs",new Set()).map(x=>x.id),["blue","orb","zero"]);
 assert.equal(cleanDiscoveryQuery("  HeLLo "), "hello");
 assert.equal(selectDiscoverMarkets(markets,"trending","not-real",new Set()).length,0);
});
test("Unknown and malformed metrics display unavailable, never zero or made-up numbers",()=>{
 assert.equal(compactOnChainNumber(null),"—");
 assert.equal(compactOnChainNumber("not-a-number"),"—");
 assert.equal(compactOnChainNumber("-20"),"—");
 assert.equal(compactOnChainNumber("0"),"0");
 assert.equal(compactOnChainNumber("1540"),"1.54k");
});
