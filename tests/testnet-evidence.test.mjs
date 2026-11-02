import test from "node:test";
import assert from "node:assert/strict";
import {checkedEvidenceHash,checkedIndependentRpc,corroborateTestnetReceipt,
 acceptanceGate} from "../lib/testnet-evidence.mjs";
const hash="0x"+"a".repeat(64),blockHash="0x"+"b".repeat(64);
const from="0x"+"c".repeat(40),factory="0x"+"d".repeat(40);
const eventSelector="0x"+"e".repeat(64);
const event={transactionHash:hash,blockHash,address:factory,logIndex:1,
 topics:[eventSelector,"0x"+"f".repeat(64)],data:"0x00"};
const snapshot=()=>({
 chainId:18881,head:125n,code:"0x60016001",
 transaction:{hash,from,to:factory,blockNumber:100n,blockHash},
 receipt:{transactionHash:hash,blockNumber:100n,blockHash,status:"success",logs:[event]},
 block:{number:100n,hash:blockHash}
});
const args={kind:"factory",source:factory,txHash:hash,eventSelector,expectedFrom:from};
test("two independent valid receipts agree on canonical chain, event and bytecode but do not approve trading",()=>{
 const report=corroborateTestnetReceipt(snapshot(),structuredClone(snapshot()),args);
 assert.equal(report.independentRpcsAgreed,true);
 assert.deepEqual(report.eventLogIndexes,[1]);
 assert.equal(report.contentAuthorizationVerified,false);
 assert.equal(report.safeForMainnet,false);
 assert.equal(report.userWalletConsentProved,false);
});
test("missing, failed, or shallow-fork receipts fail closed",()=>{
 const mods=[
  x=>{x.chainId=19991;},x=>{x.receipt.status="reverted";},
  x=>{x.block.hash="0x"+"1".repeat(64);},
  x=>{x.receipt.blockHash="0x"+"1".repeat(64);},
  x=>{x.transaction.blockNumber=99n;},
  x=>{x.head=110n;},
  x=>{x.receipt.logs=[];},
  x=>{x.receipt.logs[0]={...x.receipt.logs[0],address:from};},
  x=>{x.receipt.logs[0]={...x.receipt.logs[0],transactionHash:"0x"+"2".repeat(64)};},
  x=>{x.code="0x";},
  x=>{x.transaction.from=factory;},
  x=>{x.transaction.to=from;}
 ];
 for(const change of mods){
  const bad=snapshot();change(bad);
  assert.throws(()=>corroborateTestnetReceipt(snapshot(),bad,args),RangeError);
 }
});
test("two nodes must agree on complete receipts and bytecode, not only matching event presence",()=>{
 for(const change of [
  x=>{x.code="0x60026001";},
  x=>{x.receipt.logs.push({...event,logIndex:3,address:from});},
  x=>{x.receipt.logs[0]={...event,data:"0x12"};},
  x=>{x.transaction.from=from.toUpperCase().replace(/^0X/,"0x");x.receipt.logs[0]={...event,topics:[eventSelector]};}
 ]){
  const bad=snapshot();change(bad);
  assert.throws(()=>corroborateTestnetReceipt(snapshot(),bad,args),RangeError);
 }
});
test("malformed evidence, RPC URL attacks and arbitrary source identities are rejected",()=>{
 for(const value of ["0xabc",null,"A".repeat(64)])
  assert.throws(()=>checkedEvidenceHash(value),RangeError);
 assert.equal(checkedIndependentRpc("https://second.example/rpc",
   "https://first.example"),"https://second.example/rpc");
 for(const url of ["http://second.example","https://localhost",
  "https://first.example","https://127.0.0.1","https://[::1]",
  "https://private.internal","https://abc.local","https://user:pass@second.example",
  "https://second.example:8080",null]){
  assert.throws(()=>checkedIndependentRpc(url,"https://first.example"),RangeError);
 }
 assert.throws(()=>corroborateTestnetReceipt(snapshot(),snapshot(),
  {...args,source:"0x"+"0".repeat(40)}),RangeError);
});
test("even fabricated operator approval booleans cannot enable funding or trading in this package",()=>{
 const report=acceptanceGate({
  stagingDeployed:true,independentSecurityAudit:true,
  creatorAuthorizationFixed:true,nativeWalletIdentityTested:true,
  realTradingReceiptsReviewed:true,incidentRunbookApproved:true
 });
 assert.equal(report.approved,false);
 assert.equal(report.tradingEnabled,false);
 assert.equal(report.mainnetReady,false);
 assert.equal(acceptanceGate().pending.length,6);
});
