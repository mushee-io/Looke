import assert from "node:assert/strict";
import {test} from "node:test";
import {inspectM33HostedMedia} from "../src/lib/beta/m33-live-integration";
const provider={cloudName:"looke_test",apiKey:"123456789",apiSecret:"private-test-string-do-not-publish"};
test("M33 calls the actual authenticated Cloudinary Search endpoint for Looke assets without returning private rows",async()=>{
 let requested="",options:RequestInit|null=null;
 const mock=async(input:RequestInfo|URL,init?:RequestInit)=>{
  requested=String(input);options=init||{};
  return new Response(JSON.stringify({total_count:0,resources:[]}),{status:200});
 };
 const result=await inspectM33HostedMedia(provider,mock as typeof fetch);
 assert.equal(result.status,"authenticated_prefix_search");
 assert.equal(result.providerVerified,true);
 assert.equal(result.matchingLookePrefixAssets,0);
 assert.equal(result.approvedCreatorUploads,0);
 assert.equal(result.realModerationVerified,false);
 assert.equal(requested,"https://api.cloudinary.com/v1_1/looke_test/resources/search");
 assert.equal(options?.method,"POST");
 assert.equal(options?.redirect,"error");
 const body=JSON.parse(String(options?.body));
 assert.equal(body.expression,"public_id:looke*");
 assert.equal(body.max_results,1);
 assert.ok(!JSON.stringify(result).includes(provider.apiSecret));
});
test("M33 refuses malicious provider hosts, malformed numeric counts and failed provider authentication",async()=>{
 const noCall=async()=>{throw Error("Should not call external untrusted host");};
 await assert.rejects(()=>inspectM33HostedMedia({...provider,cloudName:"evil.com/x"},noCall as typeof fetch));
 await assert.rejects(()=>inspectM33HostedMedia(provider,
  (async()=>new Response(JSON.stringify({total_count:"123"}),{status:200})) as typeof fetch),
  /Malformed provider count/);
 await assert.rejects(()=>inspectM33HostedMedia(provider,
  (async()=>new Response("Forbidden",{status:401})) as typeof fetch),
  /source unavailable/);
});
