import assert from "node:assert/strict";
import {test} from "node:test";
import {NextRequest} from "next/server";
import {GET} from "../src/app/api/experience/m34-final/route";
test("M34 API is Preview-only, rejects unexpected queries, and never opens beta",async()=>{
 const prior=process.env.VERCEL_ENV;
 const flag=process.env.LOOKE_PUBLIC_BETA_ENABLED;
 const request=(q:string)=>new NextRequest("https://looke.example/api/experience/m34-final"+q);
 try{
  process.env.VERCEL_ENV="production";
  assert.equal((await GET(request("?mode=config"))).status,404);
  process.env.VERCEL_ENV="preview";
  process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
  assert.equal((await GET(request("?mode=unsupported"))).status,400);
  assert.equal((await GET(request("?mode=config&mode=live"))).status,400);
  const response=await GET(request("?mode=config"));
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.releaseDecision,"NO_GO");
  assert.equal(data.liveSourcesQueried,false);
  assert.equal(data.underlyingM33ReadAttempted,false);
  assert.equal(data.publicBetaOpen,false);
  assert.equal(data.transactionsSent,0);
  assert.equal(data.databasesModified,0);
  assert.equal(response.headers.get("cache-control"),"private, no-store");
 }finally{
  if(prior===undefined)delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV=prior;
  if(flag===undefined)delete process.env.LOOKE_PUBLIC_BETA_ENABLED;
  else process.env.LOOKE_PUBLIC_BETA_ENABLED=flag;
 }
});
