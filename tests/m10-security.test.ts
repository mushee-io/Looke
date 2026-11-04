import assert from "node:assert/strict";
import {test} from "node:test";
import {getAddress} from "viem";
import {BETA_GATES,completeGates,gate} from "../src/lib/beta/policy";
import {
  stagingUrl,isAuthenticationChallenge,probeProtectedStaging,
} from "../src/lib/ops/m10-protection";
import {
  distinctSources,safeUltraRpcUrl,compareEvmProofs,compareNativeProofs,
} from "../src/lib/ops/m10-crosscheck";
import {ULTRA_NATIVE_TESTNET} from "../src/lib/ultra-native";
import {verifiedTargetUniq} from "../src/lib/ops/m10-uniq";
import {createM10Review} from "../src/lib/ops/m10-review";
import {createAcceptancePacket} from "../src/lib/ops/m9-acceptance";
import {liquidityReport} from "../src/lib/ops/m9-liquidity";
import type {RpcEvidence} from "../src/lib/ops/m8-probe";
import type {DualRpcProof} from "../src/lib/ops/m10-crosscheck";

const rev="a".repeat(40);
const staging="https://looke-ultra-staging-git-check.vercel.app";
const providerA="evm.test.ultra.eosusa.io";
const providerB="evm-testnet.eosphere.io";
const now=new Date();
const seconds=Math.floor(now.getTime()/1000);

test("M10 adds an unskippable staging protection gate to all beta launches",()=>{
  assert.ok(BETA_GATES.includes("stagingProtection"));
  assert.equal(BETA_GATES.length,12);
  const complete=BETA_GATES.map(id=>gate(id,true,"pass",""));
  assert.equal(completeGates(complete,true),true);
  assert.equal(completeGates(complete.filter(x=>x.id!=="stagingProtection"),true),false);
  assert.equal(completeGates(complete.map(x=>x.id==="stagingProtection"?{...x,status:"blocked" as const}:x),true),false);
  assert.equal(completeGates(complete,false),false);
});

test("staging URLs cannot be HTTP, arbitrary hosts, another scheme or have credentials/paths",()=>{
  assert.equal(stagingUrl(staging).origin,staging);
  for(const url of [
    "http://looke-ultra-staging.vercel.app",
    "https://looke-ultra-staging.vercel.app.evil.com",
    "https://user:secret@looke-ultra-staging.vercel.app/",
    "https://looke-ultra-staging.vercel.app/secret",
    "https://looke-ultra-staging.vercel.app/?bypass=1",
    "https://127.0.0.1",
  ]) assert.throws(()=>stagingUrl(url));
});
test("only an identifiable Vercel auth challenge counts; not ordinary 404/302/200",()=>{
  assert.equal(isAuthenticationChallenge(401,new Headers({"x-vercel-id":"iad1","server":"Vercel"})),true);
  assert.equal(isAuthenticationChallenge(403,new Headers()),false);
  assert.equal(isAuthenticationChallenge(302,new Headers({location:"https://vercel.com/login?next=preview"})),true);
  assert.equal(isAuthenticationChallenge(302,new Headers({location:"https://attacker.example/login"})),false);
  assert.equal(isAuthenticationChallenge(302,new Headers({location:"/login"})),false);
  assert.equal(isAuthenticationChallenge(404,new Headers({"x-vercel-id":"iad1"})),false);
});
test("Vercel release requires exact project, safe env flags, matching READY Preview revision and signed-out auth",async()=>{
  const safeEnv=[];
  for(const target of ["preview","production"] as const){
    for(const key of ["LOOKE_PUBLIC_BETA_ENABLED","LOOKE_M4_TRADING_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_M6_EVIDENCE_ENABLED","LOOKE_M4_MARKETS_JSON"]){
      safeEnv.push({key,target,value:key==="LOOKE_M4_MARKETS_JSON"?"[]":"false"});
    }
  }
  const responses=[
    {name:"looke-ultra-staging",id:"prj_123",link:{repo:"mushee-io/looke",type:"github"},ssoProtection:{deploymentType:"all"}},
    {envs:safeEnv},
    {deployments:[{url:new URL(staging).hostname,readyState:"READY",target:"preview",meta:{githubCommitSha:rev}}]},
  ];
  const fakeFetch=((url:string|URL|Request,init?:RequestInit)=>{
    const text=String(url);
    if(text.startsWith("https://api.vercel.com/")){
      const value=text.includes("/env?")?responses[1]:
        text.includes("/deployments?")?responses[2]:responses[0];
      return Promise.resolve(new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}}));
    }
    if(text===new URL(staging).href&&init?.redirect==="manual"){
      return Promise.resolve(new Response(null,{status:302,
        headers:{location:"https://vercel.com/login?next=looke"}}));
    }
    return Promise.resolve(new Response(null,{status:404}));
  }) as typeof fetch;
  const opts={vercelToken:"test_only_token_1234",deploymentUrl:staging,expectedRevision:rev};
  const good=await probeProtectedStaging(opts,fakeFetch);
  assert.equal(good.status,"verified");
  assert.equal(good.publicBetaOpen,false);
  assert.equal(good.signedOutChallengeVerified,true);
  assert.equal((await probeProtectedStaging({...opts,expectedRevision:"b".repeat(40)},fakeFetch)).status,"blocked");
  assert.equal((await probeProtectedStaging({...opts,vercelToken:undefined},fakeFetch)).status,"blocked");
  assert.equal((await probeProtectedStaging({...opts,deploymentUrl:"https://wrong.vercel.app"},fakeFetch)).status,"blocked");
});
test("RPC independence rejects duplicate providers, chain mismatches and incorrect canonical hashes",()=>{
  assert.equal(safeUltraRpcUrl("https://evm.test.ultra.eosusa.io").hostname,providerA);
  assert.throws(()=>distinctSources("https://evm.test.ultra.eosusa.io","https://evm.test.ultra.eosusa.io"));
  assert.throws(()=>safeUltraRpcUrl("https://127.0.0.1"));
  assert.throws(()=>safeUltraRpcUrl("https://evm.eosusa.io.evil.net"));
  const common={chainId:18881,head:900n,commonBlock:895n,commonBlockHash:"0x"+"b".repeat(64),timestamp:seconds-20};
  assert.equal(compareEvmProofs({...common,hostname:providerA},{...common,hostname:providerB},seconds).status,"verified");
  assert.equal(compareEvmProofs({...common,hostname:providerA},{...common,hostname:providerA},seconds).status,"blocked");
  assert.equal(compareEvmProofs({...common,hostname:providerA},{...common,hostname:providerB,commonBlockHash:"0x"+"c".repeat(64)},seconds).status,"blocked");
  assert.equal(compareEvmProofs({...common,hostname:providerA},{...common,hostname:providerB,chainId:1},seconds).status,"blocked");
});
test("native irreversible proofs require matching block ID and distinct providers",()=>{
  const a={chainId:ULTRA_NATIVE_TESTNET.chainId,head:1000,irreversible:998,
    commonBlock:996,commonBlockId:"a".repeat(64),hostname:"native.eosphere.io"};
  const b={...a,hostname:"native.eosusa.io"};
  assert.equal(compareNativeProofs(a,b).status,"verified");
  assert.equal(compareNativeProofs(a,{...b,commonBlockId:"b".repeat(64)}).status,"blocked");
  assert.equal(compareNativeProofs(a,{...b,chainId:"wrong"}).status,"blocked");
  assert.equal(compareNativeProofs(a,{...b,hostname:a.hostname}).status,"blocked");
});
test("targeted native Uniq lookup can handle wallets with many assets but rejects wrong owner-scope proof",()=>{
  const page={rows:[{id:"9123",token_factory_id:"44"}],more:true,next_key:"9124",irreversibleBlock:100};
  assert.equal(verifiedTargetUniq(page,"9123","44").id,"9123");
  assert.throws(()=>verifiedTargetUniq(page,"9124","44"),/targeted/);
  assert.throws(()=>verifiedTargetUniq(page,"9123","45"),/targeted/);
  assert.throws(()=>verifiedTargetUniq({...page,irreversibleBlock:0},"9123","44"),/irreversible/);
});
test("M10 report always remains non-deploying and blocked without human approvals",()=>{
  const single:RpcEvidence={schemaVersion:1,generatedAt:now.toISOString(),source:"live-testnet-read-only",
    repositoryRevision:null,evm:{status:"blocked",reason:"no RPC"},native:{status:"blocked",reason:"no RPC"},
    allVerified:false,betaActivated:false,walletTransactions:0};
  const dual:DualRpcProof={source:"two-independent-ultra-testnet-rpcs",observedAt:now.toISOString(),
    evm:{status:"blocked",reason:"no second RPC"},native:{status:"blocked",reason:"no second RPC"},
    allVerified:false,readOnly:true,transactions:0,betaActivated:false};
  const liquidity=liquidityReport([]);
  const stagingProof={status:"blocked" as const,metadataVerified:false,signedOutChallengeVerified:false,
    project:"looke-ultra-staging",deploymentOrigin:null,checkedAt:now.toISOString(),
    reason:"not deployed",publicBetaOpen:false as const};
  const prior=createAcceptancePacket({
    rpc:single,liquidity,db:null,stagingProtectionVerified:false,
    factoryReceiptVerified:false,coinReceiptVerified:false,uniqOwnershipVerified:false,
    walletWitnessVerified:false,securityApproved:false,operatorApproved:false,
    rollbackDrillPassed:true,flags:{LOOKE_PUBLIC_BETA_ENABLED:"false"},
  });
  const result=createM10Review({singleRpc:single,dualRpc:dual,liquidity,
    staging:stagingProof,socialDatabase:null,priorPacket:prior});
  assert.equal(result.status,"blocked");
  assert.equal(result.publicBetaOpen,false);
  assert.equal(result.submittedTransactions,0);
  assert.equal(result.manualReviewRequired,true);
  assert.ok(result.blocked.includes("protectedDeployment"));
});
