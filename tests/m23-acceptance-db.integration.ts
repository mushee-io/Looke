import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {GET,POST} from "../src/app/api/social/ops/m23/route";
import {GET as sessionGET} from "../src/app/api/social/auth/route";
import {evidenceMessage} from "../src/lib/beta/m23-witness";

const holder1=privateKeyToAccount(bytesToHex(randomBytes(32)));
const holder2=privateKeyToAccount(bytesToHex(randomBytes(32)));
const inspector=privateKeyToAccount(bytesToHex(randomBytes(32)));
const reviewer="0x"+randomBytes(20).toString("hex");
const [wallet1,wallet2,auditor]=[holder1,holder2,inspector].map(x=>x.address.toLowerCase());
const members=[wallet1,wallet2,auditor,reviewer];
const origin="https://looke-m23-preview.example",sha="a".repeat(40);
const envVars=["LOOKE_SOCIAL_MODERATORS","LOOKE_SOCIAL_APP_ORIGIN",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M23_PREVIEW_ORIGIN",
 "LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA","LOOKE_M23_AUDITORS",
 "LOOKE_M23_RELEASE_SIGNERS","LOOKE_SOCIAL_WRITES_ENABLED",
 "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED"];
const old=new Map<string,string|undefined>();
let token="",postId="",seasonId="",ledgerId="";
function req(user:"operator"|"anonymous",method:"GET"|"POST",path="/api/social/ops/m23",
 data?:Record<string,unknown>,reqOrigin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(user==="operator"?{cookie:COOKIE_NAME+"="+token}:{}),
   ...(method==="POST"?{origin:reqOrigin,"content-type":"application/json"}:{}),
  },...(data?{body:JSON.stringify(data)}:{}),
 });
}
const get=(user:"operator"|"anonymous"="operator",path?:string)=>GET(req(user,"GET",path));
const send=(user:"operator"|"anonymous",body:Record<string,unknown>,reqOrigin?:string)=>
 POST(req(user,"POST",undefined,body,reqOrigin));
async function json(res:Response){return res.json() as Promise<Record<string,unknown>>;}
async function issue(wallet:string){
 const response=await send("operator",{action:"issue",wallet});
 assert.equal(response.status,200);
 return await json(response) as {
  challengeId:string;challenge:{
   address:string;previewCommit:string;nonce:string;origin:string;expiresAt:string
  };message:string;
 };
}
async function signAndConsume(
 signer:typeof holder1|typeof holder2,challenge:Awaited<ReturnType<typeof issue>>
){
 const signature=await signer.signMessage({message:challenge.message});
 return send("operator",{action:"consume",challengeId:challenge.challengeId,
  challenge:challenge.challenge,signature});
}
before(async()=>{
 for(const e of envVars)old.set(e,process.env[e]);
 process.env.LOOKE_SOCIAL_MODERATORS=reviewer;
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_M23_PREVIEW_ORIGIN=origin;
 process.env.LOOKE_M23_PREVIEW_SHA=sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_M23_AUDITORS=auditor;
 process.env.LOOKE_M23_RELEASE_SIGNERS="";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const wallet of members){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
    VALUES($1,$2,'M23 disposable verification',now()-interval '2 days')`,
    [wallet,"u"+wallet.slice(2,17)]);
 }
 token=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '1 hour')`,
  [createHash("sha256").update(token).digest("hex"),reviewer]);
 postId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'M23 verified-source disposable CI creator entry',now()-interval '10 minutes')
  RETURNING id`,[wallet1])).rows[0].id;
 seasonId=(await query<{id:string}>(`INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M23 disposable security season','active',
   now()-interval '1 day',now()+interval '1 day',
   now()+interval '2 days',now()+interval '3 days',
   now()+interval '10 days') RETURNING id`,
   ["m23-"+randomBytes(7).toString("hex")])).rows[0].id;
 const at=(await query<{created_at:Date}>(`SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`INSERT INTO social_points_ledger
   (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
    points,status,review_note,reviewed_by,reviewed_at)
   VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
    'Disposable M23 real PostgreSQL source test',$6,now()) RETURNING id`,
   [seasonId,wallet1,postId,at,at.toISOString().slice(0,10),reviewer])).rows[0].id;
});
after(async()=>{
 try{
  await query(`DELETE FROM social_beta_evidence_signatures WHERE recorded_by=$1`,[reviewer]);
  await query(`DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1`,[reviewer]);
  await query(`DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1`,[reviewer]);
  if(seasonId)await query(`DELETE FROM social_points_ledger WHERE season_id=$1`,[seasonId]);
  if(seasonId)await query(`DELETE FROM social_points_seasons WHERE id=$1`,[seasonId]);
  await query(`DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])`,[members]);
  await query(`DELETE FROM social_profiles WHERE address=ANY($1::text[])`,[members]);
 }finally{
  for(const e of envVars){const v=old.get(e);if(v===undefined)delete process.env[e];else process.env[e]=v;}
  await socialDb().end();
 }
});
test("M23 acceptance cannot be read by anonymous or non-moderator sessions",async()=>{
 assert.equal((await get("anonymous")).status,401);
 assert.equal((await send("anonymous",{action:"issue",wallet:wallet1})).status,401);
 const r=await get();assert.equal(r.status,200);
 const data=await json(r);
 assert.equal(data.releaseDecision,"NO_GO");
 assert.equal(data.publicBetaOpen,false);
 assert.equal(data.acceptanceWritesEnabled,true);
 assert.deepEqual(data.previewIdentity,{origin,sha});
 assert.equal((data.pointsReconciliation as {issues:unknown[]}).issues.length,0);
 assert.equal((data.pointsReconciliation as {totalApproved:number}).totalApproved,1);
 assert.equal(data.securityAuditApproved,false);
 assert.equal(data.databaseRestoreIndependentlyWitnessed,false);
 assert.equal(data.operatorReleaseApproved,false);
 assert.equal(data.socialLoginSessionsCreated,0);
 const original=await json(await sessionGET(req("operator","GET","/api/social/auth")));
 assert.equal(original.authenticated,true);
});
test("M23 rejects operator self-witness, unknown wallets and malicious origins before issuing nonce",async()=>{
 assert.equal((await send("operator",{action:"issue",wallet:reviewer})).status,403);
 assert.equal((await send("operator",{action:"issue",wallet:"0x"+"b".repeat(40)})).status,404);
 assert.equal((await send("operator",{action:"issue",wallet:wallet1},"https://evil.invalid")).status,403);
 const old=process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="false";
 try{assert.equal((await send("operator",{action:"issue",wallet:wallet1})).status,503);
  assert.equal((await get()).status,200);
 }finally{if(old===undefined)delete process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED;
  else process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED=old;}
});
test("Actual EIP-191 wallet signature and one-use nonce atomically block cross-wallet impersonation and replay",async()=>{
 const issued=await issue(wallet1);
 assert.equal(issued.challenge.address,wallet1);
 assert.equal(issued.challenge.previewCommit,sha);
 assert.equal(issued.challenge.origin,origin);
 const wrong=await holder2.signMessage({message:issued.message});
 assert.equal((await send("operator",{action:"consume",challengeId:issued.challengeId,
  challenge:issued.challenge,signature:wrong})).status,401);
 const changed={...issued.challenge,nonce:"f".repeat(32)};
 assert.equal((await send("operator",{action:"consume",challengeId:issued.challengeId,
  challenge:changed,signature:await holder1.signMessage({message:issued.message})})).status,409);
 const signed=await holder1.signMessage({message:issued.message});
 const body={action:"consume",challengeId:issued.challengeId,challenge:issued.challenge,signature:signed};
 const [a,b]=await Promise.all([send("operator",body),send("operator",body)]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 const accepted=await json(a.status===200?a:b);
 assert.equal(accepted.wallet,wallet1);assert.equal(accepted.nonceConsumed,true);
 assert.equal(accepted.socialLoginCreated,false);assert.equal(accepted.independentHumanWitnessAccepted,false);
 assert.equal(accepted.transactionsSent,0);
 assert.equal((await send("operator",body)).status,409);
 const proofs=await query<{id:string}>(`SELECT id FROM social_beta_wallet_acceptances
  WHERE wallet=$1 AND reviewer=$2`,[wallet1,reviewer]);
 assert.equal(proofs.rowCount,1);
 const actualChallenge=await query<{consumed_at:Date|null}>(`
  SELECT consumed_at FROM social_beta_wallet_challenges WHERE id=$1`,[issued.challengeId]);
 assert.ok(actualChallenge.rows[0].consumed_at);
});
test("Two distinct real signed-wallet nonce records do not invent separate humans or beta approval",async()=>{
 const second=await issue(wallet2);
 const response=await signAndConsume(holder2,second);
 assert.equal(response.status,200);
 const data=await json(await get());
 assert.equal(data.distinctWalletsWithConsumedNonce,2);
 assert.equal(data.twoWalletCryptographicProof,true);
 assert.equal(data.twoWalletIndependentHumanWitnessAccepted,false);
 assert.equal(data.publicBetaOpen,false);
 assert.equal(data.securityAuditApproved,false);
});
test("Independent allowlisted reviewer may countersign evidence references but cannot approve document content or launch",async()=>{
 const item={kind:"security" as const,evidenceHash:"b".repeat(64),
  evidenceUrl:"https://evidence.example/reviews/independent-audit.pdf",
  auditor,signedAt:new Date().toISOString()};
 const text=evidenceMessage(item,{origin,sha});
 const signature=await inspector.signMessage({message:text});
 const forged=await holder1.signMessage({message:text});
 assert.equal((await send("operator",{action:"record_evidence",...item,signature:forged})).status,403);
 const accepted=await send("operator",{action:"record_evidence",...item,signature});
 assert.equal(accepted.status,200);
 const result=await json(accepted);
 assert.equal(result.signatureVerified,true);
 assert.equal(result.artifactContentIndependentlyVerified,false);
 assert.equal(result.operationalReleaseAuthorized,false);
 assert.equal((await send("operator",{action:"record_evidence",...item,signature})).status,409);
 const afterReport=await json(await get());
 assert.equal((afterReport.countersignatures as unknown[]).length,1);
 assert.equal(afterReport.securityAuditApproved,false);
 assert.equal(afterReport.operatorReleaseApproved,false);
 assert.equal((await send("operator",{action:"record_evidence",...item,
   kind:"operator",signature})).status,403);
});
test("M23 source-backed Points drift is visible without reversing allocations or publishing pending media",async()=>{
 const before=await json(await get());
 assert.equal((before.pointsReconciliation as {issues:unknown[]}).issues.length,0);
 await query(`UPDATE social_posts SET hidden=true WHERE id=$1`,[postId]);
 const afterReport=await json(await get());
 const drift=(afterReport.pointsReconciliation as {issues:{ledgerId:string;reason:string}[]}).issues;
 assert.ok(drift.some(x=>x.ledgerId===ledgerId&&x.reason==="source_missing_or_ineligible"));
 const ledger=await query<{status:string;points:number}>(`SELECT status,points
   FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");assert.equal(ledger.rows[0].points,10);
 assert.equal(afterReport.publicBetaOpen,false);
});
