import assert from "node:assert/strict";
import { test } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  BETA_GATES, acceptanceEvidence, completeGates, gate, parseAcceptance,
  releaseText, requiredRevision, validEvmAddress, validHash, validReleaseSignature,
  type ReleaseConfig,
} from "../src/lib/beta/policy";

const reviewer="0x1111111111111111111111111111111111111111";
const revision="a".repeat(40);
const fixed=new Date("2026-11-04T16:00:00.000Z");
function evidence(){
  return {url:"https://github.com/mushee-io/looke/pull/5",reviewer,reviewedAt:"2026-11-04T15:00:00.000Z"};
}

test("M6 fails closed without a complete set of independently verified gates",()=>{
  const gates=BETA_GATES.map(id=>gate(id,false,"","blocked"));
  assert.equal(gates.length,11);
  assert.equal(completeGates(gates,false),false);
  assert.equal(completeGates(gates,true),false);
  assert.equal(completeGates(BETA_GATES.map(id=>gate(id,true,"verified","")),false),false);
  const yes=BETA_GATES.map(id=>gate(id,true,"verified",""));
  assert.equal(completeGates(yes,true),true);
  assert.equal(completeGates([...yes,yes[0]],true),false);
  assert.equal(completeGates(yes.slice(1),true),false);
});

test("rejects untrusted, malformed, stale or non-HTTPS operator evidence",()=>{
  assert.deepEqual(acceptanceEvidence(evidence(),fixed),evidence());
  assert.throws(()=>acceptanceEvidence({...evidence(),url:"http://github.com/mushee-io/looke/pull/5"},fixed),/Evidence/);
  assert.throws(()=>acceptanceEvidence({...evidence(),url:"https://attacker.example/pull/5"},fixed),/Evidence/);
  assert.throws(()=>acceptanceEvidence({...evidence(),reviewedAt:"2025-09-01T00:00:00Z"},fixed),/30 days/);
  assert.throws(()=>acceptanceEvidence({...evidence(),reviewer:"0x000"},fixed),/reviewer/);
  assert.throws(()=>parseAcceptance(undefined,fixed),/not been configured/);
  const parsed=parseAcceptance(JSON.stringify({walletAcceptance:evidence(),securityReview:evidence(),operationsApproval:evidence()}),fixed);
  assert.equal(parsed.operationsApproval.reviewer,reviewer);
});

test("deployment revision must be a real Git commit; hash and address validators reject fake inputs",()=>{
  assert.equal(requiredRevision(revision),revision);
  assert.throws(()=>requiredRevision("main"),/40-character/);
  assert.equal(validEvmAddress(reviewer),true);
  assert.equal(validEvmAddress("0x"+"0".repeat(40)),false);
  assert.equal(validHash("0x"+"c".repeat(64)),true);
  assert.equal(validHash("0xhello"),false);
});

test("public beta release must be a valid, fresh, revision-bound wallet signature",async()=>{
  const account=privateKeyToAccount("0x"+"b".repeat(64));
  const expires="2026-11-04T19:00:00.000Z";
  const msg=releaseText(revision,expires);
  assert.match(msg,/authorize the explicitly reviewed PUBLIC TESTNET BETA release only/);
  assert.doesNotMatch(msg,/Approve:/);
  const signature=await account.signMessage({message:msg});
  const good:ReleaseConfig={signer:account.address,revision,expiresAt:expires,signature};
  assert.equal(await validReleaseSignature(good,fixed),true);
  assert.equal(await validReleaseSignature({...good,revision:"c".repeat(40)},fixed),false);
  assert.equal(await validReleaseSignature({...good,signer:reviewer},fixed),false);
  assert.equal(await validReleaseSignature(good,new Date("2026-11-05T00:00:00Z")),false);
  assert.equal(await validReleaseSignature({...good,signature:"0x" as `0x${string}`},fixed),false);
  assert.equal(await validReleaseSignature({...good,expiresAt:"2026-11-11T00:00:00Z"},fixed),false);
});
