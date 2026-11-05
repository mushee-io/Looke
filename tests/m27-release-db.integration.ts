import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {randomBytes,createHash} from "node:crypto";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {GET as getM27} from "../src/app/api/social/ops/m27/route";
import {POST as postM23} from "../src/app/api/social/ops/m23/route";
import {POST as postM26} from "../src/app/api/social/ops/m26/route";
import {witnessMessage} from "../src/lib/beta/m26-acceptance";
import {digestM27Database,compareM27Databases,reconcileEntirePointsLedger} from "../src/lib/beta/m27-evidence";

const owner1=privateKeyToAccount(bytesToHex(randomBytes(32)));
const owner2=privateKeyToAccount(bytesToHex(randomBytes(32)));
const auditor=privateKeyToAccount(bytesToHex(randomBytes(32)));
const originalReviewer=privateKeyToAccount(bytesToHex(randomBytes(32)));
const security=privateKeyToAccount(bytesToHex(randomBytes(32)));
const operatorWitness=privateKeyToAccount(bytesToHex(randomBytes(32)));
const operator="0x"+randomBytes(20).toString("hex");
const originalEvidenceSigner=auditor.address.toLowerCase();
const members=[operator,owner1.address.toLowerCase(),owner2.address.toLowerCase()];
const preview={origin:"https://looke-m27-ci.vercel.app",sha:"a".repeat(40)};
const settings=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M26_WITNESS_WRITES_ENABLED",
 "LOOKE_M26_SECURITY_WITNESSES","LOOKE_M26_OPERATOR_WITNESSES",
 "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
 "LOOKE_POINTS_ACCOUNTING_ENABLED"];
const old=new Map<string,string|undefined>();
let token="",evidenceId="",reviewId="",postId="",pendingPostId="",seasonId="",ledgerId="";
function req(user:"operator"|"anonymous",method:"GET"|"POST",path:string,body?:Record<string,unknown>){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(user==="operator"?{cookie:COOKIE_NAME+"="+token}:{}),
   ...(method==="POST"?{origin:"http://localhost:3000","content-type":"application/json"}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
const get=()=>getM27(req("operator","GET","/api/social/ops/m27"));
const post=(route:"m23"|"m26",data:Record<string,unknown>)=>
 (route==="m23"?postM23:postM26)(req("operator","POST","/api/social/ops/"+route,data));
async function signedRole(role:"independent_security"|"independent_operator",
 signer:typeof security|typeof operatorWitness){
 const body={action:"record_witness",reviewId,role,witnessWallet:signer.address.toLowerCase(),
  decision:"hold",observedAt:new Date().toISOString()};
 const signature=await signer.signMessage({message:witnessMessage(body as never,{
  origin:preview.origin,sha:preview.sha,gate:"independent_security_audit_content_hash_and_signoff",
  evidenceSha:"b".repeat(64),
 })});
 return {...body,signature};
}
before(async()=>{
 for(const key of settings)old.set(key,process.env[key]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN=preview.origin;
 process.env.LOOKE_M23_PREVIEW_SHA=preview.sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_M26_WITNESS_WRITES_ENABLED="true";
 process.env.LOOKE_M26_SECURITY_WITNESSES=security.address;
 process.env.LOOKE_M26_OPERATOR_WITNESSES=operatorWitness.address;
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const wallet of members){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
   VALUES($1,$2,'M27 disposable CI account',now()-interval '6 days')`,
   [wallet,"u"+wallet.slice(2,17)]);
 }
 token=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '1 hour')`,
  [createHash("sha256").update(token).digest("hex"),operator]);
 postId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'Actual disposable M27 PostgreSQL source evidence only',
   now()-interval '12 minutes') RETURNING id`,[members[1]])).rows[0].id;
 pendingPostId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'Disposable pending media, no provider was called',
  'https://res.cloudinary.com/looke/image/upload/v1/m27-ci.png','image','pending')
  RETURNING id`,[members[1]])).rows[0].id;
 seasonId=(await query<{id:string}>(`INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M27 disposable policy season','active',now()-interval '3 days',
   now()+interval '3 days',now()+interval '4 days',now()+interval '5 days',
   now()+interval '20 days') RETURNING id`,
  ["m27-"+randomBytes(7).toString("hex")])).rows[0].id;
 const at=(await query<{created_at:Date}>(`SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
  'M27 disposable source-only reconciliation',$6,now()) RETURNING id`,
  [seasonId,members[1],postId,at,at.toISOString().slice(0,10),operator])).rows[0].id;
 evidenceId=(await query<{id:string}>(`INSERT INTO social_beta_evidence_signatures
  (kind,evidence_sha256,evidence_url,preview_sha,auditor,recorded_by,signed_at,signature_sha256)
  VALUES('security',$1,'https://example.com/ci-m27-evidence',$2,$3,$4,now(),$5)
  RETURNING id`,["b".repeat(64),preview.sha,originalEvidenceSigner,operator,
  createHash("sha256").update(randomBytes(64)).digest("hex")])).rows[0].id;
 reviewId=(await query<{id:string}>(`INSERT INTO social_beta_release_reviews
  (gate,preview_sha,evidence_id,recorded_by,external_reviewer,decision,signature_sha256,observed_at)
  VALUES('independent_security_audit_content_hash_and_signoff',$1,$2,$3,$4,
    'needs_more_evidence',$5,now()) RETURNING id`,
  [preview.sha,evidenceId,operator,originalReviewer.address.toLowerCase(),
   createHash("sha256").update(randomBytes(64)).digest("hex")])).rows[0].id;
});
after(async()=>{
 try{
  await query("DELETE FROM social_beta_release_witnesses WHERE submitted_by=$1",[operator]);
  await query("DELETE FROM social_beta_release_reviews WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_evidence_signatures WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1",[operator]);
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[members]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[members]);
 }finally{
  for(const k of settings){const v=old.get(k);
   if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("M27 is moderator-only and reports real pending media, full Points and strict NO-GO",async()=>{
 assert.equal((await getM27(req("anonymous","GET","/api/social/ops/m27"))).status,401);
 const result=await get();assert.equal(result.status,200);
 const data=await json(result);
 assert.equal(data.operatorAuthorized,true);
 assert.equal(data.releaseDecision,"NO_GO");
 assert.equal(data.publicBetaOpen,false);
 assert.equal(data.transactionsSent,0);
 assert.equal((data.recovery as {requiredTables:number}).requiredTables,19);
 assert.equal((data.moderatedMedia as {pendingMedia:number}).pendingMedia,1);
 const full=data.pointsFullSourceReconciliation as {scanned:number;totalApproved:number;
  complete:boolean;issues:unknown[]};
 assert.equal(full.scanned,1);assert.equal(full.totalApproved,1);
 assert.equal(full.complete,true);assert.equal(full.issues.length,0);
 assert.equal((data.externalAudit as {actualFileContentsIndependentlyInspected:boolean})
  .actualFileContentsIndependentlyInspected,false);
 assert.equal((data.walletAcceptance as {independentTwoHumanWitnessVerified:boolean})
  .independentTwoHumanWitnessVerified,false);
});
test("Two genuine wallet EIP-191 signatures and consumed nonces remain key-control, never distinct human testimony",async()=>{
 for(const owner of [owner1,owner2]){
  const issued=await post("m23",{action:"issue",wallet:owner.address.toLowerCase()});
  assert.equal(issued.status,200);
  const challenge=await json(issued);
  const signature=await owner.signMessage({message:String(challenge.message)});
  const response=await post("m23",{action:"consume",challengeId:challenge.challengeId,
   challenge:challenge.challenge,signature});
  assert.equal(response.status,200);
  assert.equal((await json(response)).independentHumanWitnessAccepted,false);
 }
 const data=await json(await get());
 const witness=data.walletAcceptance as {active_wallet_keys:number;accepted_nonce_records:number;
  independentTwoHumanWitnessVerified:boolean};
 assert.equal(witness.active_wallet_keys,2);
 assert.equal(witness.accepted_nonce_records,2);
 assert.equal(witness.independentTwoHumanWitnessVerified,false);
 assert.equal((data.rehearsal as {decision:string}).decision,"NO_GO");
});
test("Two distinct signed M26 review roles are real references only, and never authorized external signoffs",async()=>{
 const first=await post("m26",await signedRole("independent_security",security));
 assert.equal(first.status,200);
 const second=await post("m26",await signedRole("independent_operator",operatorWitness));
 assert.equal(second.status,200);
 const data=await json(await get());
 const roles=data.dualRole as {realSignedReferenceRows:number;qualifiedTwoRoleReviewIds:string[];
  actualHumanRoleSignoff:boolean;distinctRoleSeparationFailures:number};
 assert.equal(roles.realSignedReferenceRows,2);
 assert.deepEqual(roles.qualifiedTwoRoleReviewIds,[reviewId]);
 assert.equal(roles.distinctRoleSeparationFailures,0);
 assert.equal(roles.actualHumanRoleSignoff,false);
 assert.equal(data.releaseDecision,"NO_GO");
});
test("Entire approved Points ledger detects hidden-source drift but does not mutate rewards",async()=>{
 const conn=await socialDb().connect();
 try{
  const first=await reconcileEntirePointsLedger(conn,{batchSize:1,maxRows:100});
  assert.equal(first.complete,true);assert.equal(first.issues.length,0);
 }finally{conn.release();}
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
 const afterReport=await json(await get());
 const points=afterReport.pointsFullSourceReconciliation as {complete:boolean;
  issues:{ledgerId:string;reason:string}[]};
 assert.equal(points.complete,true);
 assert.ok(points.issues.some(x=>x.ledgerId===ledgerId&&x.reason==="source_missing_or_ineligible"));
 const ledger=await query<{status:string;points:number}>(`
  SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");assert.equal(ledger.rows[0].points,10);
 assert.equal(afterReport.releaseDecision,"NO_GO");
});
test("Full 19-table PostgreSQL row/schema hash includes M26 dual-role witness evidence and catches alterations",async()=>{
 const c=await socialDb().connect();
 try{
  const original=await digestM27Database(c,false);
  assert.equal(original.length,19);
  assert.equal(compareM27Databases(original,original.map(x=>({...x}))).comparison,"MATCHED_FULL_ROWS");
  await query(`UPDATE social_beta_release_witnesses
   SET decision='reference_acknowledged_unverified'
   WHERE review_id=$1 AND role='independent_security'`,[reviewId]);
  const current=await digestM27Database(c,false);
  const change=compareM27Databases(original,current);
  assert.equal(change.comparison,"MISMATCH");
  assert.ok(change.differences.some(x=>x.table==="social_beta_release_witnesses"));
  assert.equal(change.operatorRestoreWitnessAccepted,false);
  assert.equal(change.releaseAuthorized,false);
 }finally{c.release();}
});
