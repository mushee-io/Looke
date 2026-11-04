import assert from "node:assert/strict";
import {test} from "node:test";
import {getAddress} from "viem";
import {
  parseFactoryConfig,launchWindow,validateLaunchEvent,
  M13_BLOCKS_PER_PAGE,
} from "../src/lib/ops/m13-index";
import {
  exactHolderCount,verifiedQuoteMarketCap,verifiedPriceChange,
  validateHolderScan,MAX_HOLDER_HISTORY_BLOCKS,
} from "../src/lib/ops/m13-metrics-pure";
import {parseMarketQuery,rankVerifiedMarkets,safeAge} from "../src/lib/ops/m13-discovery";
import type {DiscoverMarket} from "../src/lib/discover";

const addr=(n:number)=>getAddress("0x"+n.toString(16).padStart(40,"0"));
const factory=addr(1),coin=addr(2),creator=addr(3);
test("M13 refuses missing or unproven factory configuration",()=>{
  assert.equal(parseFactoryConfig(undefined,undefined),null);
  assert.throws(()=>parseFactoryConfig(factory,undefined),/both/);
  assert.throws(()=>parseFactoryConfig(undefined,"0x"+"1".repeat(64)),/both/);
  assert.throws(()=>parseFactoryConfig(factory,"0x"+"0".repeat(64)),/both/);
  assert.deepEqual(parseFactoryConfig(factory,"0x"+"a".repeat(64)),{
    address:factory,txHash:"0x"+"a".repeat(64),
  });
});
test("Finalized CoinCreated index windows are bounded, contiguous and cursor-paged",()=>{
  const first=launchWindow(100n,1999n,null);
  assert.deepEqual(first,{from:1400n,through:1999n,nextCursor:"1399",complete:false});
  const second=launchWindow(100n,1999n,first.nextCursor);
  assert.deepEqual(second,{from:800n,through:1399n,nextCursor:"799",complete:false});
  const last=launchWindow(100n,1999n,"799");
  assert.deepEqual(last,{from:200n,through:799n,nextCursor:"199",complete:false});
  assert.deepEqual(launchWindow(100n,1999n,"199"),{
    from:100n,through:199n,nextCursor:null,complete:true,
  });
  assert.equal(M13_BLOCKS_PER_PAGE,600n);
  assert.throws(()=>launchWindow(100n,1000n,"1001"),/Future/);
  assert.throws(()=>launchWindow(100n,1000n,"-1"),/Invalid/);
  assert.throws(()=>launchWindow(100n,1000n,"100.1"),/Invalid/);
});
test("CoinCreated is accepted only with canonical receipt, signer and actual token state",()=>{
  const proof={
    factory,contract:factory,coin,creator,transactionFrom:creator,
    receiptStatus:"success" as const,receiptBlock:200n,eventBlock:200n,
    blockHash:"0x"+"b".repeat(64),receiptBlockHash:"0x"+"b".repeat(64),
    runtimeCode:"0x6001",creatorOnChain:creator,totalSupply:1000n,initialSupply:1000n,
  };
  assert.doesNotThrow(()=>validateLaunchEvent(proof));
  assert.throws(()=>validateLaunchEvent({...proof,transactionFrom:addr(8)}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,contract:addr(9)}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,receiptStatus:"reverted"}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,receiptBlockHash:"0x"+"a".repeat(64)}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,runtimeCode:"0x"}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,creatorOnChain:addr(7)}),/do not match/);
  assert.throws(()=>validateLaunchEvent({...proof,initialSupply:0n}),/do not match/);
});
test("Exact holder proof includes mints and transfers but never invents skipped history",()=>{
  const zero=addr(0),alice=addr(10),bob=addr(11);
  const proofs=[
    {from:zero,to:alice,value:100n},
    {from:alice,to:bob,value:30n},
    {from:bob,to:zero,value:10n},
  ];
  assert.equal(exactHolderCount(proofs,90n),2);
  assert.equal(exactHolderCount(proofs,100n),null);
  assert.equal(exactHolderCount(proofs.slice(1),90n),null);
  assert.equal(exactHolderCount([],0n),0);
  assert.equal(exactHolderCount([{from:alice,to:bob,value:1n}],0n),null);
  assert.equal(validateHolderScan(1n,MAX_HOLDER_HISTORY_BLOCKS),true);
  assert.equal(validateHolderScan(1n,MAX_HOLDER_HISTORY_BLOCKS+1n),false);
});
test("Market cap is in verified quote units, price change requires actual ratios",()=>{
  assert.equal(verifiedQuoteMarketCap(1000n,2,"1.25"),"12.5000000000");
  assert.equal(verifiedQuoteMarketCap(1000n,2,"0"),null);
  assert.equal(verifiedQuoteMarketCap(1000n,24,"1"),null);
  assert.equal(verifiedPriceChange("1.2","1"),"20.00");
  assert.equal(verifiedPriceChange("0.8","1"),"-20.00");
  assert.equal(verifiedPriceChange("1","0"),null);
  assert.equal(verifiedPriceChange("NaN","1"),null);
});
function market(id:string,cap:string|null,volume:string|null,age:string|null):DiscoverMarket{
  return {
    id,baseSymbol:id.toUpperCase(),quoteSymbol:"UOS",baseToken:addr(3),quoteToken:addr(4),
    pair:addr(5),poolPrice:"1",reserveBase:"100",reserveQuote:"200",
    observedQuoteVolume:volume,observedSwapCount:0,partial:false,activityError:null,
    marketCap:cap,holders:null,change24h:null,createdAt:age,
  };
}
test("M13 server market sort, search, quoted asset filter and real pagination",()=>{
  const data=[
    market("a","100","30","2026-11-04T12:00:00.000Z"),
    market("b","200","10","2026-11-04T13:00:00.000Z"),
    market("c",null,null,null),
  ];
  const first=parseMarketQuery(new URLSearchParams("sort=top&page=1&limit=2"));
  assert.deepEqual(rankVerifiedMarkets(data,first).rows.map(m=>m.id),["b","a"]);
  assert.equal(rankVerifiedMarkets(data,first).hasMore,true);
  const page2=rankVerifiedMarkets(data,{...first,page:2});
  assert.deepEqual(page2.rows.map(m=>m.id),["c"]);
  assert.equal(page2.hasMore,false);
  assert.deepEqual(rankVerifiedMarkets(data,{...first,sort:"trending"}).rows.map(m=>m.id),["a","b"]);
  assert.deepEqual(rankVerifiedMarkets(data,{...first,sort:"new"}).rows.map(m=>m.id),["b","a"]);
  assert.equal(rankVerifiedMarkets(data,{...first,q:"C"}).rows.length,1);
  assert.equal(rankVerifiedMarkets(data,{...first,quote:"USDC"}).rows.length,0);
  assert.throws(()=>parseMarketQuery(new URLSearchParams("limit=200")) ,/Page/);
  assert.throws(()=>parseMarketQuery(new URLSearchParams("page=0")) ,/Page/);
  assert.throws(()=>parseMarketQuery(new URLSearchParams("sort=volume")) ,/sort/);
  assert.equal(safeAge("2026-11-04T12:00:00.000Z",new Date("2026-11-04T13:00:00.000Z")),"1h");
  assert.equal(safeAge(null),null);
});
