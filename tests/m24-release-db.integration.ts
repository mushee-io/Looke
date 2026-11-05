import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {NextRequest} from "next/server";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {query,socialDb} from "../src/lib/social/db";
import {GET,POST} from "../src/app/api/social/ops/m24/route";
import {POST as witnessPOST} from "../src/app/api/social/ops/m23/route";
import {digestFullDatabase,compareFullDatabase,tables} from "../src/lib/beta/m24-full-restore";

const first=privateKeyToAccount(bytesToHex(randomBytes(32)));
const second=privateKeyToAccount(bytesToHex(randomBytes(32)));
const auditor=privateKeyToAccount(bytesToHex(randomBytes(32)));
const operator="0x"+randomBytes(20).toString("hex");
const owners=[first.address.toLowerCase(),second.address.toLowerCase(),
 auditor.address.toLowerCase(),operator];
const sha="a".repeat(40),origin="https://looke-m24-preview.vercel.app";
const settings=[
 "LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M24_INCIDENT_WRITES_ENABLED",
 "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED",
 "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
];
const old=new Map<string,string|undefined>();
let cookie="",postId="",seasonId="",ledgerId="",evidenceId="";
function request(actor:"operator"|"anonymous",method:"GET"|"POST",
 path="/api/social/ops/m24",payload?:Record<string,unknown>,
 requestOrigin="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor==="operator"?{cookie:COOKIE_NAME+"="+cookie}:{}),
   ...(method==="POST"?{origin:requestOrigin,"content-type":"application/json"}:{}),
  },...(payload?{body:JSON.stringify(payload)}:{}),
 });
}
async function read(path="/api/social/ops/m24",actor:"operator"|"anonymous"="operator"){
 return GET(request(actor,"GET",path));
}
async function write(body:Record<string,unknown>,actor:"operator"|"anonymous"="operator",
 requestOrigin="http://localhost:3000"){
 return POST(request(actor,"POST",undefined,body,requestOrigin));
}
async function asJson(x:Response){return x.json() as Promise<Record<string,unknown>>;}
before(async()=>{
 for(const key of settings)old.set(key,process.env[key]);
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_M23_PREVIEW_ORIGIN=origin;
 process.env.LOOKE_M23_PREVIEW_SHA=sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED="true";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const address of owners){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
   VALUES($1,$2,'M24 disposable acceptance fixture',now()-interval '5 days')`,
   [address,"u"+address.slice(2,17)]);
 }
 cookie=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '30 minutes')`,
  [createHash("sha256").update(cookie).digest("hex"),operator]);
 postId=(await query<{id:string}>(`INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'M24 source-backed audit sample',now()-interval '10 minutes') RETURNING id`,
  [owners[0]])).rows[0].id;
 seasonId=(await query<{id:string}>(`
  INSERT INTO social_points_seasons(slug,title,state,starts_at,ends_at,
   vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M24 disposable review season','active',now()-interval '2 days',now()+interval '2 days',
   now()+interval '3 days',now()+interval '4 days',now()+interval '20 days')
  RETURNING id`,
  ["m24-"+randomBytes(6).toString("hex")])).rows[0].id;
 const at=(await query<{created_at:Date}>(
  "SELECT created_at FROM social_posts WHERE id=$1",[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
   'M24 disposable policy eligibility review',$6,now()) RETURNING id`,
  [seasonId,owners[0],postId,at,at.toISOString().slice(0,10),operator])).rows[0].id;
 const signature=await auditor.signMessage({message:"CI-only external hash fixture; not independently verified."});
 evidenceId=(await query<{id:string}>(`INSERT INTO social_beta_evidence_signatures
  (kind,evidence_sha256,evidence_url,preview_sha,auditor,recorded_by,signed_at,signature_sha256)
  VALUES('security',$1,'https://evidence.example/m24/ci-only', $2,$3,$4,now(),$5) RETURNING id`,
  ["b".repeat(64),sha,owners[2],operator,createHash("sha256").update(signature).digest("hex")])).rows[0].id;
});
after(async()=>{
 try{
  await query("DELETE FROM social_beta_incident_journal WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_evidence_signatures WHERE recorded_by=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1",[operator]);
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[owners]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[owners]);
 }finally{
  for(const k of settings){const v=old.get(k);if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("Only authenticated moderators can read M24 immutable NO-GO review",async()=>{
 assert.equal((await read(undefined,"anonymous")).status,401);
 assert.equal((await write({action:"record_incident",eventType:"incident",severity:"info",
  observation:"Anonymous user attempted review access."},"anonymous")).status,401);
 const r=await read();
 assert.equal(r.status,200);
 const x=await asJson(r);
 assert.equal(x.publicBetaOpen,false);
 assert.equal(x.productionUnchangedByThisEndpoint,true);
 const review=x.review as {decision:string;mayActivate:boolean;reviewGates:unknown[];featureFlagsClosed:boolean};
 assert.equal(review.decision,"NO_GO");
 assert.equal(review.mayActivate,false);
 assert.equal(review.reviewGates.length,11);
 assert.equal(review.featureFlagsClosed,true);
 assert.equal((x.realWallets as {humanWitnessApproved:boolean}).humanWitnessApproved,false);
 assert.equal((x.recovery as {actualRestoreWitnessAccepted:boolean}).actualRestoreWitnessAccepted,false);
 assert.equal((x.points as {mismatches:number}).mismatches,0);
 assert.equal((x.evidenceReferences as {id:string;actualFileDigestRechecked:boolean}[])[0].id,evidenceId);
 assert.equal((x.evidenceReferences as {actualFileDigestRechecked:boolean}[])[0].actualFileDigestRechecked,false);
});
test("M24 real one-use M23 wallet proofs remain key-control evidence, not two independently observed human testers",async()=>{
 for(const signer of [first,second]){
  const issued=await witnessPOST(request("operator","POST","/api/social/ops/m23",
   {action:"issue",wallet:signer.address.toLowerCase()}));
  assert.equal(issued.status,200);
  const info=await asJson(issued);
  const signature=await signer.signMessage({message:String(info.message)});
  const accepted=await witnessPOST(request("operator","POST","/api/social/ops/m23",{
   action:"consume",challengeId:info.challengeId,challenge:info.challenge,signature,
  }));
  assert.equal(accepted.status,200);
  assert.equal((await asJson(accepted)).independentHumanWitnessAccepted,false);
 }
 const x=await asJson(await read());
 assert.equal((x.realWallets as {distinctKeys:number}).distinctKeys,2);
 assert.equal((x.realWallets as {humanWitnessApproved:boolean}).humanWitnessApproved,false);
 assert.equal((x.review as {decision:string}).decision,"NO_GO");
});
test("Operator incident journal only stores source-backed observations, never a rollback or launch",async()=>{
 const payload={action:"record_incident",eventType:"rollback_rehearsal",
  severity:"high",observation:"Actual protected Preview rollback drill documented without changing production.",
  evidenceId};
 assert.equal((await write(payload,"operator","https://evil.example")).status,403);
 assert.equal((await write({...payload,publicBetaOpen:true})).status,400);
 assert.equal((await write({...payload,evidenceId:"11111111-1111-4111-8111-111111111111"})).status,409);
 const success=await write(payload);assert.equal(success.status,200);
 const result=await asJson(success);
 assert.equal(result.actionTaken,"none");
 assert.equal(result.productionChanged,false);
 assert.equal(result.publicBetaActivated,false);
 const journal=await query<{action_taken:string;production_changed:boolean;
 public_beta_activated:boolean;external_evidence_id:string}>(`
  SELECT action_taken,production_changed,public_beta_activated,external_evidence_id
  FROM social_beta_incident_journal WHERE id=$1`,[result.incidentId]);
 assert.equal(journal.rows[0].action_taken,"none");
 assert.equal(journal.rows[0].production_changed,false);
 assert.equal(journal.rows[0].public_beta_activated,false);
 assert.equal(journal.rows[0].external_evidence_id,evidenceId);
 const x=await asJson(await read());
 assert.equal((x.review as {decision:string}).decision,"NO_GO");
});
test("Disabled operator write flag rejects all incident mutations while read-only review remains available",async()=>{
 const prev=process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED;
 process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED="false";
 try{
  const denied=await write({action:"record_incident",eventType:"incident",severity:"critical",
   observation:"Attempt blocked by fail-closed operator write feature flag."});
  assert.equal(denied.status,503);
  assert.equal((await read()).status,200);
 }finally{if(prev===undefined)delete process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED;
  else process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED=prev;}
});
test("Full PostgreSQL row hashing covers every record and detects a modified previously approved real source",async()=>{
 const c=await socialDb().connect();
 let firstDigest:Awaited<ReturnType<typeof digestFullDatabase>>;
 let secondDigest:Awaited<ReturnType<typeof digestFullDatabase>>;
 try{
  firstDigest=await digestFullDatabase(c,{pageSize:3,maxRowsPerTable:10000});
  assert.equal(firstDigest.length,tables.length);
  assert.equal(compareFullDatabase(firstDigest,firstDigest.map(x=>({...x}))).comparison,"MATCHED_FULL_ROWS");
  await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
  secondDigest=await digestFullDatabase(c,{pageSize:3,maxRowsPerTable:10000});
  assert.equal(compareFullDatabase(firstDigest,secondDigest).comparison,"MISMATCH");
  assert.ok(compareFullDatabase(firstDigest,secondDigest).differences.some(x=>x.table==="social_posts"));
  assert.equal(compareFullDatabase(firstDigest,secondDigest).operatorRestoreWitnessAccepted,false);
  await assert.rejects(()=>digestFullDatabase(c,{pageSize:2,maxRowsPerTable:1}),/exceeded maxRowsPerTable/);
 }finally{c.release();}
 const x=await asJson(await read());
 assert.equal((x.points as {mismatches:number}).mismatches,1);
 assert.equal((x.review as {decision:string}).decision,"NO_GO");
});
