import test from "node:test";
import assert from "node:assert/strict";
import {normalizeTrendTopic,normalizeTrendProposal,trendReference,trendEvidenceEligible,checkedTrendId} from "../lib/trend-coin.mjs";
const uri="ipfs://Qm"+"a".repeat(44)+"/metadata.json";
const proposal={topic:"  Ultra   Games ",name:"Ultra Games Trends",symbol:"GAME",supplyTokens:"1000000",metadataURI:uri};
test("trend slugs are canonical, reserved namespaces blocked",()=>{
 assert.deepEqual(normalizeTrendTopic(" Ultra   Games "),{topic:"ultra games",slug:"ultra-games"});
 assert.equal(normalizeTrendTopic("ultra-games").slug,"ultra-games");
 assert.deepEqual(normalizeTrendProposal(proposal),{
  topic:"ultra games",slug:"ultra-games",name:"Ultra Games Trends",symbol:"GAME",supplyTokens:1_000_000,metadataURI:uri
 });
 for(const bad of ["",null,42,"a","unknown$topic","hello/world","hello___world","".padEnd(49,"x"),"official","looke","support","two\nlines"]){
  assert.throws(()=>normalizeTrendTopic(bad),RangeError);
 }
 for(const bad of [null,[],{}, {...proposal,symbol:"bad"},
  {...proposal,supplyTokens:"0"},{...proposal,creator:"0x123"}]){
  assert.throws(()=>normalizeTrendProposal(bad),RangeError);
 }
});
test("trend ref is stable for canonical topic and bound to Looke Ultra testnet domain",()=>{
 const first=trendReference(" Ultra   Games ");
 assert.equal(first.trendRef,trendReference("ultra-games").trendRef);
 assert.match(first.trendRef,/^0x[0-9a-f]{64}$/);
 assert.notEqual(first.trendRef,trendReference("ultra artwork").trendRef);
 assert.equal(first.kind,2);assert.equal(first.chainId,18881);
});
test("community evidence minimums are explicit, never treated as independent identity proof",()=>{
 assert.equal(trendEvidenceEligible(3,2),true);
 assert.equal(trendEvidenceEligible(2,2),false);
 assert.equal(trendEvidenceEligible(3,1),false);
 assert.equal(trendEvidenceEligible(5,3),true);
 for(const input of [NaN,Infinity,-1,2.5]){
  assert.equal(trendEvidenceEligible(input,2),false);
 }
});
test("trend proposal IDs are strict UUID strings",()=>{
 const id="bb042641-3cc1-4613-8dbb-0bc4262ac86c";
 assert.equal(checkedTrendId(id.toUpperCase()),id);
 for(const bad of ["../trend","abc","xx"+id,null,{}])assert.throws(()=>checkedTrendId(bad),RangeError);
});
