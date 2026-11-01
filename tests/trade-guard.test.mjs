import test from "node:test";
import assert from "node:assert/strict";
import {parseRawTradeAmount,checkedSlippageBps,checkedPoolFeeBps,
 simulateSwapExactIn,isQuoteFresh,tradePreflightReadiness} from "../lib/market/trade-guard.mjs";
test("fixed-precision raw amounts never silently interpret floats or scientific notation",()=>{
 assert.equal(parseRawTradeAmount("1"),1n);
 assert.equal(parseRawTradeAmount("1000000000000000000"),10n**18n);
 for(const v of ["0","00","01","-1","1.2","1e18"," 1","1 ",null,Infinity,"9".repeat(78)])
  assert.throws(()=>parseRawTradeAmount(v),RangeError);
});
test("strict fee and slippage bounds",()=>{
 assert.equal(checkedSlippageBps("0"),0);
 assert.equal(checkedSlippageBps("500"),500);
 for(const v of ["501","1000","1.2","1e2","-10",null," 50 ","05"])
  assert.throws(()=>checkedSlippageBps(v),RangeError);
 assert.equal(checkedPoolFeeBps("30"),30);
 assert.throws(()=>checkedPoolFeeBps("1001"),RangeError);
});
test("simulate V2 exact-in reserves with explicit minOut, fee and impact",()=>{
 const a=simulateSwapExactIn({amountIn:1000n,reserveIn:10000n,reserveOut:20000n,feeBps:30,slippageBps:100});
 assert.equal(a.expectedOut,"1813");
 assert.equal(a.minOut,"1794");
 assert.equal(a.priceImpactBps,910);
 assert.equal(a.feeEstimateInRaw,"3");
 assert.equal(a.highImpact,false);
 assert.equal(a.executable,false);
 const huge=simulateSwapExactIn({amountIn:10000n,reserveIn:10000n,reserveOut:20000n,feeBps:30,slippageBps:50});
 assert.equal(huge.highImpact,true);
 assert.equal(huge.priceImpactBps,5000);
});
test("fail closed for missing output and invalid reserves",()=>{
 const valid={amountIn:1n,reserveIn:100n,reserveOut:100n,feeBps:30,slippageBps:50};
 for(const args of [
  {...valid,reserveIn:0n},{...valid,reserveOut:0n},
  {...valid,amountIn:0n},{...valid,slippageBps:501},
  {...valid,feeBps:-1},{...valid,amountIn:2n**112n},
  {...valid,reserveOut:1n},
 ])assert.throws(()=>simulateSwapExactIn(args),RangeError);
});
test("short quote TTL cannot be tricked by future dates or malformed inputs",()=>{
 const now=Date.parse("2026-11-01T18:00:00.000Z");
 assert.equal(isQuoteFresh(new Date(now+14_000).toISOString(),now),true);
 for(const t of [new Date(now-1).toISOString(),new Date(now+16_000).toISOString(),"bad",null])
  assert.equal(isQuoteFresh(t,now),false);
});
test("review checklist never advertises executable approval even if all checks pass",()=>{
 const args={chainMatches:true,poolAllowlisted:true,codePresent:true,
  reservesPositive:true,quoteFresh:true,impactBps:100,walletBalanceEnough:true,hasRouterAudit:true};
 const result=tradePreflightReadiness(args);
 assert.equal(result.passing,true);
 assert.equal(result.executionEnabled,false);
 assert.equal(tradePreflightReadiness({...args,hasRouterAudit:false}).passing,false);
 assert.equal(tradePreflightReadiness({...args,impactBps:2000}).passing,false);
});
