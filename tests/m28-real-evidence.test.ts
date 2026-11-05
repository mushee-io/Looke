import assert from "node:assert/strict";
import {test} from "node:test";
import {randomBytes,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {walletSessionMessage,observerMessage,verifyDualSessionPacket,
 inspectProviderRows,finalM28Decision} from "../src/lib/beta/m28-real-evidence";
import type {DualSessionPacket,ApprovedMediaRow} from "../src/lib/beta/m28-real-evidence";

const keys=Array.from({length:4},()=>privateKeyToAccount(bytesToHex(randomBytes(32))));
const context={origin:"https://looke-real-witness-test.vercel.app",commit:"a".repeat(40),chainId:18881 as const};
async function packet(now=new Date()){
 const sessions=[] as DualSessionPacket["sessions"][number][];
 for(let i=0;i<2;i++){
  const draft={wallet:keys[i].address.toLowerCase(),observer:keys[i+2].address.toLowerCase(),
   nonce:randomUUID(),sessionId:randomUUID(),observedAt:now.toISOString()};
  const walletSignature=await keys[i].signMessage({message:walletSessionMessage(context,draft)});
  const signed={...draft,walletSignature};
  const observerSignature=await keys[i+2].signMessage({message:observerMessage(context,{...signed,
   observerSignature:"0x"+"0".repeat(130)})});
  sessions.push({...signed,observerSignature});
 }
 return {...context,sessions:sessions as DualSessionPacket["sessions"]};
}
test("Four actual ephemeral EIP-191 signatures show wallet/observer key control, NOT four people",async()=>{
 const now=new Date();
 const input=await packet(now);
 const accepted=await verifyDualSessionPacket(input,now);
 assert.equal(accepted.cryptographicWalletProofs,2);
 assert.equal(accepted.observerKeys,2);
 assert.equal(accepted.independentlyWitnessedRealHumans,false);
 assert.equal(accepted.personallyVerifiedHumanIdentity,false);
 assert.equal(accepted.releaseAuthorized,false);
 await assert.rejects(()=>verifyDualSessionPacket({...input,commit:"b".repeat(40)},now));
 await assert.rejects(()=>verifyDualSessionPacket({...input,sessions:[
  input.sessions[0],{...input.sessions[1],observerSignature:input.sessions[0].observerSignature},
 ]},now));
 await assert.rejects(()=>verifyDualSessionPacket({...input,sessions:[
  input.sessions[0],{...input.sessions[1],nonce:input.sessions[0].nonce},
 ]},now),/distinct nonce/);
 await assert.rejects(()=>verifyDualSessionPacket({...input,sessions:[
  input.sessions[0],{...input.sessions[1],observer:input.sessions[0].wallet},
 ]},now),/distinct independent public/);
 await assert.rejects(()=>verifyDualSessionPacket(input,new Date(now.getTime()+6*60000)),/fresh/);
 await assert.rejects(()=>verifyDualSessionPacket({...input,publicBetaOpen:true},now));
});
test("Authenticated hosted media verification fails closed for missing records and fake moderation",async()=>{
 const empty=await inspectProviderRows([]);
 assert.equal(empty.status,"blocked");
 assert.equal(empty.realProviderInspected,false);
 const owner=keys[0].address.toLowerCase();
 const media:ApprovedMediaRow={post_id:randomUUID(),owner,
  public_id:"looke/social/"+owner+"/"+randomUUID(),
  kind:"image",mime:"image/png",declared_bytes:235,moderation_count:0,
  media_url:"https://res.cloudinary.com/m28ci/image/upload/v1/missing.png"};
 // No provider credentials or request may turn a nonexistent moderator approval into a verified row.
 const previous=[process.env.LOOKE_CLOUDINARY_CLOUD_NAME,process.env.LOOKE_CLOUDINARY_API_KEY,
  process.env.LOOKE_CLOUDINARY_API_SECRET] as const;
 process.env.LOOKE_CLOUDINARY_CLOUD_NAME="m28ci";
 process.env.LOOKE_CLOUDINARY_API_KEY="1234567890";
 process.env.LOOKE_CLOUDINARY_API_SECRET="test-only-secret-more-than-20-chars";
 try{
  const invalid=await inspectProviderRows([media]);
  assert.equal(invalid.status,"blocked");
  assert.equal(invalid.verified,0);
 }finally{
  const names=["LOOKE_CLOUDINARY_CLOUD_NAME","LOOKE_CLOUDINARY_API_KEY","LOOKE_CLOUDINARY_API_SECRET"];
  names.forEach((name,i)=>{const value=previous[i];if(value===undefined)delete process.env[name];else process.env[name]=value;});
 }
 await assert.rejects(()=>inspectProviderRows([media,media,media,media]),/Bounded/);
});
test("Full technical signals cannot independently authorize public beta",()=>{
 const result=finalM28Decision({walletProofs:2,providerVerified:true,chainToken:true,chainUniq:true,
  pointsComplete:true,pointsDrift:0,restore19Matched:true,realHumanApproval:true,
  securityAuditorContentsVerified:true,rollbackWitnessVerified:true});
 assert.equal(result.decision,"NO_GO");
 assert.equal(result.publicBetaOpen,false);
 assert.equal(result.launchAuthorized,false);
 assert.equal(result.productionChangeAllowed,false);
 assert.equal(result.financialBroadcastAllowed,false);
 assert.equal(result.socialMediaWritesAllowed,false);
 assert.equal(result.genuineHumanIndependentApprovalAccepted,false);
 assert.deepEqual(result.blockers,[]);
 const noProof=finalM28Decision({walletProofs:0,providerVerified:false,chainToken:false,
  chainUniq:false,pointsComplete:false,pointsDrift:3,restore19Matched:false,
  realHumanApproval:false,securityAuditorContentsVerified:false,
  rollbackWitnessVerified:false});
 assert.equal(noProof.decision,"NO_GO");
 assert.ok(noProof.blockers.length>=9);
});
test("M28 API is moderator-only, source-backed, and has NO write/broadcast routes",()=>{
 const s=readFileSync(resolve("src/app/api/social/ops/m28/route.ts"),"utf8");
 const cli=readFileSync(resolve("scripts/m28-verify-wallet-evidence.ts"),"utf8");
 for(const required of ["requireViewer(req)","assertModerator(operator)","m27ReadOnly(req)",
  "social_media_uploads","social_moderation_audit","inspectProviderRows",
  "inspectEvmCoin","inspectNativeUniq","finalM28Decision","releaseAuthorized"]){
  if(required==="releaseAuthorized")continue;
  assert.ok(s.includes(required),required);
 }
 assert.ok(!s.includes("export async function POST("));
 for(const bad of ["eth_sendTransaction","writeContract(","setInterval(","request_rollback"]){
  assert.ok(!s.includes(bad));assert.ok(!cli.includes(bad));
 }
 assert.ok(cli.includes("verifyDualSessionPacket"));
 assert.ok(cli.includes("independentlyConfirmedInPerson:false"));
});
