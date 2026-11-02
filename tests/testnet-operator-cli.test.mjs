import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {keccak256,zeroAddress} from "viem";
import {unsignedFactoryManifest} from "../scripts/prepare-testnet-factory.mjs";
import {acceptTestnetFactory} from "../scripts/testnet-factory-acceptance.mjs";

test("offline deployment preparation produces unsigned Ultra 18881 constructor data, never a send",()=>{
 const attestor="0x3333333333333333333333333333333333333333";
 const draft=unsignedFactoryManifest(attestor);
 assert.equal(draft.chainId,18881);
 assert.equal(draft.tx.chainId,18881);
 assert.equal(draft.tx.to,null);
 assert.equal(draft.tx.value,"0");
 assert.equal(draft.attestor,attestor);
 assert.match(draft.creationBytecodeHash,/^0x[0-9a-f]{64}$/);
 assert.match(draft.tx.data,/^0x[0-9a-f]+$/);
 assert.equal(draft.signed,false);
 assert.equal(draft.submitted,false);
 assert.equal(draft.securityAudited,false);
 assert.equal(draft.tradingEnabled,false);
 assert.throws(()=>unsignedFactoryManifest(zeroAddress),RangeError);
 assert.throws(()=>unsignedFactoryManifest("not-an-address"),RangeError);
});

test("testnet acceptance refuses invalid network/credentials without contacting RPC",async()=>{
 await assert.rejects(acceptTestnetFactory({
  chainId:1,factory:"0x2222222222222222222222222222222222222222",
  attestor:"0x3333333333333333333333333333333333333333",
  codeHash:keccak256("0x6001"),deploymentTx:"0x"+"a".repeat(64),
  secondaryRpc:"https://independent-provider.example/rpc"
 }),RangeError);
 await assert.rejects(acceptTestnetFactory({
  chainId:18881,factory:zeroAddress,
  attestor:"0x3333333333333333333333333333333333333333",
  codeHash:keccak256("0x6001"),deploymentTx:"0x"+"a".repeat(64),
  secondaryRpc:"https://independent-provider.example/rpc"
 }),RangeError);
 await assert.rejects(acceptTestnetFactory({
  chainId:18881,factory:"0x2222222222222222222222222222222222222222",
  attestor:"0x3333333333333333333333333333333333333333",
  codeHash:keccak256("0x6001"),deploymentTx:"0x"+"a".repeat(64),
  secondaryRpc:"http://localhost:8080"
 }),RangeError);
});

test("acceptance and review entrypoints contain no custodial keys or execution calls",()=>{
 const deploy=fs.readFileSync("scripts/prepare-testnet-factory.mjs","utf8");
 const acceptance=fs.readFileSync("scripts/testnet-factory-acceptance.mjs","utf8");
 const review=fs.readFileSync("app/api/operator/attestor/review/route.ts","utf8");
 for(const code of [deploy,acceptance,review]){
  assert.doesNotMatch(code,/privateKeyToAccount|signTypedData|sendRawTransaction|sendTransaction|\.writeContract\(|\.deployContract\(/);
  assert.doesNotMatch(code,/process\.env\.LOOKE_ATTESTOR_PRIVATE_KEY|process\.env\.NEXT_PUBLIC_LOOKE_ATTESTOR/);
 }
 assert.match(acceptance,/LOOKE_TESTNET_ACCEPTANCE_ACK/);
 assert.match(acceptance,/confirmedBlock|receiptBlock/);
 assert.match(acceptance,/CoinAuthorizationUsed/);
 assert.match(acceptance,/referenceCoinFor/);
 assert.match(acceptance,/codeHash/);
 assert.match(deploy,/LOOKE_UNSIGNED_DEPLOY_ACK/);
 assert.match(review,/manualApprovalRequired:true/);
 assert.match(review,/status:"manual_review_required"/);
});
