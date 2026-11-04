import assert from "node:assert/strict";
import {test} from "node:test";
import {encodeFunctionData,getAddress} from "viem";
import {v2RouterAbi,type MarketConfig} from "../src/lib/trading";
import {
  validateTradeSubmissions,validateOnChainSwapCall,
} from "../src/lib/ops/m11-trades";
import {
  validateNativeMintManifest,verifyNativeMintTrace,
} from "../src/lib/ops/m11-native";
import {M11_CHECKS,createM11Report,m11Finding} from "../src/lib/ops/m11-report";

const addr=(n:number)=>getAddress("0x"+n.toString(16).padStart(40,"0"));
const market:MarketConfig={id:"real-market",baseToken:addr(1),quoteToken:addr(2),
  router:addr(3),factory:addr(4),pair:addr(5)};
const wallet=addr(6);
const encoded=(direction:"buy"|"sell",recipient=wallet,deadline=10000n)=>{
  const path=(direction==="buy"?[market.quoteToken,market.baseToken]:
    [market.baseToken,market.quoteToken]) as [`0x${string}`,`0x${string}`];
  return encodeFunctionData({abi:v2RouterAbi,functionName:"swapExactTokensForTokens",
    args:[1000n,900n,path,recipient,deadline]});
};
const args=(direction:"buy"|"sell")=>({
  market,direction,wallet,from:wallet,to:market.router,value:0n,
  input:encoded(direction),blockTime:9000n,
});

test("M11 real trade manifest requires distinct real-shaped BUY and SELL hashes in the same market",()=>{
  const good=[
    {marketId:market.id,direction:"buy",wallet,txHash:"0x"+"a".repeat(64)},
    {marketId:market.id,direction:"sell",wallet,txHash:"0x"+"b".repeat(64)},
  ];
  assert.equal(validateTradeSubmissions(good).length,2);
  assert.throws(()=>validateTradeSubmissions([]),/exactly/);
  assert.throws(()=>validateTradeSubmissions([good[0],good[0]]),/distinct/);
  assert.throws(()=>validateTradeSubmissions([good[0],{...good[1],marketId:"other"}]),/same market/);
  assert.throws(()=>validateTradeSubmissions([good[0],{...good[1],txHash:"0x"+"0".repeat(64)}]),/nonzero/);
  assert.throws(()=>validateTradeSubmissions([good[0],{...good[1],wallet:"0x0"}]),/nonzero/);
});
test("M11 swap verifier requires wallet-origin router call and correct on-chain BUY/SELL path",()=>{
  const buy=validateOnChainSwapCall(args("buy"));
  assert.equal(buy.inputAmount,1000n);
  assert.equal(buy.minOut,900n);
  assert.equal(buy.outputToken,market.baseToken);
  assert.equal(validateOnChainSwapCall(args("sell")).outputToken,market.quoteToken);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),from:addr(7)}),/wallet/);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),to:market.pair}),/router/);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),value:1n}),/router/);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),input:encoded("sell")}),/path/);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),input:encoded("buy",addr(7))}),/recipient/);
  assert.throws(()=>validateOnChainSwapCall({...args("buy"),input:encoded("buy",wallet,8000n)}),/deadline/);
});
test("M11 native Uniq mint proof requires real executed trace and confirmed owner/factory",()=>{
  const manifest=validateNativeMintManifest({
    txHash:"a".repeat(64),owner:"ultratester",factoryId:"121",tokenId:"3003",
  });
  const trace={
    id:manifest.txHash,block_num:200,trx:{receipt:{status:"executed"}},
    traces:[{act:{account:"eosio.nft.ft",name:"issue.b",
      data:{issue:{to:"ultratester",token_configs:[{token_factory_id:121,amount:1}]}}}}],
  };
  assert.equal(verifyNativeMintTrace(trace,manifest,201).blockNumber,200);
  assert.throws(()=>verifyNativeMintTrace({...trace,id:"b".repeat(64)},manifest,201),/missing/);
  assert.throws(()=>verifyNativeMintTrace({...trace,trx:{receipt:{status:"failed"}}},manifest,201),/not executed/);
  assert.throws(()=>verifyNativeMintTrace(trace,manifest,199),/unconfirmed/);
  assert.throws(()=>verifyNativeMintTrace({...trace,traces:[]},manifest,201),/No executed/);
  assert.throws(()=>verifyNativeMintTrace({...trace,traces:[{act:{account:"eosio.nft.ft",name:"issue.b",
    data:{issue:{to:"another",token_configs:[{token_factory_id:121,amount:1}]}}}}]},manifest,201),/No executed/);
  assert.throws(()=>validateNativeMintManifest({txHash:"0".repeat(64),owner:"ultratester",
    factoryId:"121",tokenId:"3003"}),/actual/);
});
test("M11 acceptance report cannot pass with missing, duplicate or synthetic success checks",()=>{
  assert.equal(M11_CHECKS.length,16);
  const missing=M11_CHECKS.map(id=>m11Finding(id,false,"","No independent proof."));
  const report=createM11Report(missing);
  assert.equal(report.status,"blocked");
  assert.equal(report.publicBetaOpen,false);
  assert.equal(report.broadcastTransactions,0);
  assert.equal(report.blocked.length,16);
  assert.throws(()=>createM11Report(missing.slice(1)),/every unique/);
  assert.throws(()=>createM11Report([...missing.slice(1),missing[0],missing[0]]),/every unique/);
  const synthetic=M11_CHECKS.map(id=>m11Finding(id,true,"Synthetic test only",""));
  const testOnly=createM11Report(synthetic);
  assert.equal(testOnly.status,"awaiting-independent-review");
  assert.equal(testOnly.publicBetaOpen,false);
  assert.equal(testOnly.broadcastTransactions,0);
});
