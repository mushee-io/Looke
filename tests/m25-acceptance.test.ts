import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {resolve} from "node:path";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {requiredReleaseProofs} from "../src/lib/beta/m24-review";
import {
 m25Gate,m25ReviewBody,m25ReviewMessage,m25AuditorAllowed,verifyM25Review,
 m25WritesEnabled,signatureHash,finalOperatorReviewGate,
} from "../src/lib/beta/m25-register";
const read=(p:string)=>readFileSync(resolve(p),"utf8");
const op=privateKeyToAccount(bytesToHex(randomBytes(32)));
const ext=privateKeyToAccount(bytesToHex(randomBytes(32)));
const alien=privateKeyToAccount(bytesToHex(randomBytes(32)));
const identity={origin:"https://looke-m25-protected.vercel.app",sha:"a".repeat(40)};
const hash="f".repeat(64);
const gate="independent_security_audit_content_hash_and_signoff" as const;
const at="2026-11-05T10:00:00.000Z";
const base={
 action:"record_review" as const,gate,
 evidenceId:"11111111-1111-4111-8111-111111111111",
 externalReviewer:ext.address.toLowerCase(),
 decision:"reviewed_reference_only" as const,observedAt:at,
};
const now=new Date("2026-11-05T10:02:00.000Z");
test("M25 has exactly 11 evidence gates and cannot accept synthetic go-live fields",()=>{
 assert.deepEqual(m25Gate.options,requiredReleaseProofs);
 const legal=m25ReviewBody.parse({...base,signature:"0x"+"a".repeat(130)});
 assert.equal(legal.action,"record_review");
 assert.throws(()=>m25ReviewBody.parse({...legal,publicBetaOpen:true}));
 assert.throws(()=>m25ReviewBody.parse({...legal,releaseDecision:"GO"}));
 assert.throws(()=>m25ReviewBody.parse({...legal,decision:"approved_launch"}));
 assert.throws(()=>m25ReviewBody.parse({...legal,evidenceId:"unstructured"}));
 assert.throws(()=>m25ReviewBody.parse({...legal,signature:"not-a-signature"}));
});
test("Separate actual EIP-191 reviewer key proves reference acknowledgement only",async()=>{
 const message=m25ReviewMessage(base,identity,hash);
 assert.match(message,/No public beta, finance, token claims/);
 const signature=await ext.signMessage({message});
 const input=m25ReviewBody.parse({...base,signature});
 const prior=process.env.LOOKE_M25_EXTERNAL_REVIEWERS;
 try{
  process.env.LOOKE_M25_EXTERNAL_REVIEWERS=ext.address;
  const checked=await verifyM25Review(input,{
   identity,artifactHash:hash,operator:op.address.toLowerCase(),now});
  assert.equal(checked.valid,true);
  assert.match(checked.reason,/Artifact contents/);
  const wrong=await alien.signMessage({message});
  assert.equal((await verifyM25Review({...input,signature:wrong},{
    identity,artifactHash:hash,operator:op.address.toLowerCase(),now})).valid,false);
  assert.equal((await verifyM25Review(input,{
   identity:{...identity,sha:"b".repeat(40)},artifactHash:hash,
   operator:op.address.toLowerCase(),now})).valid,false);
  assert.equal((await verifyM25Review(input,{
   identity,artifactHash:"e".repeat(64),operator:op.address.toLowerCase(),now})).valid,false);
  assert.equal((await verifyM25Review(input,{
   identity,artifactHash:hash,operator:op.address.toLowerCase(),
   now:new Date("2026-11-05T10:08:00.000Z")})).valid,false);
  assert.equal(m25AuditorAllowed(ext.address,gate,ext.address),false);
  assert.equal(signatureHash(signature).length,64);
 }finally{if(prior===undefined)delete process.env.LOOKE_M25_EXTERNAL_REVIEWERS;
  else process.env.LOOKE_M25_EXTERNAL_REVIEWERS=prior;}
});
test("M25 external release reviewers use a distinct allowlist and cannot self-review",()=>{
 const prev=process.env.LOOKE_M25_RELEASE_REVIEWERS;
 const prev2=process.env.LOOKE_M25_EXTERNAL_REVIEWERS;
 try{
  process.env.LOOKE_M25_EXTERNAL_REVIEWERS=ext.address;
  process.env.LOOKE_M25_RELEASE_REVIEWERS="";
  assert.equal(m25AuditorAllowed(ext.address,"explicit_operator_public_beta_go_live_authorization",op.address),false);
  process.env.LOOKE_M25_RELEASE_REVIEWERS=ext.address;
  assert.equal(m25AuditorAllowed(ext.address,"explicit_operator_public_beta_go_live_authorization",op.address),true);
  assert.equal(m25AuditorAllowed(op.address,gate,op.address),false);
 }finally{
  if(prev===undefined)delete process.env.LOOKE_M25_RELEASE_REVIEWERS;
  else process.env.LOOKE_M25_RELEASE_REVIEWERS=prev;
  if(prev2===undefined)delete process.env.LOOKE_M25_EXTERNAL_REVIEWERS;
  else process.env.LOOKE_M25_EXTERNAL_REVIEWERS=prev2;
 }
});
test("Even perfect technical status and signed human assertions NEVER trigger a GO release",()=>{
 const review=finalOperatorReviewGate({
  m24Decision:"GO",flagsClosed:true,
  reviews:requiredReleaseProofs.map(gate=>({gate,decision:"reviewed_reference_only"})),
  humanWitnessAccepted:true,restoreWitnessAccepted:true,
  auditContentsVerified:true,providerVerified:true,
 });
 assert.equal(review.decision,"NO_GO");
 assert.equal(review.publicBetaOpen,false);
 assert.equal(review.canActivate,false);
 assert.equal(review.productionPromotionApproved,false);
 assert.equal(review.pointsAccountingEnabled,false);
 assert.equal(review.tokenClaimsEnabled,false);
 assert.equal(review.financialTransactionsEnabled,false);
 assert.equal(review.privateMessagingEnabled,false);
 assert.equal(review.transactionsSent,0);
 assert.equal(review.unresolvedReleaseGates,11);
 assert.ok(review.reviewGates.every(g=>g.missingIndependentProof));
 const disabled=finalOperatorReviewGate({m24Decision:"NO_GO",flagsClosed:false,
  reviews:[],humanWitnessAccepted:false,restoreWitnessAccepted:false,
  auditContentsVerified:false,providerVerified:false});
 assert.equal(disabled.decision,"NO_GO");
});
test("No release or financial post; operator write flag defaults to disabled",()=>{
 const route=read("src/app/api/social/ops/m25/route.ts");
 const ddl=read("db/migrations/010_operator_release_evidence.sql");
 for(const s of ["requireViewer(req)","assertModerator(actor)","verifyRequestOrigin(req)",
  "m25WritesEnabled()","verifyM25Review","count(DISTINCT a.wallet)",
  "JOIN social_beta_wallet_challenges","ON CONFLICT DO NOTHING",
  "FROM social_beta_evidence_signatures WHERE id=$1 AND preview_sha=$2"]){
  assert.ok(route.includes(s),s);
 }
 assert.match(ddl,/beta_release_authorized boolean NOT NULL DEFAULT false CHECK\(beta_release_authorized=false\)/);
 assert.match(ddl,/production_changed boolean NOT NULL DEFAULT false CHECK\(production_changed=false\)/);
 assert.ok(!route.includes("writeContract("));
 assert.ok(!route.includes("request_rollback"));
 assert.ok(!route.includes("eth_sendTransaction"));
 assert.ok(!route.includes("setInterval("));
 const prior=process.env.LOOKE_M25_REVIEW_WRITES_ENABLED;
 delete process.env.LOOKE_M25_REVIEW_WRITES_ENABLED;
 try{assert.equal(m25WritesEnabled(),false);
  process.env.LOOKE_M25_REVIEW_WRITES_ENABLED="true";
  assert.equal(m25WritesEnabled(),true);
 }finally{if(prior===undefined)delete process.env.LOOKE_M25_REVIEW_WRITES_ENABLED;
  else process.env.LOOKE_M25_REVIEW_WRITES_ENABLED=prior;}
});
