import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {checkedBetaOrigin,checkedBetaResponse,smokeBetaStaging} from "../scripts/m22-beta-smoke.mjs";
import {summarizeBetaReadiness} from "../lib/beta-readiness.mjs";
test("M22 staging checker only accepts exact public HTTPS origins",()=>{
 assert.equal(checkedBetaOrigin("https://looke-staging.example.com/"),"https://looke-staging.example.com");
 for(const url of [
  "",null,"http://looke-staging.example.com","https://localhost",
  "https://127.0.0.1","https://[::1]","https://staging.internal",
  "https://staging.local","https://staging.example.com.",
  "https://user:password@staging.example.com",
  "https://staging.example.com:8443",
  "https://staging.example.com/secret","https://staging.example.com?x=1",
  "https://staging.example.com/#fragment","https://nowhere",
  "https://staging.example.com.evil.local"
 ])assert.throws(()=>checkedBetaOrigin(url),RangeError);
});
test("M22 smoke checker refuses fake launch gates even with apparently healthy RPC",()=>{
 const ok=summarizeBetaReadiness({chainId:18881,head:123n});
 const result=checkedBetaResponse(ok);
 assert.equal(result.publicBetaOpen,false);
 assert.equal(result.issuanceEnabled,false);
 assert.equal(result.tradingEnabled,false);
 assert.equal(result.rpcObservation,"rpc_reachable");
 for(const key of ["publicBetaOpen","publicTradingEnabled","mainnetReady",
   "approvalEligible","externalSecurityAuditAccepted"]){
  assert.throws(()=>checkedBetaResponse({...ok,[key]:true}),RangeError);
 }
 assert.throws(()=>checkedBetaResponse({...ok,requiredGates:[]}),RangeError);
});
test("M22 staging checker sends only a public credential-free GET and fails on bad responses",async()=>{
 const observed=[];
 const good=summarizeBetaReadiness(null);
 const request=async (url,options)=>{
  observed.push({url,options});
  return {status:200,headers:new Headers({"content-type":"application/json"}),
   text:async()=>JSON.stringify(good)};
 };
 const checked=await smokeBetaStaging("https://looke-staging.example.com",{request});
 assert.equal(checked.rpcObservation,"unverified");
 assert.equal(observed.length,1);
 assert.equal(observed[0].url,"https://looke-staging.example.com/api/beta/status");
 assert.equal(observed[0].options.method,"GET");
 assert.equal(observed[0].options.redirect,"error");
 assert.equal(observed[0].options.credentials,"omit");
 assert.equal(observed[0].options.cache,"no-store");
 await assert.rejects(smokeBetaStaging("https://looke-staging.example.com",{
  request:async()=>({status:503,headers:new Headers(),text:async()=>""})
 }),Error);
 await assert.rejects(smokeBetaStaging("https://looke-staging.example.com",{
  request:async()=>({status:200,headers:new Headers({"content-type":"text/html"}),
   text:async()=>"<html>no</html>"})
 }),Error);
});
test("M22 staging checker has no wallet, transaction or arbitrary browser control",()=>{
 const source=fs.readFileSync("scripts/m22-beta-smoke.mjs","utf8");
 assert.doesNotMatch(source,/eth_requestAccounts|personal_sign|privateKeyToAccount|signTypedData|\.writeContract|sendTransaction|\.deployContract/);
 assert.match(source,/LOOKE_BETA_SMOKE_ACK/);
 assert.match(source,/checkedBetaResponse/);
});
