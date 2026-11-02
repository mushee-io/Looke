import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {hashTypedData,recoverTypedDataAddress,keccak256,zeroAddress} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {contentSnapshot} from "../lib/content-coin.mjs";
import {reviewedContentSource,verifiedFactoryObservations,unsignedContentPermit} from "../lib/attestation-review.mjs";

const creator="0x1111111111111111111111111111111111111111";
const factory="0x2222222222222222222222222222222222222222";
const attestor="0x3333333333333333333333333333333333333333";
const postId="ed827d1a-a415-4b6a-8a5c-d47ec09dd931";
const metadataURI="ipfs://Qm"+"a".repeat(44)+"/metadata.json";
const code="0x6001600055";
const codeHash=keccak256(code);
function row(){
 const snapshot=contentSnapshot(postId,creator,"Author's current visible post");
 return {
  post_id:postId,profile_id:"profile-1",post_profile_id:"profile-1",
  draft_profile_id:"profile-1",profile_evm_address:creator,creator_address:creator,
  post_text:"Author's current visible post",current_edited_at:null,source_edited_at:null,
  moderation_status:"visible",report_count:0,content_ref:snapshot.contentRef,
  source_text_hash:snapshot.textHash,ref_version:"looke.content.v1",
  name:"Author Post",symbol:"POST",supply_tokens:"1000",metadata_uri:metadataURI
 };
}
const observation=()=>({chainId:18881,blockHash:"0x"+"a".repeat(64),
 blockTimestamp:1800000000n,code,attestor,nonce:0n,existingCoin:zeroAddress});
const config={factory,attestor,codeHash};

test("operator permit is unsigned but its EIP-712 digest can be checked by a real signer offline",async()=>{
 const source=reviewedContentSource(row());
 const chain=verifiedFactoryObservations(observation(),observation(),config);
 const permit=unsignedContentPermit(source,chain);
 assert.equal(permit.signed,false);
 assert.equal(permit.issuanceEnabled,false);
 assert.equal(permit.manualApprovalRequired,true);
 assert.equal(permit.typedData.domain.verifyingContract,factory);
 assert.equal(permit.typedData.domain.chainId,18881);
 assert.equal(permit.typedData.message.creator,creator);
 assert.equal(permit.typedData.message.nonce,0n);
 assert.equal(permit.typedData.message.deadline,1800000300n);
 assert.equal(permit.digest,hashTypedData(permit.typedData));
 // Throwaway key only in tests. No server or deployment signing path exists.
 const signer=privateKeyToAccount("0x"+"55".repeat(32));
 const signature=await signer.signTypedData(permit.typedData);
 assert.equal(await recoverTypedDataAddress({...permit.typedData,signature}),signer.address);
 const bad={...permit.typedData,message:{...permit.typedData.message,nonce:1n}};
 assert.notEqual(hashTypedData(bad),permit.digest);
});
test("review fails closed for stale posts, mismatched author, reports and invalid drafts",()=>{
 const changes=[
  r=>r.post_profile_id="another",
  r=>r.draft_profile_id="another",
  r=>r.profile_evm_address="0x4444444444444444444444444444444444444444",
  r=>r.creator_address="0x5555555555555555555555555555555555555555",
  r=>r.moderation_status="hidden",
  r=>r.moderation_status="deleted",
  r=>r.report_count=1,
  r=>r.report_count=null,
  r=>r.post_text="Post edited after snapshot",
  r=>r.current_edited_at="2026-01-01T00:00:00.000Z",
  r=>r.source_edited_at="2026-01-01T00:00:00.000Z",
  r=>r.content_ref="0x"+"f".repeat(64),
  r=>r.source_text_hash="0x"+"f".repeat(64),
  r=>r.ref_version="untrusted-v2",
  r=>r.supply_tokens="1000000001",
  r=>r.metadata_uri="https://example.com/danger",
  r=>r.post_id="not-a-uuid"
 ];
 for(const change of changes){
  const r=row();change(r);
  assert.throws(()=>reviewedContentSource(r),RangeError);
 }
});
test("two-RPC verified factory rejects unpinned code, wrong chain, attestor, state and fork",()=>{
 const mutators=[
  r=>r.chainId=1,
  r=>r.blockHash="0x"+"f".repeat(64),
  r=>r.code="0x6002",
  r=>r.code="0x",
  r=>r.attestor="0x4444444444444444444444444444444444444444",
  r=>r.nonce=1n,
  r=>r.existingCoin="0x4444444444444444444444444444444444444444"
 ];
 for(const change of mutators){
  const b=observation();change(b);
  assert.throws(()=>verifiedFactoryObservations(observation(),b,config),RangeError);
 }
 assert.throws(()=>verifiedFactoryObservations(observation(),observation(),
  {...config,codeHash:"0x"+"a".repeat(64)}),RangeError);
 assert.throws(()=>verifiedFactoryObservations(observation(),observation(),
  {...config,attestor:zeroAddress}),RangeError);
});
test("content-only, no trend approval and no browser signer or transaction submission",()=>{
 const source=reviewedContentSource(row());
 const observed=verifiedFactoryObservations(observation(),observation(),config);
 assert.throws(()=>unsignedContentPermit({...source,kind:2},observed),RangeError);
 assert.throws(()=>unsignedContentPermit({...source,kind:0},observed),RangeError);
 assert.throws(()=>unsignedContentPermit(source,{...observed,nonce:-1n}),RangeError);
 const route=fs.readFileSync("app/api/operator/attestor/review/route.ts","utf8");
 assert.match(route,/LOOKE_ATTESTATION_REVIEW_SECRET/);
 assert.match(route,/LOOKE_ATTESTATION_REVIEW_ENABLED/);
 assert.match(route,/checkedIndependentRpc/);
 assert.match(route,/reviewedContentSource/);
 assert.match(route,/post_profile_id/);
 assert.match(route,/look[e]?_post_reports/);
 assert.match(route,/manualApprovalRequired:true/);
 assert.doesNotMatch(route,/signTypedData|privateKeyToAccount|\.writeContract\(|sendTransaction\(|sendRawTransaction\(/);
 assert.doesNotMatch(route,/NEXT_PUBLIC_.*ATTESTOR/);
});