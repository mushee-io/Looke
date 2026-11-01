import test from "node:test";
import assert from "node:assert/strict";
import {checkedUniqTokenId,checkedMarketCursor,parseNativeSalePrice,validateResaleRow,
 verifyResaleOwnership,validateMarketIntent,nextMarketCursor} from "../lib/uniq-market.mjs";
const row={token_id:"18446744073709551615",owner:"selleracct11",price:"15.00000000 UOS",promoter_basis_point:250};
const token={id:row.token_id,token_factory_id:"123",serial_number:7};
test("native uint64 identities are never rounded by JavaScript",()=>{
 assert.equal(checkedUniqTokenId("18446744073709551615"),"18446744073709551615");
 assert.equal(checkedUniqTokenId(7), "7");
 assert.equal(checkedMarketCursor(null),null);
 for(const v of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,"0","01","18446744073709551616","7e9"])
  assert.throws(()=>checkedUniqTokenId(v),RangeError);
});
test("onchain asset prices use integer math with explicit symbol/precision",()=>{
 assert.deepEqual(parseNativeSalePrice("15.00000000 UOS"),
  {amount:"15.00000000 UOS",amountRaw:"1500000000",currency:"UOS",decimals:8});
 assert.deepEqual(parseNativeSalePrice("9.50 USD"),
  {amount:"9.50 USD",amountRaw:"950",currency:"USD",decimals:2});
 for(const v of ["0.00000000 UOS","10.0 uos","10.000000000 UOS","10e2 UOS",
  "-1.00 UOS","1.0 UOS extra",1,null,"18446744073709551616 UOS"])
  assert.throws(()=>parseNativeSalePrice(v),RangeError);
});
test("resale listings require current token.b ownership crosscheck",()=>{
 const verified=verifyResaleOwnership(row,token);
 assert.equal(verified.owner,"selleracct11");
 assert.equal(verified.price.amount,"15.00000000 UOS");
 assert.equal(verified.nativeOwnerCrosschecked,true);
 assert.equal(verified.factoryId,"123");
 assert.equal(verified.transactionEnabled,false);
 for(const invalid of [null,{}, {...token,id:"3"},{...token,serial_number:"bad"}])
  assert.throws(()=>verifyResaleOwnership(row,invalid),RangeError);
 assert.throws(()=>validateResaleRow({...row,owner:"bad..name"}),RangeError);
 assert.throws(()=>validateResaleRow({...row,promoter_basis_point:10001}),RangeError);
});
test("buyer cannot self-purchase, only seller may cancel, listing requires unlisted owned Uniq",()=>{
 const listing=verifyResaleOwnership(row,token);
 assert.equal(validateMarketIntent("buy","buyeracct11",listing,null).conditionsMet,true);
 assert.equal(validateMarketIntent("buy","selleracct11",listing,null).conditionsMet,false);
 assert.equal(validateMarketIntent("cancel","selleracct11",listing,null).conditionsMet,true);
 assert.equal(validateMarketIntent("cancel","buyeracct11",listing,null).conditionsMet,false);
 assert.equal(validateMarketIntent("list","selleracct11",null,{owner:"selleracct11"}).conditionsMet,true);
 assert.equal(validateMarketIntent("list","selleracct11",listing,{owner:"selleracct11"}).conditionsMet,false);
 assert.equal(validateMarketIntent("list","selleracct11",null,{owner:"otheracct111"}).conditionsMet,false);
 assert.equal(validateMarketIntent("buy","buyeracct11",listing,null).executionEnabled,false);
});
test("pagination honors nodeos next_key and refuses stale/non-progressing cursors",()=>{
 const entries=[{token_id:"14"},{token_id:"15"}];
 assert.equal(nextMarketCursor(entries,true,"16"),"16");
 assert.equal(nextMarketCursor(entries,true,null),"16");
 assert.equal(nextMarketCursor(entries,false,"16"),null);
 assert.throws(()=>nextMarketCursor(entries,true,"15"),RangeError);
 assert.throws(()=>nextMarketCursor([],true,null),RangeError);
});
