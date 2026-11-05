import assert from "node:assert/strict";
import {test} from "node:test";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {resolve} from "node:path";
import {tables} from "../src/lib/beta/m24-full-restore";
import {completeTables,compareAllM26Tables,m26Decision,witnessMessage,
 allowedWitness,verifyWitness,signatureHash,strictFinalDecision,witnessWritesEnabled} from "../src/lib/beta/m26-acceptance";
const op=privateKeyToAccount(bytesToHex(randomBytes(32)));
const original=privateKeyToAccount(bytesToHex(randomBytes(32)));
const m25=privateKeyToAccount(bytesToHex(randomBytes(32)));
const security=privateKeyToAccount(bytesToHex(randomBytes(32)));
const release=privateKeyToAccount(bytesToHex(randomBytes(32)));
const attacker=privateKeyToAccount(bytesToHex(randomBytes(32)));
const context={origin:"https://looke-m26.test.vercel.app",sha:"a".repeat(40),
 evidenceSha:"b".repeat(64),gate:"independent_security_audit_content_hash_and_signoff"};
const input={
 action:"record_witness" as const,reviewId:"11111111-1111-4111-8111-111111111111",
 role:"independent_security" as const,witnessWallet:security.address.toLowerCase(),
 decision:"reference_acknowledged_unverified" as const,observedAt:"2026-11-05T10:00:00Z",
};
const env=["LOOKE_M26_SECURITY_WITNESSES","LOOKE_M26_OPERATOR_WITNESSES"];
async function environment<T>(x:Record<string,string|undefined>,fn:()=>Promise<T>|T){
 const old=Object.fromEntries(env.map(k=>[k,process.env[k]]));
 try{for(const k of env){if(Object.hasOwn(x,k)){
  if(x[k]===undefined)delete process.env[k];else process.env[k]=x[k];}}
  return await fn();
 }finally{for(const k of env){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
}
const params={...context,operator:op.address.toLowerCase(),
 originalReviewer:m25.address.toLowerCase(),evidenceSigner:original.address.toLowerCase(),
 now:new Date("2026-11-05T10:02:00Z")};
test("M26 full database manifest includes all 17 original tables and M25 release review ledger",()=>{
 assert.equal(tables.length,17);
 assert.equal(completeTables.length,18);
 assert.equal(completeTables[17][0],"social_beta_release_reviews");
 const a=completeTables.map(([table])=>({table,rows:3,sha256:"a".repeat(64),schemaSha256:"b".repeat(64),complete:true as const}));
 const ok=compareAllM26Tables(a,a.map(x=>({...x})));
 assert.equal(ok.comparison,"MATCHED_FULL_ROWS");
 assert.equal(ok.operatorRestoreWitnessAccepted,false);
 assert.equal(ok.releaseAuthorized,false);
 assert.equal(compareAllM26Tables(a,a.slice(0,17)).comparison,"MISMATCH");
 assert.equal(compareAllM26Tables(a,a.map(x=>x.table==="social_beta_release_reviews"?
  {...x,sha256:"f".repeat(64)}:x)).comparison,"MISMATCH");
});
test("M26 accepts only independently signed scoped public references, not launch or KYC claims",async()=>{
 const message=witnessMessage(input,context);
 assert.match(message,/NO beta launch/);
 const signature=await security.signMessage({message});
 const valid=m26Decision.parse({...input,signature});
 await environment({LOOKE_M26_SECURITY_WITNESSES:security.address,
  LOOKE_M26_OPERATOR_WITNESSES:release.address},async()=>{
  assert.equal((await verifyWitness(valid,params)).valid,true);
  const impersonator=await attacker.signMessage({message});
  assert.equal((await verifyWitness({...valid,signature:impersonator},params)).valid,false);
  assert.equal((await verifyWitness(valid,{...params,sha:"c".repeat(40)})).valid,false);
  assert.equal((await verifyWitness(valid,{...params,evidenceSha:"e".repeat(64)})).valid,false);
  assert.equal((await verifyWitness(valid,{...params,now:new Date("2026-11-05T10:11:00Z")})).valid,false);
  assert.equal(allowedWitness(valid,security.address,m25.address,original.address),false);
  assert.equal(allowedWitness(valid,op.address,security.address,original.address),false);
  assert.equal(signatureHash(signature).length,64);
 });
 assert.throws(()=>m26Decision.parse({...valid,independentHuman:true}));
 assert.throws(()=>m26Decision.parse({...valid,decision:"GO"}));
 assert.throws(()=>m26Decision.parse({...valid,releaseEnabled:true}));
});
test("Separate witness allowlists and operator role cannot be bypassed",async()=>{
 await environment({LOOKE_M26_SECURITY_WITNESSES:security.address,
  LOOKE_M26_OPERATOR_WITNESSES:release.address},()=>{
  const sig="0x"+"a".repeat(130);
  const sec=m26Decision.parse({...input,signature:sig});
  const releaseWitness=m26Decision.parse({...input,role:"independent_operator",
   witnessWallet:release.address.toLowerCase(),signature:sig});
  assert.equal(allowedWitness(sec,op.address,m25.address,original.address),true);
  assert.equal(allowedWitness(releaseWitness,op.address,m25.address,original.address),true);
  assert.equal(allowedWitness({...sec,role:"independent_operator"},op.address,m25.address,original.address),false);
  assert.equal(allowedWitness({...sec,witnessWallet:m25.address.toLowerCase()},op.address,m25.address,original.address),false);
 });
});
test("Signed dual-role references and technical proofs NEVER produce an authorized GO",()=>{
 const result=strictFinalDecision({m25Decision:"GO",flagsClosed:true,digestMatched:true,
  sourceEvidenceVerified:true,operatorAuthorized:true,twoIndependentHumansObserved:true,
  providerAuthenticated:true,witnesses:[
   {role:"independent_security",witness_wallet:security.address.toLowerCase()},
   {role:"independent_operator",witness_wallet:release.address.toLowerCase()},
  ]});
 assert.equal(result.dualRoleReferenceSignaturesPresent,true);
 assert.equal(result.decision,"NO_GO");
 assert.equal(result.publicBetaOpen,false);
 assert.equal(result.independentlyVerifiedHumanApproval,false);
 assert.equal(result.productionPromotionAllowed,false);
 assert.equal(result.financialActionsAllowed,false);
 assert.equal(result.socialMediaWritesAllowed,false);
 assert.equal(result.privateMessagesAllowed,false);
 assert.equal(result.transactionsSent,0);
 const prior=process.env.LOOKE_M26_WITNESS_WRITES_ENABLED;
 delete process.env.LOOKE_M26_WITNESS_WRITES_ENABLED;
 try{assert.equal(witnessWritesEnabled(),false);}finally{
  if(prior===undefined)delete process.env.LOOKE_M26_WITNESS_WRITES_ENABLED;
  else process.env.LOOKE_M26_WITNESS_WRITES_ENABLED=prior;
 }
});
test("M26 API keeps moderator auth, real review linkage, atomic witness role locks, and SQL NO-GO",()=>{
 const src=readFileSync(resolve("src/app/api/social/ops/m26/route.ts"),"utf8");
 const ddl=readFileSync(resolve("db/migrations/011_dual_role_release_witness.sql"),"utf8");
 for(const s of ["requireViewer(req)","assertModerator(operator)","verifyRequestOrigin(req)",
  "witnessWritesEnabled()","FOR UPDATE OF r","BEGIN","ROLLBACK","COMMIT",
  "social_beta_release_reviews","social_beta_evidence_signatures",
  "social_beta_release_witnesses","verifyWitness","strictFinalDecision"]){
   assert.ok(src.includes(s),s);
 }
 assert.match(ddl,/UNIQUE\(review_id,role\)/);
 assert.match(ddl,/UNIQUE\(review_id,witness_wallet\)/);
 assert.match(ddl,/beta_authorized boolean NOT NULL DEFAULT false CHECK\(beta_authorized=false\)/);
 for(const unsafe of ["eth_sendTransaction","request_rollback","setInterval(","writeContract("]){
  assert.ok(!src.includes(unsafe));
 }
});
