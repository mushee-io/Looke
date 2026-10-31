import test from "node:test";
import assert from "node:assert/strict";
import { quoteExactIn, minOutput } from "../lib/market/quote.mjs";

test("AMM output is below reserve and decreases with fees",()=>{
 const zero=quoteExactIn(1000n,10000n,10000n,0);
 const fee=quoteExactIn(1000n,10000n,10000n,30);
 assert.equal(zero,909n);
 assert(fee<zero&&fee>0n&&fee<10000n);
});
test("Slippage bound rounds down",()=>{
 assert.equal(minOutput(1000n,50),995n);
 assert.equal(minOutput(1000n,0),1000n);
});
test("Invalid or dangerous quote parameters fail closed",()=>{
 for(const args of [[0n,1n,1n,30],[1n,0n,1n,30],[1n,1n,0n,30],[1n,1n,1n,1001]])
   assert.throws(()=>quoteExactIn(...args));
 assert.throws(()=>minOutput(100n,2001));
});
test("Executable increasing inputs increase output monotonically without draining reserves",()=>{
 let prev=0n;
 for(const input of [10n,100n,1000n,10000n]){
   const out=quoteExactIn(input,100000n,100000n,30);
   assert(out>prev);assert(out<100000n);prev=out;
 }
});

test("Very small outputs never produce an unsafe zero minimum",()=>{
  assert.throws(()=>minOutput(1n,1), /zero/);
  assert.throws(()=>minOutput(1n,2000), /zero/);
  assert.equal(minOutput(1n,0),1n);
  assert.equal(minOutput(100n,2000),80n);
});
test("Quote inputs must be positive BigInts and fees must be within bounds",()=>{
  assert.throws(()=>quoteExactIn(1,1000n,1000n,30),/BigInt/);
  assert.throws(()=>quoteExactIn(-1n,1000n,1000n,30),/BigInt/);
  assert.throws(()=>quoteExactIn(1n,1000n,1000n,-1),/Fee/);
  assert.throws(()=>minOutput(0n,0),/positive/);
  assert.throws(()=>minOutput(100n,-1),/Slippage/);
});
