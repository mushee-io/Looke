import assert from "node:assert/strict";
import {test,before,after} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {NextRequest} from "next/server";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {query,socialDb} from "../src/lib/social/db";
import {GET as m25GET,POST as m25POST} from "../src/app/api/social/ops/m25/route";
import {POST as m23POST} from "../src/app/api/social/ops/m23/route";
import {evidenceMessage} from "../src/lib/beta/m23-witness";
import {m25ReviewMessage} from "../src/lib/beta/m25-register";
import {digestFullDatabase,compareFullDatabase,tables} from "../src/lib/beta/m24-full-restore";
const walletA=privateKeyToAccount(bytesToHex(randomBytes(32)));
const walletB=privateKeyToAccount(bytesToHex(randomBytes(32)));
const signer=privateKeyToAccount(bytesToHex(randomBytes(32)));
const externalReviewer=privateKeyToAccount(bytesToHex(randomBytes(32)));
const operator="0x"+randomBytes(20).toString("hex");
const members=[operator,walletA.address.toLowerCase(),walletB.address.toLowerCase()];
const sha="a".repeat(40),origin="https://looke-m25-protected.vercel.app";
const vars=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M23_AUDITORS","LOOKE_M23_RELEASE_SIGNERS",
 "LOOKE_M25_REVIEW_WRITES_ENABLED","LOOKE_M25_EXTERNAL_REVIEWERS",
 "LOOKE_M25_RELEASE_REVIEWERS","LOOKE_PUBLIC_BETA_ENABLED",
 "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
 "LOOKE_POINTS_ACCOUNTING_ENABLED"];
const previous=new Map<string,string|undefined>();
let cookie="",securityEvidence="",restoreEvidence="",operatorEvidence="";
let postId="",pendingId="",seasonId="",ledgerId="";
function req(actor:"operator"|"anonymous",method:"GET"|"POST",
 path="/api/social/ops/m25",body?:Record<string,unknown>,
 requestOrigin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor==="operator"?{cookie:COOKIE_NAME+"="+cookie}:{}),
   ...(method==="POST"?{origin:requestOrigin,"content-type":"application/json"}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
const get=(path?:string,actor:"operator"|"anonymous"="operator")=>
 m25GET(req(actor,"GET",path));
const put=(body:Record<string,unknown>,actor:"operator"|"anonymous"="operator",
 origin="http://localhost:3000")=>m25POST(req(actor,"POST",undefined,body,origin));
async function m23(body:Record<string,unknown>){return m23POST(req("operator","POST",
 "/api/social/ops/m23",body));}
async function evidence(kind:"security"|"restore"|"operator"){
 const payload={kind,evidenceHash:createHash("sha256")
  .update("M25 disposable "+kind+" independent review fixture").digest("hex"),
  evidenceUrl:"https://review.example/m25/"+kind+"/ci-only.pdf",
  auditor:signer.address.toLowerCase(),signedAt:new Date().toISOString()};
 const signature=await signer.signMessage({message:evidenceMessage(payload,{origin,sha})});
 const response=await m23({action:"record_evidence",...payload,signature});
 assert.equal(response.status,200);
 return (await json(response)).attestationId as string;
}
async function signedReview(gate:string,evidenceId:string,
 reviewer=externalReviewer,decision:"needs_more_evidence"|"reviewed_reference_only"="needs_more_evidence"){
 const source=await query<{evidence_sha256:string}>(`
  SELECT evidence_sha256 FROM social_beta_evidence_signatures WHERE id=$1`,[evidenceId]);
 const body={
  action:"record_review" as const,gate,evidenceId,
  externalReviewer:reviewer.address.toLowerCase(),
  decision,observedAt:new Date().toISOString(),
 };
 const signature=await reviewer.signMessage({
  message:m25ReviewMessage(body,{origin,sha},source.rows[0].evidence_sha256),
 });
 return {...body,signature};
}
before(async()=>{
 for(const k of vars)previous.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN=origin;
 process.env.LOOKE_M23_PREVIEW_SHA=sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_M23_AUDITORS=signer.address;
 process.env.LOOKE_M23_RELEASE_SIGNERS=signer.address;
 process.env.LOOKE_M25_REVIEW_WRITES_ENABLED="true";
 process.env.LOOKE_M25_EXTERNAL_REVIEWERS=externalReviewer.address;
 process.env.LOOKE_M25_RELEASE_REVIEWERS="";
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const a of members)await query(`
  INSERT INTO social_profiles(address,handle,display_name,created_at)
  VALUES($1,$2,'Disposable M25 verification',now()-interval '7 days')`,
  [a,"u"+a.slice(2,17)]);
 cookie=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '30 minutes')`,[
  createHash("sha256").update(cookie).digest("hex"),operator,
 ]);
 postId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'Disposable M25 real SQL source',now()-interval '10 minutes') RETURNING id`,
  [members[1]])).rows[0].id;
 pendingId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'Disposable moderation pending fixture',
  'https://res.cloudinary.com/looke/image/upload/v1/m25-ci.png','image','pending')
  RETURNING id`,[members[1]])).rows[0].id;
 seasonId=(await query<{id:string}>(`INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M25 disposable season','active',now()-interval '3 days',
  now()+interval '3 days',now()+interval '4 days',now()+interval '6 days',
  now()+interval '20 days') RETURNING id`,
  ["m25-"+randomBytes(7).toString("hex")])).rows[0].id;
 const at=(await query<{created_at:Date}>(`
  SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
  'M25 disposable source-evidence regression',$6,now()) RETURNING id`,
  [seasonId,members[1],postId,at,at.toISOString().slice(0,10),operator])).rows[0].id;
 securityEvidence=await evidence("security");
 restoreEvidence=await evidence("restore");
 operatorEvidence=await evidence("operator");
});
after(async()=>{
 try{
  await query("DELETE FROM social_beta_release_reviews WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_evidence_signatures WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1",[operator]);
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[members]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[members]);
 }finally{
  for(const k of vars){const v=previous.get(k);
   if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("Protected M25 review rejects anonymous requester and starts NO-GO with genuine PostgreSQL data",async()=>{
 assert.equal((await get(undefined,"anonymous")).status,401);
 assert.equal((await put({action:"record_review"},"anonymous")).status,401);
 const response=await get();assert.equal(response.status,200);
 const body=await json(response);
 assert.equal(body.reviewerAuthorized,true);
 assert.equal(body.publicBetaActivated,false);
 assert.equal(body.productionChanged,false);
 assert.equal(body.transactionsSent,0);
 const gate=body.gate as {decision:string;unresolvedReleaseGates:number;releaseFlagsClosed:boolean};
 assert.equal(gate.decision,"NO_GO");
 assert.equal(gate.unresolvedReleaseGates,11);
 assert.equal(gate.releaseFlagsClosed,true);
 assert.equal((body.verifiedSourceReferences as unknown[]).length,3);
 assert.equal((body.operatorEvidenceReviews as unknown[]).length,0);
 assert.equal((body.moderation as {pendingMedia:number}).pendingMedia,1);
 assert.equal((body.actualPoints as {mismatches:number}).mismatches,0);
 assert.equal((body.actualPoints as {totalApproved:number}).totalApproved,1);
 assert.equal(body.twoIndependentHumanWalletWitnessesApproved,false);
 assert.equal((body.recovery as {actualWitnessedDisasterRecovery:boolean}).actualWitnessedDisasterRecovery,false);
});
test("CSRF, opt-in, missing evidence and wrong evidence-kind are all denied",async()=>{
 const entry=await signedReview("independent_security_audit_content_hash_and_signoff",securityEvidence);
 assert.equal((await put(entry,"operator","https://evil.example")).status,403);
 const prior=process.env.LOOKE_M25_REVIEW_WRITES_ENABLED;
 process.env.LOOKE_M25_REVIEW_WRITES_ENABLED="false";
 try{assert.equal((await put(entry)).status,503);assert.equal((await get()).status,200);}
 finally{if(prior===undefined)delete process.env.LOOKE_M25_REVIEW_WRITES_ENABLED;
  else process.env.LOOKE_M25_REVIEW_WRITES_ENABLED=prior;}
 assert.equal((await put({...entry,evidenceId:"11111111-1111-4111-8111-111111111111"})).status,409);
 assert.equal((await put(await signedReview("different_operator_witnessed_restore",securityEvidence))).status,409);
 assert.equal((await put(await signedReview("explicit_operator_public_beta_go_live_authorization",operatorEvidence))).status,403);
 assert.equal((await put({...entry,publicBetaOpen:true})).status,400);
});
test("Independent signer cannot be original M23 evidence signer and forged signature is denied",async()=>{
 const same=await signedReview("independent_security_audit_content_hash_and_signoff",securityEvidence,signer);
 assert.equal((await put(same)).status,403);
 const correct=await signedReview("independent_security_audit_content_hash_and_signoff",securityEvidence);
 const alien=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const wrong=await signedReview("independent_security_audit_content_hash_and_signoff",securityEvidence,alien);
 assert.equal((await put({...correct,signature:wrong.signature})).status,403);
 assert.equal((await put({...correct,observedAt:"2025-01-01T00:00:00.000Z"})).status,403);
});
test("Two genuine consumed signatures require two distinct wallets before even logging a human witness reference",async()=>{
 const gate="two_real_wallets_with_independent_human_witness";
 const item=await signedReview(gate,securityEvidence);
 assert.equal((await put(item)).status,409);
 for(const holder of [walletA,walletB]){
  const issued=await m23({action:"issue",wallet:holder.address.toLowerCase()});
  assert.equal(issued.status,200);
  const c=await json(issued);
  const signature=await holder.signMessage({message:String(c.message)});
  const accept=await m23({action:"consume",
   challengeId:c.challengeId,challenge:c.challenge,signature});
  assert.equal(accept.status,200);
  assert.equal((await json(accept)).independentHumanWitnessAccepted,false);
 }
 const summary=await json(await get());
 assert.equal(summary.distinctSignedWalletKeys,2);
 assert.equal(summary.twoIndependentHumanWalletWitnessesApproved,false);
 assert.equal((await put(item)).status,200);
 assert.equal((await put(item)).status,409);
 const afterRecord=await json(await get());
 assert.equal((afterRecord.gate as {decision:string}).decision,"NO_GO");
 assert.equal((afterRecord.operatorEvidenceReviews as unknown[]).length,1);
});
test("Independent reviewer may record a genuine hash-linked reference, not verified content or release authority",async()=>{
 const gate="independent_security_audit_content_hash_and_signoff";
 const input=await signedReview(gate,securityEvidence);
 const res=await put(input);assert.equal(res.status,200);
 const record=await json(res);
 assert.equal(record.signatureVerified,true);
 assert.equal(record.artifactBytesVerified,false);
 assert.equal(record.independentHumanAcceptanceApproved,false);
 assert.equal(record.releaseDecision,"NO_GO");
 assert.equal(record.publicBetaActivated,false);
 assert.equal(record.productionChanged,false);
 assert.equal(record.transactionsSent,0);
 assert.equal((await put(input)).status,409);
 const rows=await query<{artifact_bytes_verified:boolean;beta_release_authorized:boolean;
 production_changed:boolean}>(`SELECT artifact_bytes_verified,beta_release_authorized,production_changed
 FROM social_beta_release_reviews WHERE id=$1`,[record.reviewId]);
 assert.equal(rows.rows[0].artifact_bytes_verified,false);
 assert.equal(rows.rows[0].beta_release_authorized,false);
 assert.equal(rows.rows[0].production_changed,false);
});
test("External operator release countersignature can be logged but NEVER opens beta",async()=>{
 process.env.LOOKE_M25_RELEASE_REVIEWERS=externalReviewer.address;
 const input=await signedReview("explicit_operator_public_beta_go_live_authorization",operatorEvidence);
 const res=await put(input);assert.equal(res.status,200);
 const body=await json(await get());
 assert.equal((body.gate as {decision:string}).decision,"NO_GO");
 assert.equal((body.gate as {canActivate:boolean}).canActivate,false);
 assert.equal(body.publicBetaActivated,false);
});
test("Current real Points drift and rejected-media state remain visible without auto-moderation or claims",async()=>{
 const beforeReport=await json(await get());
 assert.equal((beforeReport.actualPoints as {mismatches:number}).mismatches,0);
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
 const changed=await json(await get());
 assert.equal((changed.actualPoints as {mismatches:number}).mismatches,1);
 assert.equal((changed.gate as {decision:string}).decision,"NO_GO");
 const post=await query<{media_status:string}>(`
  SELECT media_status FROM social_posts WHERE id=$1`,[pendingId]);
 assert.equal(post.rows[0].media_status,"pending");
 const ledger=await query<{status:string;points:number}>(`
  SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");
 assert.equal(ledger.rows[0].points,10);
});
test("Full 17-table read-only digest remains a technical comparison, never a witnessed disaster recovery",async()=>{
 const client=await socialDb().connect();
 try{
  const snapshot=await digestFullDatabase(client,{pageSize:5,maxRowsPerTable:10000});
  assert.equal(snapshot.length,tables.length);
  assert.equal(tables.length,17);
  const compare=compareFullDatabase(snapshot,snapshot.map(x=>({...x})));
  assert.equal(compare.comparison,"MATCHED_FULL_ROWS");
  assert.equal(compare.operatorRestoreWitnessAccepted,false);
  assert.equal(compare.backupOriginVerified,false);
  assert.equal(compare.releaseAuthorized,false);
 }finally{client.release();}
});
