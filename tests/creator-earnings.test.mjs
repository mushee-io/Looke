import test from "node:test";
import assert from "node:assert/strict";
import {parseUosAmount,normalizedShares,estimateNativeResaleDistribution,
 checkedNativeTransactionId,checkedPayoutEvidenceId,normalizePayoutEvidence
} from "../lib/creator-earnings.mjs";
const args={
 price:"100.00000000 UOS",seller:"selleracct11",
 factoryShares:[{receiver:"artistacct11",basis_point:1000},{receiver:"collabacct11",basis_point:2000}],
 globalShares:[{receiver:"ultra.nft.ft",basis_point:200}],
 promoterBasisPoints:500,promoterRecipient:"promoteracct",promoterPaymentsEnabled:true
};
const txId="a".repeat(64);
test("exact UOS atomic parsing rejects guessed FX and precision",()=>{
 assert.equal(parseUosAmount("100.00000000 UOS"),10000000000n);
 assert.equal(parseUosAmount("0.00000001 UOS"),1n);
 for(const x of ["100 UOS","10.0 UOS","0.00000000 UOS","10.000000000 UOS",
   "10.00000000 USD","1e8 UOS",null,"100.00000000 uos", "-2.00000000 UOS"])
  assert.throws(()=>parseUosAmount(x),RangeError);
});
test("resale splits sum exactly to price in raw UOS, not credited revenue",()=>{
 const a=estimateNativeResaleDistribution(args);
 assert.equal(a.totalRawUos,"10000000000");
 assert.deepEqual(a.allocations.map(x=>x.rawUos),
  ["200000000","1000000000","2000000000","500000000","6300000000"]);
 assert.equal(a.earningsCredited,false);
 assert.equal(a.actualSaleVerified,false);
 assert.equal(a.payoutReceiptsVerified,false);
 assert.equal(a.allocations.reduce((n,x)=>n+BigInt(x.rawUos),0n),BigInt(a.totalRawUos));
});
test("duplicate beneficiaries remain distinct allocations while rounding remainder belongs to seller",()=>{
 const a=estimateNativeResaleDistribution({
  ...args,price:"0.00000003 UOS",
  factoryShares:[{receiver:"artistacct11",basis_point:3000},{receiver:"artistacct11",basis_point:3000}],
  globalShares:[],promoterBasisPoints:0,promoterRecipient:null,promoterPaymentsEnabled:false
 });
 assert.equal(a.allocations[0].rawUos,"0");
 assert.equal(a.allocations[1].rawUos,"0");
 assert.equal(a.allocations[2].rawUos,"3");
});
test("unknown promoter or invalid beneficiary arithmetic fails closed",()=>{
 for(const override of [
  {promoterRecipient:null},{promoterPaymentsEnabled:null},
  {globalShares:[{receiver:"ultra.nft.ft",basis_point:9000}]},
  {factoryShares:[{receiver:"evil!!",basis_point:100}]},
  {factoryShares:[{receiver:"artistacct11",basis_point:10100}]},
  {promoterBasisPoints:10001},
 ])assert.throws(()=>estimateNativeResaleDistribution({...args,...override}),RangeError);
 assert.throws(()=>normalizedShares(null),RangeError);
});
test("unverified receipt submissions accept strict native evidence identifiers, no amounts",()=>{
 const payload={nativeAccount:"artistacct11",txId,kind:"resale_royalty",factoryId:"5"};
 assert.deepEqual(normalizePayoutEvidence(payload),payload);
 assert.equal(checkedNativeTransactionId(txId.toUpperCase()),txId);
 assert.equal(checkedPayoutEvidenceId("186f9af3-1270-4e8e-aaf4-f85ca9565a21"),"186f9af3-1270-4e8e-aaf4-f85ca9565a21");
 for(const p of [
  {...payload,txId:"not-a-tx"},{...payload,amount:"500 UOS"},
  {...payload,nativeAccount:"bad..name"},{...payload,kind:"credited"},
  {...payload,factoryId:"0"},null
 ])assert.throws(()=>normalizePayoutEvidence(p),RangeError);
});
