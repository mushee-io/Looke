import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encodeAbiParameters, encodeEventTopics, getAddress, type TransactionReceipt, type Hash,
} from "viem";
import {
  candlesFromSwaps, deriveSwap, erc20Abi, exactAmount, marketConfig,
  minimumOutput, parseMarketRegistry, reservePrice, verifySwapReceipt, v2PairAbi,
} from "../src/lib/trading";

const base=getAddress("0x1111111111111111111111111111111111111111");
const quote=getAddress("0x2222222222222222222222222222222222222222");
const pair=getAddress("0x3333333333333333333333333333333333333333");
const factory=getAddress("0x4444444444444444444444444444444444444444");
const router=getAddress("0x5555555555555555555555555555555555555555");
const trader=getAddress("0x6666666666666666666666666666666666666666");
const hash=("0x"+"a".repeat(64)) as Hash;
const market={id:"looke-usdc",baseToken:base,quoteToken:quote,pair,factory,router};
const raw={
  txHash:hash,
  blockNumber:42n,
  timestamp:1700000000,
};

test("empty registry never pretends a market exists",()=>{
  assert.deepEqual(parseMarketRegistry(""),[]);
  assert.deepEqual(parseMarketRegistry(undefined),[]);
  assert.deepEqual(parseMarketRegistry("[]"),[]);
});
test("only well formed allowlisted addresses may reach router integration",()=>{
  assert.deepEqual(marketConfig(market),market);
  assert.equal(parseMarketRegistry(JSON.stringify([market]))[0].id,"looke-usdc");
  assert.throws(()=>parseMarketRegistry(JSON.stringify([market,market])),/Duplicate/);
  assert.throws(()=>marketConfig({...market,router:"0x0"}),/Invalid/);
  assert.throws(()=>marketConfig({...market,baseToken:quote}),/different/);
  assert.throws(()=>marketConfig({...market,pair:router}),/five distinct/);
  assert.throws(()=>marketConfig({...market,id:"../../bad"}),/identifier/);
  assert.throws(()=>parseMarketRegistry(JSON.stringify(Array(9).fill(market))),/8/);
});
test("exact input amount uses token decimals and never floating point wei",()=>{
  assert.equal(exactAmount("1.234567",6),1234567n);
  assert.equal(exactAmount("0.00000001",18),10000000000n);
  assert.throws(()=>exactAmount("0",6),/range/);
  assert.throws(()=>exactAmount("-1",6),/positive/);
  assert.throws(()=>exactAmount("1.2345678",6),/precision/);
  assert.throws(()=>exactAmount("1e6",18),/positive/);
});
test("minOut is slippage capped to 3 percent and not zero",()=>{
  assert.equal(minimumOutput(1000000n,50),995000n);
  assert.throws(()=>minimumOutput(1000000n,500),/Slippage/);
  assert.throws(()=>minimumOutput(0n,50),/No executable/);
  assert.throws(()=>minimumOutput(1n,50),/zero/);
});
test("reserve price needs actual two-sided liquidity",()=>{
  assert.equal(reservePrice(1_000_000n,2_000_000n,6,6),"2.00000000000");
  assert.throws(()=>reservePrice(0n,100n,6,6),/no real/);
});
test("trading activity derives only actual directional swap amounts",()=>{
  const buy=deriveSwap({...raw,amount0In:0n,amount1In:20_000_000n,amount0Out:10_000_000n,amount1Out:0n},true,6,6);
  assert.equal(buy?.direction,"buy");
  assert.equal(buy?.price,"2");
  assert.equal(buy?.quoteVolume,"20");
  const sell=deriveSwap({...raw,timestamp:1700000200,amount0In:10_000_000n,amount1In:0n,amount0Out:0n,amount1Out:15_000_000n},true,6,6);
  assert.equal(sell?.direction,"sell");
  assert.equal(sell?.price,"1.5");
  const back=deriveSwap({...raw,amount0In:20_000_000n,amount1In:0n,amount0Out:0n,amount1Out:10_000_000n},false,6,6);
  assert.equal(back?.price,"2");
  const invalid=deriveSwap({...raw,amount0In:10_000_000n,amount1In:10_000_000n,amount0Out:0n,amount1Out:0n},true,6,6);
  assert.equal(invalid,null);
});
test("candles only aggregate genuine swaps, preserve empty buckets",()=>{
  assert.deepEqual(candlesFromSwaps([],900),[]);
  const a={txHash:hash,blockNumber:"1",timestamp:900,price:"2",quoteVolume:"20",baseVolume:"10",direction:"buy" as const};
  const b={...a,blockNumber:"2",timestamp:940,price:"1.5",quoteVolume:"15"};
  const c={...a,blockNumber:"3",timestamp:2700,price:"3",quoteVolume:"30"};
  const candles=candlesFromSwaps([c,b,a],900);
  assert.equal(candles.length,2);
  assert.deepEqual([candles[0].open,candles[0].high,candles[0].low,candles[0].close,candles[0].volume,candles[0].count],[2,2,1.5,1.5,35,2]);
  assert.equal(candles[1].start,2700);
  assert.throws(()=>candlesFromSwaps([a],17),/Unsupported/);
});

function receipt({revert=false,wrongRouter=false,wrongPair=false,output=995n,wrongRecipient=false}={}):TransactionReceipt{
  const swapTopics=encodeEventTopics({abi:v2PairAbi,eventName:"Swap",args:{sender:router,to:trader}});
  const swapData=encodeAbiParameters(
    [{type:"uint256"},{type:"uint256"},{type:"uint256"},{type:"uint256"}],
    [0n,1000n,output,0n],
  );
  const transferTopics=encodeEventTopics({abi:erc20Abi,eventName:"Transfer",args:{from:pair,to:wrongRecipient?factory:trader}});
  const transferData=encodeAbiParameters([{type:"uint256"}],[output]);
  return {
    status:revert?"reverted":"success",to:wrongRouter?factory:router,from:trader,transactionHash:hash,
    logs:[
      {address:wrongPair?factory:pair,topics:swapTopics,data:swapData},
      {address:quote,topics:transferTopics,data:transferData},
    ],
  } as unknown as TransactionReceipt;
}
test("swap is verified only with correct router + pair Swap + token Transfer to signer",()=>{
  const proof=verifySwapReceipt(receipt(),market,trader,quote,900n);
  assert.equal(proof.actualOut,995n);
  assert.equal(proof.txHash,hash);
  assert.throws(()=>verifySwapReceipt(receipt({revert:true}),market,trader,quote,900n),/failed/);
  assert.throws(()=>verifySwapReceipt(receipt({wrongRouter:true}),market,trader,quote,900n),/router/);
  assert.throws(()=>verifySwapReceipt(receipt({wrongPair:true}),market,trader,quote,900n),/Swap/);
  assert.throws(()=>verifySwapReceipt(receipt({wrongRecipient:true}),market,trader,quote,900n),/minimum/);
  assert.throws(()=>verifySwapReceipt(receipt({output:800n}),market,trader,quote,900n),/minimum/);
});
