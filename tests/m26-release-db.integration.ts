import assert from "node:assert/strict";
import {test,before,after} from "node:test";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {NextRequest} from "next/server";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {query,socialDb} from "../src/lib/social/db";
import {GET,POST} from "../src/app/api/social/ops/m26/route";
import {m26Decision,witnessMessage,digestAllM26Tables,compareAllM26Tables} from "../src/lib/beta/m26-acceptance";
import {POST as m23Post} from "../src/app/api/social/ops/m23/route";

const account1=privateKeyToAccount(bytesToHex(randomBytes(32)));
const account2=privateKeyToAccount(bytesToHex(randomBytes(32)));
const original=privateKeyToAccount(bytesToHex(randomBytes(32)));
const reviewer=privateKeyToAccount(bytesToHex(randomBytes(32)));
const security=privateKeyToAccount(bytesToHex(randomBytes(32)));
const secondRole=privateKeyToAccount(bytesToHex(randomBytes(32)));
const operator="0x"+randomBytes(20).toString("hex");
const accounts=[operator,account1.address.toLowerCase(),account2.address.toLowerCase()];
const identity={origin:"https://looke-m26-ci.vercel.app",sha:"a".repeat(40)};
const settings=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M26_WITNESS_WRITES_ENABLED",
 "LOOKE_M26_SECURITY_WITNESSES","LOOKE_M26_OPERATOR_WITNESSES",
 "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED",
 "LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED"];
const old=new Map<string,string|undefined>();
let cookie="", evidenceId="",reviewId="",postId="";
function req(actor:"operator"|"anonymous",method:"GET"|"POST",
 path="/api/social/ops/m26",body?:Record<string,unknown>,origin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{method,headers:{
  ...(actor==="operator"?{cookie:COOKIE_NAME+"="+cookie}:{}),
  ...(method==="POST"?{origin,"content-type":"application/json"}:{}),
 },...(body?{body:JSON.stringify(body)}:{})});
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
const read=()=>GET(req("operator","GET"));
const send=(body:Record<string,unknown>,who:"operator"|"anonymous"="operator",origin?:string)=>
 POST(req(who,"POST","/api/social/ops/m26",body,origin));
async function signed(role:"independent_security"|"independent_operator",
 signer:typeof security|typeof secondRole, decision:"hold"|"reference_acknowledged_unverified"="hold"){
 const body={action:"record_witness" as const,reviewId,role,witnessWallet:signer.address.toLowerCase(),
  decision,observedAt:new Date().toISOString()};
 const context={origin:identity.origin,sha:identity.sha,gate:"independent_security_audit_content_hash_and_signoff",
  evidenceSha:"b".repeat(64)};
 const signature=await signer.signMessage({message:witnessMessage(body,context)});
 return {...body,signature};
}
before(async()=>{
 for(const k of settings)old.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN=identity.origin;
 process.env.LOOKE_M23_PREVIEW_SHA=identity.sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_M26_WITNESS_WRITES_ENABLED="true";
 process.env.LOOKE_M26_SECURITY_WITNESSES=security.address;
 process.env.LOOKE_M26_OPERATOR_WITNESSES=secondRole.address;
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const address of accounts)await query(`
  INSERT INTO social_profiles(address,handle,display_name,created_at)
  VALUES($1,$2,'M26 disposable database witness',now()-interval '5 days')`,
  [address,"u"+address.slice(2,17)]);
 cookie=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '30 minutes')`,
  [createHash("sha256").update(cookie).digest("hex"),operator]);
 postId=(await query<{id:string}>(`INSERT INTO social_posts(author,body)
  VALUES($1,'M26 disposable creator post, not real user activity') RETURNING id`,
  [accounts[1]])).rows[0].id;
 evidenceId=(await query<{id:string}>(`INSERT INTO social_beta_evidence_signatures
  (kind,evidence_sha256,evidence_url,preview_sha,auditor,recorded_by,signed_at,signature_sha256)
  VALUES('security',$1,'https://example.org/ci-only-m26-report',$2,$3,$4,now(),$5) RETURNING id`,
  ["b".repeat(64),identity.sha,original.address.toLowerCase(),operator,
   createHash("sha256").update(randomBytes(32)).digest("hex")])).rows[0].id;
 reviewId=(await query<{id:string}>(`INSERT INTO social_beta_release_reviews
  (gate,preview_sha,evidence_id,recorded_by,external_reviewer,decision,signature_sha256,observed_at)
  VALUES('independent_security_audit_content_hash_and_signoff',$1,$2,$3,$4,
   'reviewed_reference_only',$5,now()) RETURNING id`,
  [identity.sha,evidenceId,operator,reviewer.address.toLowerCase(),
   createHash("sha256").update(randomBytes(32)).digest("hex")])).rows[0].id;
});
after(async()=>{
 try{
  await query("DELETE FROM social_beta_release_witnesses WHERE submitted_by=$1",[operator]);
  await query("DELETE FROM social_beta_release_reviews WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_evidence_signatures WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[accounts]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[accounts]);
 }finally{for(const k of settings){const v=old.get(k);
  if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();}
});
test("M26 read-only strictly requires a real moderator and current signed M25 evidence, always NO-GO",async()=>{
 assert.equal((await GET(req("anonymous","GET"))).status,401);
 assert.equal((await send({action:"record_witness"},"anonymous")).status,401);
 const response=await read();assert.equal(response.status,200);
 const data=await json(response);
 assert.equal(data.reviewerAuthorized,true);
 assert.equal((data.decision as {decision:string}).decision,"NO_GO");
 assert.equal((data.decision as {publicBetaOpen:boolean}).publicBetaOpen,false);
 assert.equal((data.recovery as {tableCount:number}).tableCount,18);
 assert.equal(data.transactionsSent,0);
 assert.equal(data.releaseEnabled,false);
 assert.equal((data.m25ReviewReferences as unknown[]).length,1);
 assert.equal((data.realSignedEvidence as unknown[]).length,1);
 assert.equal((data.media as {pendingMedia:number}).pendingMedia,0);
});
test("Real one-use signed keys are recognized but never equated with independent human observers",async()=>{
 for(const holder of [account1,account2]){
  const r=await m23Post(req("operator","POST","/api/social/ops/m23",
   {action:"issue",wallet:holder.address.toLowerCase()}));
  assert.equal(r.status,200);
  const v=await json(r);
  const sig=await holder.signMessage({message:String(v.message)});
  const accept=await m23Post(req("operator","POST","/api/social/ops/m23",{
   action:"consume",challengeId:v.challengeId,challenge:v.challenge,signature:sig}));
  assert.equal(accept.status,200);
  assert.equal((await json(accept)).independentHumanWitnessAccepted,false);
 }
 const result=await json(await read());
 assert.equal((result.walletProofs as {distinctPublicKeys:number}).distinctPublicKeys,2);
 assert.equal((result.walletProofs as {independentlyWitnessedHumans:boolean}).independentlyWitnessedHumans,false);
 assert.equal((result.decision as {decision:string}).decision,"NO_GO");
});
test("M26 fails closed with feature flag, wrong origin, wrong witness role or existing signer",async()=>{
 const correct=await signed("independent_security",security);
 assert.equal((await send(correct,"operator","https://evil.example")).status,403);
 const oldFlag=process.env.LOOKE_M26_WITNESS_WRITES_ENABLED;
 process.env.LOOKE_M26_WITNESS_WRITES_ENABLED="false";
 try{assert.equal((await send(correct)).status,503);}finally{
  if(oldFlag===undefined)delete process.env.LOOKE_M26_WITNESS_WRITES_ENABLED;
  else process.env.LOOKE_M26_WITNESS_WRITES_ENABLED=oldFlag;}
 const wrong=await signed("independent_security",secondRole);
 assert.equal((await send(wrong)).status,403);
 const sourceSigner=await signed("independent_security",original);
 assert.equal((await send(sourceSigner)).status,403);
 assert.equal((await send({...correct,releaseEnabled:true})).status,400);
});
test("Independent security reference signature is accepted once, concurrent replay and cross-role reuse denied",async()=>{
 const payload=await signed("independent_security",security);
 const [a,b]=await Promise.all([send(payload),send(payload)]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 const good=await json(a.status===200?a:b);
 assert.equal(good.signatureVerified,true);
 assert.equal(good.betaActivated,false);
 assert.equal(good.independentHumanIdentityVerified,false);
 assert.equal(good.sourceDocumentContentsVerified,false);
 assert.equal((await send(payload)).status,409);
 const duplicateRole=await signed("independent_security",secondRole);
 assert.equal((await send(duplicateRole)).status,409);
 const otherRoleSameKey=await signed("independent_operator",security);
 assert.equal((await send(otherRoleSameKey)).status,409);
});
test("Separate operator witness acknowledgement can be logged but never release beta",async()=>{
 const second=await signed("independent_operator",secondRole,"reference_acknowledged_unverified");
 const response=await send(second);assert.equal(response.status,200);
 const report=await json(await read());
 const decision=report.decision as {decision:string;dualRoleReferenceSignaturesPresent:boolean;
  independentlyVerifiedHumanApproval:boolean};
 assert.equal(decision.dualRoleReferenceSignaturesPresent,true);
 assert.equal(decision.decision,"NO_GO");
 assert.equal(decision.independentlyVerifiedHumanApproval,false);
 assert.equal(report.publicBetaOpen,false);
 const stored=await query<{beta_authorized:boolean;production_changed:boolean;
  independent_human_identity_verified:boolean}>(`
   SELECT beta_authorized,production_changed,independent_human_identity_verified
   FROM social_beta_release_witnesses WHERE review_id=$1`,[reviewId]);
 assert.equal(stored.rowCount,2);
 assert.ok(stored.rows.every(x=>!x.beta_authorized&&!x.production_changed&&!x.independent_human_identity_verified));
});
test("Real full-row 18-table SQL digest includes the M25 review ledger, records row drift without writes",async()=>{
 const c=await socialDb().connect();
 try{
  const original=await digestAllM26Tables(c,false);
  assert.equal(original.length,18);
  assert.equal(compareAllM26Tables(original,original.map(x=>({...x}))).comparison,"MATCHED_FULL_ROWS");
  await query("UPDATE social_beta_release_reviews SET decision='needs_more_evidence' WHERE id=$1",[reviewId]);
  const newer=await digestAllM26Tables(c,false);
  const result=compareAllM26Tables(original,newer);
  assert.equal(result.comparison,"MISMATCH");
  assert.ok(result.differences.some(x=>x.table==="social_beta_release_reviews"));
  assert.equal(result.operatorRestoreWitnessAccepted,false);
  assert.equal(result.releaseAuthorized,false);
 }finally{c.release();}
});
