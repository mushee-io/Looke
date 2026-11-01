import test from "node:test";
import assert from "node:assert/strict";
import {checkedDiscoveryMode,normalizeDiscoveryQuery,discoveryScore} from "../lib/discovery.mjs";

test("valid feed modes are explicit",()=>{
  for(const mode of ["latest","trending","for-you","following"])assert.equal(checkedDiscoveryMode(mode),mode);
  for(const bad of ["","new","admin",null,["trending"]])assert.throws(()=>checkedDiscoveryMode(bad),RangeError);
});
test("query normalization removes whitespace without changing meaning",()=>{
  assert.equal(normalizeDiscoveryQuery("  Ultra   creator  "),"Ultra creator");
  assert.equal(normalizeDiscoveryQuery("NFT"),"NFT");
  assert.equal(normalizeDiscoveryQuery("  🌍✨  "),"🌍✨");
  for(const bad of [null,undefined,1,"","x","a".repeat(81),"hello\u0000world","   "])assert.throws(()=>normalizeDiscoveryQuery(bad),RangeError);
});
test("trending heuristic rewards real engagement and decays by time",()=>{
  const base={likes:2,comments:1,reposts:0,ageHours:12};
  assert(discoveryScore({...base,likes:10})>discoveryScore(base));
  assert(discoveryScore({...base,reposts:3})>discoveryScore(base));
  assert(discoveryScore({...base,ageHours:48})<discoveryScore(base));
  assert.equal(discoveryScore({...base,followed:true}),discoveryScore(base)*2.5);
  assert.equal(discoveryScore({likes:0,comments:0,reposts:0,ageHours:0}),1);
});
test("invalid activity inputs cannot produce ranking math",()=>{
  for(const invalid of [-1,Infinity,Number.NaN])assert.throws(()=>discoveryScore({likes:invalid}),RangeError);
});
