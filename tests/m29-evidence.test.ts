import assert from "node:assert/strict";
import {test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {mkdtemp,writeFile,rm,symlink} from "node:fs/promises";
import {readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {canonicalManifestDigest,m29Manifest,m29ReviewMessage,verifyM29Packet} from "../src/lib/beta/m29-evidence-packet";
import {observerBinding,m29WalletPacket} from "../src/lib/beta/m29-wallet-crosscheck";
const keys=[privateKeyToAccount(bytesToHex(randomBytes(32))),privateKeyToAccount(bytesToHex(randomBytes(32)))];
const kinds=["wallet_sessions","hosted_media","creator_coin","native_uniq",
 "postgres_restore19","points_anti_sybil","security_audit","incident_rollback"] as const;
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),"looke-m29-"));
 const origin="https://looke-m29-ci.vercel.app",commit="a".repeat(40),recordedAt=new Date().toISOString();
 const artifacts=[] as {category:typeof kinds[number];filename:string;sha256:string}[];
 for(const kind of kinds){
  const filename=kind+".json",content="CI-FIXTURE-ONLY "+kind+"\n";
  await writeFile(join(root,filename),content);
  artifacts.push({category:kind,filename,sha256:createHash("sha256").update(content).digest("hex")});
 }
 const base={milestone:"M29" as const,origin,commit,recordedAt,artifacts,
  securityFindings:[{id:"CI001",severity:"high" as const,status:"open" as const,
   description:"Disposable test report finding, not an external audit."}]};
 const hash=canonicalManifestDigest(base);
 const reviewers=await Promise.all((["security","operator"] as const).map(async(role,i)=>{
  const wallet=keys[i].address.toLowerCase(),decision="hold" as const,signedAt=new Date().toISOString();
  const signature=await keys[i].signMessage({message:m29ReviewMessage({
   origin,commit,root:hash,role,wallet,decision,signedAt})});
  return {role,wallet,decision,signedAt,signature};
 }));
 return {root,packet:m29Manifest.parse({...base,reviewers}),hash};
}
async function checked<T>(fn:()=>Promise<T>){
 const oldS=process.env.LOOKE_M29_SECURITY_REVIEWERS,oldO=process.env.LOOKE_M29_OPERATOR_REVIEWERS;
 process.env.LOOKE_M29_SECURITY_REVIEWERS=keys[0].address;
 process.env.LOOKE_M29_OPERATOR_REVIEWERS=keys[1].address;
 try{return await fn();}finally{
  if(oldS===undefined)delete process.env.LOOKE_M29_SECURITY_REVIEWERS;
  else process.env.LOOKE_M29_SECURITY_REVIEWERS=oldS;
  if(oldO===undefined)delete process.env.LOOKE_M29_OPERATOR_REVIEWERS;
  else process.env.LOOKE_M29_OPERATOR_REVIEWERS=oldO;
 }
}
test("Eight actual disposable evidence files and two real signed review references cannot authorize GO",async()=>{
 await checked(async()=>{
  const f=await fixture();
  try{
   const result=await verifyM29Packet(f.packet,f.root);
   assert.equal(result.manifestSha256,f.hash);
   assert.equal(result.bytesConfirmed.length,8);
   assert.equal(result.eightActualFileHashesMatched,true);
   assert.equal(result.twoDistinctAllowlistedReviewerPublicKeys,true);
   assert.equal(result.originalAuditReportContentsReviewedByThisVerifier,false);
   assert.equal(result.independentHumanIdentityEstablished,false);
   assert.equal(result.realRestorationProven,false);
   assert.equal(result.launchDecision,"NO_GO");
   assert.equal(result.publicBetaOpen,false);
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
});
test("Original file tamper, duplicate source kind, symlink and path traversal are rejected",async()=>{
 await checked(async()=>{
  const f=await fixture();
  try{
   await writeFile(join(f.root,f.packet.artifacts[0].filename),"malicious replacement");
   await assert.rejects(()=>verifyM29Packet(f.packet,f.root),/bytes differ/);
   await assert.rejects(()=>verifyM29Packet({...f.packet,artifacts:[
    f.packet.artifacts[1],...f.packet.artifacts.slice(1)]},f.root),/eight uniquely named/);
   await assert.rejects(()=>verifyM29Packet({...f.packet,artifacts:[
    {...f.packet.artifacts[0],filename:"../escape.pdf"},...f.packet.artifacts.slice(1)]},f.root));
   await rm(join(f.root,f.packet.artifacts[0].filename));
   await symlink(join(f.root,f.packet.artifacts[1].filename),join(f.root,f.packet.artifacts[0].filename));
   await assert.rejects(()=>verifyM29Packet(f.packet,f.root));
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
});
test("Forged role, altered commit, bogus release decision and stale evidence fail closed",async()=>{
 await checked(async()=>{
  const f=await fixture();
  try{
   await assert.rejects(()=>verifyM29Packet({...f.packet,reviewers:[
    {...f.packet.reviewers[0],signature:f.packet.reviewers[1].signature},
    f.packet.reviewers[1]]},f.root),/did not sign/);
   await assert.rejects(()=>verifyM29Packet({...f.packet,commit:"b".repeat(40)},f.root),/did not sign/);
   await assert.rejects(()=>verifyM29Packet({...f.packet,reviewers:[
    {...f.packet.reviewers[0],decision:"GO"},f.packet.reviewers[1]]},f.root));
   await assert.rejects(()=>verifyM29Packet(f.packet,f.root,new Date(Date.now()+70*60000)),/within one hour/);
  }finally{await rm(f.root,{recursive:true,force:true});}
 });
});
test("Observer must acknowledge the genuine one-use nonce, original signature digest and immutable Preview",()=>{
 const message=observerBinding({origin:"https://looke-m29-ci.vercel.app",commit:"a".repeat(40)},
  {id:"11111111-1111-4111-8111-111111111111",wallet:keys[0].address.toLowerCase(),
   nonce:"c".repeat(32),signature_sha256:"b".repeat(64)},
  {observer:keys[1].address.toLowerCase(),observedAt:new Date().toISOString()});
 assert.match(message,/Original server nonce:/);
 assert.match(message,/Original wallet signature SHA-256:/);
 assert.match(message,/NO public beta/);
 assert.throws(()=>m29WalletPacket.parse({origin:"https://looke-m29-ci.vercel.app",
  commit:"a".repeat(40),sessions:[],releaseApproved:true}));
});
test("M29 HTTP route is moderator-only and cannot mutate production, finance or user activity",()=>{
 const source=readFileSync(resolve("src/app/api/social/ops/m29/route.ts"),"utf8");
 for(const required of ["requireViewer(req)","assertModerator(operator)","m28ReadOnly(req)",
  "social_beta_wallet_acceptances","social_beta_wallet_challenges","fullOperatorChecklist",
  "decision:\"NO_GO\""]){assert.ok(source.includes(required),required);}
 assert.ok(!source.includes("export async function POST("));
 for(const forbidden of ["eth_sendTransaction","writeContract(","request_rollback","setInterval("]){
  assert.ok(!source.includes(forbidden));
 }
});
