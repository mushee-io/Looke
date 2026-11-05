import assert from "node:assert/strict";
import {test} from "node:test";
import {randomBytes} from "node:crypto";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createWitnessChallenge,witnessMessage} from "../src/lib/beta/m22-witness";
import {
 previewIdentity,acceptanceWritesEnabled,evidencePayload,evidenceMessage,verifyAuditorSignature,
 issueSchema,consumeSchema,recordEvidenceSchema,signatureDigest,
} from "../src/lib/beta/m23-witness";
const read=(path:string)=>readFileSync(resolve(path),"utf8");
const origin="https://looke-m23-review.vercel.app",commit="a".repeat(40);
const envKeys=["LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M23_AUDITORS","LOOKE_M23_RELEASE_SIGNERS"];
async function inEnvironment<T>(overrides:Record<string,string|undefined>,task:()=>Promise<T>|T){
 const old=new Map(envKeys.map(k=>[k,process.env[k]]));
 try{
  for(const k of envKeys){if(k in overrides){const value=overrides[k];
   if(value===undefined)delete process.env[k];else process.env[k]=value;
  }}
  return await task();
 }finally{for(const k of envKeys){const v=old.get(k);
  if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
test("M23 acceptance writes default disabled and Preview origin requires exact immutable HTTPS revision",async()=>{
 await inEnvironment({LOOKE_M23_ACCEPTANCE_WRITES_ENABLED:undefined,
  LOOKE_M23_PREVIEW_ORIGIN:undefined,LOOKE_M23_PREVIEW_SHA:undefined,
  VERCEL_GIT_COMMIT_SHA:undefined},()=>{
  assert.equal(acceptanceWritesEnabled(),false);
  assert.throws(()=>previewIdentity());
 });
 await inEnvironment({LOOKE_M23_ACCEPTANCE_WRITES_ENABLED:"true",
  LOOKE_M23_PREVIEW_ORIGIN:origin,LOOKE_M23_PREVIEW_SHA:commit,
  VERCEL_GIT_COMMIT_SHA:undefined},()=>{
  assert.equal(acceptanceWritesEnabled(),true);
  assert.deepEqual(previewIdentity(),{origin,sha:commit});
 });
 await inEnvironment({LOOKE_M23_PREVIEW_ORIGIN:"http://malicious.example",
  LOOKE_M23_PREVIEW_SHA:commit,VERCEL_GIT_COMMIT_SHA:undefined},
  ()=>assert.throws(()=>previewIdentity()));
});
test("M23 issue/consume requests reject injected wallet ops, invalid signatures and arbitrary sessions",()=>{
 const account=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const c=createWitnessChallenge({address:account.address,origin,previewCommit:commit});
 assert.equal(issueSchema.parse({action:"issue",wallet:account.address}).action,"issue");
 assert.throws(()=>issueSchema.parse({action:"issue",wallet:account.address,publicBeta:true}));
 assert.throws(()=>consumeSchema.parse({action:"consume",challengeId:"fake",challenge:c,signature:"0x"}));
 assert.throws(()=>consumeSchema.parse({action:"consume",challengeId:"11111111-1111-4111-8111-111111111111",
  challenge:{...c,scope:"mint-and-transfer"},signature:"0x"+"a".repeat(130)}));
 assert.match(witnessMessage(c),/No token transfer, financial approval/);
});
test("Externally signed review reference requires a different designated reviewer, five-minute freshness and valid EIP-191 proof",async()=>{
 const auditor=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const operator=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const intruder=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const payload={kind:"security" as const,evidenceHash:"b".repeat(64),
  evidenceUrl:"https://example.org/security/sha256-audit.pdf",
  auditor:auditor.address.toLowerCase(),signedAt:"2026-11-05T10:00:00.000Z"};
 const id={origin,sha:commit},time=new Date("2026-11-05T10:01:00.000Z");
 assert.ok(evidenceMessage(payload,id).includes("NOT evidence-content validation or beta activation"));
 const signature=await auditor.signMessage({message:evidenceMessage(payload,id)});
 const input=recordEvidenceSchema.parse({action:"record_evidence",...payload,signature});
 await inEnvironment({LOOKE_M23_AUDITORS:auditor.address,LOOKE_M23_RELEASE_SIGNERS:undefined},async()=>{
  const proof=await verifyAuditorSignature(input,id,operator.address.toLowerCase(),time);
  assert.equal(proof.valid,true);
  assert.match(proof.reason,/not yet independently checked/);
  assert.equal((await verifyAuditorSignature(input,id,auditor.address,time)).valid,false);
  assert.equal((await verifyAuditorSignature(input,id,operator.address,new Date("2026-11-05T10:06:00Z"))).valid,false);
  const forged={...input,signature:await intruder.signMessage({message:evidenceMessage(payload,id)})};
  assert.equal((await verifyAuditorSignature(forged,id,operator.address,time)).valid,false);
  const unsigned={...input,kind:"operator" as const};
  assert.equal((await verifyAuditorSignature(unsigned,id,operator.address,time)).valid,false);
 });
 assert.equal(signatureDigest(signature).length,64);
 assert.throws(()=>evidencePayload.parse({...payload,evidenceUrl:"http://insecure.test/audit"}));
 assert.throws(()=>evidencePayload.parse({...payload,evidenceHash:"invalid"}));
});
test("M23 uses atomic nonce consumption and immutable audited evidence, not social login or live release",()=>{
 const src=read("src/app/api/social/ops/m23/route.ts");
 const migration=read("db/migrations/008_controlled_beta_acceptance.sql");
 for(const token of ["requireViewer(req)","assertModerator(reviewer)","verifyRequestOrigin(req)",
  "acceptanceWritesEnabled()","verifyMessage","UPDATE social_beta_wallet_challenges",
  "consumed_at IS NULL","RETURNING wallet","BEGIN","ROLLBACK","COMMIT",
  "social_beta_wallet_acceptances","social_beta_evidence_signatures","reconcileApproved(db,40)",
  "independentAssetProof","independentlyCheckedMediaProvider"]){
  assert.ok(src.includes(token),"Expected "+token);
 }
 for(const token of ["UNIQUE REFERENCES","nonce char(32) NOT NULL UNIQUE",
  "signature_sha256 char(64) NOT NULL UNIQUE","CHECK(wallet<>reviewer)",
  "CHECK(auditor<>recorded_by)","social_beta_evidence_signatures"]){
  assert.ok(migration.includes(token),"Schema must retain "+token);
 }
 assert.ok(!src.includes("createChallenge(")); // Never invoke public social sign-in flow here.
 assert.ok(!src.includes("sessionResponse("));
 assert.ok(!src.includes("eth_sendTransaction"));
 assert.ok(!src.includes("writeContract("));
 assert.ok(!src.includes("process.env.LOOKE_PUBLIC_BETA_ENABLED="));
 const ui=read("src/components/experience/M23AcceptanceLab.tsx");
 assert.match(ui,/personal_sign/);
 assert.ok(!ui.includes("eth_sendTransaction"));
 assert.ok(!ui.includes("eth_sendRawTransaction"));
});
