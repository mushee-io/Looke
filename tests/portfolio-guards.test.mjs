import test from "node:test";
import assert from "node:assert/strict";
import {checkedEvmWallet,configuredPortfolioTokens,checkedAssetRaw,
 checkedNativePortfolioRow,checkedNativePortfolioCursor,nativePortfolioNextCursor,
 confirmedActivityWindow,normalizePortfolioTransfer,orderedUniqueTransfers
} from "../lib/portfolio-guards.mjs";
const wallet="0x"+"a".repeat(40),other="0x"+"b".repeat(40),token="0x"+"c".repeat(40);
test("portfolio token allowlist enforces valid unique operator-curated addresses",()=>{
 assert.deepEqual(configuredPortfolioTokens(""),[]);
 assert.deepEqual(configuredPortfolioTokens(token+", "+other),[token,other]);
 for(const raw of ["123",token+","+token,"0x"+"0".repeat(40),
  Array(9).fill(token).join(","),token+",garbage"])
  assert.throws(()=>configuredPortfolioTokens(raw),RangeError);
 assert.equal(checkedEvmWallet(wallet.toUpperCase().replace("0X","0x")),wallet);
 assert.throws(()=>checkedEvmWallet("0xabc"),RangeError);
});
test("balances preserve uint256 integer precision and zero values",()=>{
 assert.equal(checkedAssetRaw(0n),"0");
 assert.equal(checkedAssetRaw((1n<<256n)-1n),((1n<<256n)-1n).toString());
 for(const v of [-1n,1n<<256n,1,"2"])assert.throws(()=>checkedAssetRaw(v),RangeError);
});
test("native owner-scoped token rows reject unsafe IDs and serials",()=>{
 assert.deepEqual(checkedNativePortfolioRow({id:"18446744073709551615",
   token_factory_id:"18446744073709551615",serial_number:42}),
  {tokenId:"18446744073709551615",factoryId:"18446744073709551615",serialNumber:"42"});
 for(const row of [{id:"0",token_factory_id:"1",serial_number:1},
  {id:"1",token_factory_id:"1",serial_number:-1},
  {id:2**54,token_factory_id:"1",serial_number:1}])
  assert.throws(()=>checkedNativePortfolioRow(row),RangeError);
 assert.equal(checkedNativePortfolioCursor(null),null);
 assert.equal(nativePortfolioNextCursor([{id:"10"},{id:"11"}],true,"12"),"12");
 assert.throws(()=>nativePortfolioNextCursor([{id:"10"}],true,"10"),RangeError);
});
test("confirmed 250-block lookback is bounded and cannot claim full transaction history",()=>{
 assert.deepEqual(confirmedActivityWindow(512n),{fromBlock:251n,toBlock:500n,confirmationDepth:12n});
 assert.deepEqual(confirmedActivityWindow(12n),{fromBlock:0n,toBlock:0n,confirmationDepth:12n});
 assert.equal(confirmedActivityWindow(11n),null);
 assert.throws(()=>confirmedActivityWindow(10n,0n),RangeError);
});
test("actual token Transfer logs are wallet-filtered, integer-only and de-duplicated",()=>{
 const tx="0x"+"d".repeat(64);
 const event={token,from:other,to:wallet,txHash:tx,blockNumber:123n,
  logIndex:1,value:10n**22n};
 const i=normalizePortfolioTransfer(event,wallet);
 assert.equal(i.direction,"in");assert.equal(i.valueRaw,(10n**22n).toString());
 assert.equal(normalizePortfolioTransfer({...event,from:wallet,to:wallet},wallet).direction,"self");
 assert.equal(normalizePortfolioTransfer({...event,from:wallet,to:other},wallet).direction,"out");
 assert.throws(()=>normalizePortfolioTransfer({...event,from:other,to:token},wallet),RangeError);
 assert.throws(()=>normalizePortfolioTransfer({...event,value:-1n},wallet),RangeError);
 assert.equal(orderedUniqueTransfers([i,i]).length,1);
});
