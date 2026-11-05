import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {NextRequest} from "next/server";
import {parseM33ProofInput,m33Configuration,m33ProofResult,M33InvalidInput} from "../src/lib/beta/m33-live-integration";
import {GET} from "../src/app/api/experience/m33-live/route";
import {ULTRA_NATIVE_TESTNET} from "../src/lib/ultra-native";
const address="0x1111111111111111111111111111111111111111";
const tx="0x"+"a".repeat(64);
const parse=(q:string)=>parseM33ProofInput(new URLSearchParams(q));
test("M33 validates exact EVM deployment and creator proof inputs, rejecting injection and zero hashes",()=>{
 assert.deepEqual(parse("mode=proof&kind=factory&address="+address+"&tx="+tx),
  {kind:"factory",address,tx});
 assert.equal(parse("mode=proof&kind=coin&address="+address+"&tx="+tx).kind,"coin");
 for(const q of ["kind=coin&address="+address+"&tx=0x"+"0".repeat(64),
  "kind=factory&address="+address+"&tx=nope",
  "kind=coin&address="+address+"&tx="+tx+"&tx="+tx,
  "kind=coin&address="+address+"&tx="+tx+"&rpc=https://unsafe.invalid",
  "kind=uniq&factoryId=1&tokenId=2&owner=alice&tx="+tx,
  "kind=coin&address="+address+"&tx="+tx+"&owner=alice"]){
  assert.throws(()=>parse(q),M33InvalidInput);
 }
});
test("M33 native Uniq verification accepts bounded Ultra account and IDs only",()=>{
 assert.deepEqual(parse("mode=proof&kind=uniq&owner=alice&factoryId=12&tokenId=15"),
  {kind:"uniq",owner:"alice",factoryId:"12",tokenId:"15"});
 for(const q of ["kind=uniq&owner=Alice&factoryId=12&tokenId=15",
  "kind=uniq&owner=alice&factoryId=0&tokenId=1",
  "kind=uniq&owner=alice&factoryId=1&tokenId=99999999999999999999999",
  "kind=uniq&owner=alice&factoryId=1&tokenId=1&address="+address])
  assert.throws(()=>parse(q),M33InvalidInput);
});
test("Source proof response is bounded and never infers a human or release authorization",()=>{
 const evm=m33ProofResult({kind:"factory",address,tx},{
  chainId:18881,address,transactionHash:tx,confirmations:3,coinCount:"0",
  secret:"must-not-leak"});
 assert.equal(evm.verified,true);
 assert.equal(evm.releaseDecision,"NO_GO");
 assert.equal(evm.transactionsSent,0);
 assert.ok(!JSON.stringify(evm).includes("must-not-leak"));
 assert.throws(()=>m33ProofResult({kind:"factory",address,tx},
  {chainId:1,address,transactionHash:tx,confirmations:3}));
 assert.throws(()=>m33ProofResult({kind:"factory",address,tx},
  {chainId:18881,address,transactionHash:tx,confirmations:1}));
 const native=m33ProofResult({kind:"uniq",owner:"alice",factoryId:"1",tokenId:"2"},{
  owner:"alice",factoryId:"1",tokenId:"2",chainId:ULTRA_NATIVE_TESTNET.chainId,
  irreversibleBlock:100,hugeUntrustedMetadata:"hide"});
 assert.equal(native.verified,true);
 assert.ok(!JSON.stringify(native).includes("hide"));
 assert.throws(()=>m33ProofResult({kind:"uniq",owner:"alice",factoryId:"1",tokenId:"2"},{
  owner:"eve",factoryId:"1",tokenId:"2",chainId:"native",irreversibleBlock:100}));
});
test("M33 configuration values cannot bypass release NO-GO or imply media ownership",()=>{
 const c=m33Configuration({DATABASE_URL:"postgres://password@host/db",
  LOOKE_CLOUDINARY_CLOUD_NAME:"demo",LOOKE_CLOUDINARY_API_KEY:"123456",
  LOOKE_CLOUDINARY_API_SECRET:"secret",LOOKE_PUBLIC_BETA_ENABLED:"false"});
 assert.equal(c.flagsClosed,true);
 assert.equal(c.postgresConfigured,true);
 assert.equal(c.cloudinaryConfigured,true);
 assert.equal(c.liveRPCVerifiedByConfig,false);
 assert.equal(c.actualMediaAssetVerifiedByConfig,false);
 assert.equal(c.releaseDecision,"NO_GO");
 assert.ok(!JSON.stringify(c).includes("password"));
 const bad=m33Configuration({LOOKE_PUBLIC_BETA_ENABLED:"true"});
 assert.equal(bad.flagsClosed,false);
 assert.equal(bad.releaseDecision,"NO_GO");
});
test("M33 Preview API has no auto live network use; forbidden flags, invalid proofs and prod are denied",async()=>{
 const old={VERCEL_ENV:process.env.VERCEL_ENV,LOOKE_PUBLIC_BETA_ENABLED:process.env.LOOKE_PUBLIC_BETA_ENABLED};
 const req=(query:string)=>new NextRequest("https://example.invalid/api/experience/m33-live"+query);
 try{
  process.env.VERCEL_ENV="production";
  assert.equal((await GET(req("?mode=config"))).status,404);
  process.env.VERCEL_ENV="preview";
  process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
  const r=await GET(req("?mode=config"));
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.liveRPCChecksPerformed,false);
  assert.equal(body.postgresQueried,false);
  assert.equal(body.releaseDecision,"NO_GO");
  assert.equal((await GET(req("?mode=proof&kind=factory&address=no&tx=bad"))).status,400);
  assert.equal((await GET(req("?mode=invalid"))).status,400);
  process.env.LOOKE_PUBLIC_BETA_ENABLED="true";
  const blocked=await GET(req("?mode=config"));
  assert.equal(blocked.status,503);
  assert.equal((await blocked.json()).releaseDecision,"NO_GO");
 }finally{
  for(const k of Object.keys(old) as (keyof typeof old)[])
   if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
 }
});
test("M33 implementation has no wallet signing, transactional broadcast, migration or automated activity",()=>{
 const paths=["src/lib/beta/m33-live-integration.ts",
  "src/app/api/experience/m33-live/route.ts"];
 for(const p of paths){
  const source=readFileSync(p,"utf8");
  for(const forbidden of ["eth_sendTransaction","sendTransaction(","writeContract(","INSERT INTO",
   "UPDATE social_","DELETE FROM","ALTER TABLE","CREATE TABLE","setInterval(","cron.schedule("])
   assert.equal(source.includes(forbidden),false,p+": forbidden mutation "+forbidden);
 }
});
