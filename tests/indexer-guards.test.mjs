import test from "node:test";
import assert from "node:assert/strict";
import {CONFIRMATIONS,MAX_BATCH_BLOCKS,checkedBlockHash,
 planConfirmedWindow,checkCursorContinuity,checkedSwapAmounts,swapDirection
} from "../lib/market/indexer-guards.mjs";
const h="0x"+"a".repeat(64);
test("only confirmed blocks indexed in bounded windows",()=>{
 assert.equal(CONFIRMATIONS,12n);
 assert.equal(MAX_BATCH_BLOCKS,250n);
 assert.deepEqual(planConfirmedWindow({startBlock:100n,head:120n}),
   {ready:true,fromBlock:100n,toBlock:108n,confirmedThrough:108n});
 assert.deepEqual(planConfirmedWindow({lastBlock:249n,startBlock:100n,head:600n}),
   {ready:true,fromBlock:250n,toBlock:499n,confirmedThrough:588n});
 assert.deepEqual(planConfirmedWindow({lastBlock:588n,startBlock:100n,head:600n}),
   {ready:false,fromBlock:589n,toBlock:null,confirmedThrough:588n});
 assert.equal(planConfirmedWindow({startBlock:0n,head:5n}).ready,false);
});
test("invalid ranges and zero-confirmation shortcut fail closed",()=>{
 for(const args of [
  {startBlock:-1n,head:100n},{startBlock:0n,head:100n,confirmations:0n},
  {startBlock:0n,head:100n,batchSize:251n},
  {startBlock:0n,head:100n,batchSize:0n},
  {startBlock:0n,head:100n,lastBlock:-1n},
 ])assert.throws(()=>planConfirmedWindow(args),RangeError);
});
test("cursor hashes require canonical 32-byte values and reject reorgs",()=>{
 assert.equal(checkedBlockHash(h.toUpperCase().replace(/^0X/,"0x")),h);
 assert.equal(checkCursorContinuity(h,h.toUpperCase().replace(/^0X/,"0x")),true);
 assert.equal(checkCursorContinuity(h,"0x"+"b".repeat(64)),false);
 for(const bad of ["",null,"0xabcd",3])assert.throws(()=>checkedBlockHash(bad),RangeError);
});
test("raw swap amounts and direction never pretend complex swaps are buys",()=>{
 assert.deepEqual(checkedSwapAmounts({amount0In:15n,amount1In:0n,amount0Out:0n,amount1Out:9n}),
  ["15","0","0","9"]);
 assert.equal(swapDirection({amount0In:"15",amount1In:"0",amount0Out:"0",amount1Out:"9"}),"token0_to_token1");
 assert.equal(swapDirection({amount0In:"0",amount1In:"15",amount0Out:"9",amount1Out:"0"}),"token1_to_token0");
 assert.equal(swapDirection({amount0In:"2",amount1In:"2",amount0Out:"1",amount1Out:"1"}),"complex_swap");
 assert.throws(()=>checkedSwapAmounts({amount0In:0n,amount1In:0n,amount0Out:0n,amount1Out:0n}),RangeError);
 assert.throws(()=>checkedSwapAmounts({amount0In:-1n,amount1In:0n,amount0Out:0n,amount1Out:1n}),RangeError);
});
