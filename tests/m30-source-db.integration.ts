import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {query,socialDb} from "../src/lib/social/db";
import {GET as m30GET} from "../src/app/api/social/ops/m30/route";
import {POST as m23POST} from "../src/app/api/social/ops/m23/route";
import {digestM27Database,compareM27Databases} from "../src/lib/beta/m27-evidence";
const wallets=[privateKeyToAccount(bytesToHex(randomBytes(32))),
 privateKeyToAccount(bytesToHex(randomBytes(32)))];
const operator="0x"+randomBytes(20).toString("hex");
const members=[operator,...wallets.map(w=>w.address.toLowerCase())];
const fields=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_PUBLIC_BETA_ENABLED",
 "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED"];
const beforeEnv=new Map<string,string|undefined>();
let cookie="",postId="",seasonId="",ledgerId="";
function req(actor:"moderator"|"anonymous",method:"GET"|"POST",
 path="/api/social/ops/m30",body?:Record<string,unknown>){
 return new NextRequest("http://localhost:3000"+path,{method,headers:{
  ...(actor==="moderator"?{cookie:COOKIE_NAME+"="+cookie}:{}),
  ...(method==="POST"?{origin:"http://localhost:3000","content-type":"application/json"}:{}),
 },...(body?{body:JSON.stringify(body)}:{})});
}
async function send(input:Record<string,unknown>){
 return m23POST(req("moderator","POST","/api/social/ops/m23",input));
}
async function read(){return m30GET(req("moderator","GET"));}
async function json(r:Response){return r.json() as Promise<Record<string,unknown>>;}
before(async()=>{
 for(const k of fields)beforeEnv.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN="https://looke-m30-ci.vercel.app";
 process.env.LOOKE_M23_PREVIEW_SHA="a".repeat(40);
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const a of members)await query(`
  INSERT INTO social_profiles(address,handle,display_name,created_at)
  VALUES($1,$2,'M30 disposable PostgreSQL test fixture',now()-interval '8 days')`,
  [a,"u"+a.slice(2,17)]);
 cookie=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '1 hour')`,
  [createHash("sha256").update(cookie).digest("hex"),operator]);
 postId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'M30 disposable original Points source',now()-interval '8 minutes')
  RETURNING id`,[members[1]])).rows[0].id;
 seasonId=(await query<{id:string}>(`
  INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M30 disposable data','active',now()-interval '3 days',
   now()+interval '3 days',now()+interval '4 days',now()+interval '7 days',
   now()+interval '21 days') RETURNING id`,
   ["m30-"+randomBytes(7).toString("hex")])).rows[0].id;
 const time=(await query<{created_at:Date}>(`SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`
  INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
   'M30 disposable only',$6,now()) RETURNING id`,
  [seasonId,members[1],postId,time,time.toISOString().slice(0,10),operator])).rows[0].id;
});
after(async()=>{
 try{
  await query("DELETE FROM social_beta_wallet_acceptances WHERE reviewer=$1",[operator]);
  await query("DELETE FROM social_beta_wallet_challenges WHERE reviewer=$1",[operator]);
  if(seasonId)await query("DELETE FROM social_points_ledger WHERE season_id=$1",[seasonId]);
  if(seasonId)await query("DELETE FROM social_points_seasons WHERE id=$1",[seasonId]);
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[members]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[members]);
 }finally{
  for(const k of fields){const v=beforeEnv.get(k);
   if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("Authenticated M30 operator reports actual underlying PostgreSQL source and launch NO-GO",async()=>{
 assert.equal((await m30GET(req("anonymous","GET"))).status,401);
 const response=await read();assert.equal(response.status,200);
 const data=await json(response);
 assert.equal(data.moderatorAuthenticated,true);
 assert.equal(data.actualReadOnlySourceExamined,true);
 assert.equal(data.releaseDecision,"NO_GO");
 assert.equal(data.publicBetaOpen,false);
 assert.equal(data.financialBroadcasts,0);
 assert.equal(data.externalHumanSecurityAndOperatorApproval,false);
 assert.equal(data.originalExternalAuditFindingsApproved,false);
 assert.equal(data.realBackupRestoredByThisAPI,false);
 const steps=data.steps as {id:string;status:string}[];
 assert.equal(steps.length,8);
 assert.equal(steps.find(x=>x.id==="wallet_sessions")?.status,"blocked_unverified_external_evidence");
 assert.equal(steps.find(x=>x.id==="hosted_media")?.status,"blocked_missing_prerequisite");
 assert.equal(steps.find(x=>x.id==="postgres_restore19")?.status,"blocked_missing_prerequisite");
 assert.equal(steps.find(x=>x.id==="security_audit")?.status,"blocked_missing_prerequisite");
 assert.equal(data.humanAcceptanceVerifiedCount,0);
 const raw=JSON.stringify(data);
 assert.ok(!raw.includes("ci_only_password"));
});
test("Actual issued, signed and consumed two nonces count as real key evidence but never as independent humans",async()=>{
 for(const wallet of wallets){
  const issued=await send({action:"issue",wallet:wallet.address.toLowerCase()});
  assert.equal(issued.status,200);
  const out=await json(issued);
  const signature=await wallet.signMessage({message:String(out.message)});
  const consume={action:"consume",challengeId:out.challengeId,challenge:out.challenge,signature};
  const first=await send(consume);
  assert.equal(first.status,200);
  assert.equal((await json(first)).nonceConsumed,true);
  assert.equal((await send(consume)).status,409);
 }
 const data=await json(await read());
 const key=data.steps as {id:string;status:string}[];
 assert.equal(key.find(x=>x.id==="wallet_sessions")?.status,"read_only_technical_source_verified");
 assert.equal(data.technicallyVerifiedCount,2); // Wallet key control and complete Points source
 assert.equal(data.humanAcceptanceVerifiedCount,0);
 assert.equal(data.releaseDecision,"NO_GO");
});
test("Real source eligibility drift is independently detected, no Points grants or finance",async()=>{
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
 const data=await json(await read());
 const step=(data.steps as {id:string;status:string}[]).find(x=>x.id==="points_anti_sybil");
 assert.equal(step?.status,"blocked_unverified_external_evidence");
 assert.equal(data.releaseDecision,"NO_GO");
 const r=await query<{status:string;points:number}>(`
  SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(r.rows[0].status,"approved");
 assert.equal(r.rows[0].points,10);
});
test("Nineteen source and evidence PostgreSQL tables remain read-only and external human restore unverified",async()=>{
 const db=await socialDb().connect();
 try{
  const a=await digestM27Database(db,false);
  assert.equal(a.length,19);
  const matched=compareM27Databases(a,a.map(x=>({...x})));
  assert.equal(matched.comparison,"MATCHED_FULL_ROWS");
  assert.equal(matched.operatorRestoreWitnessAccepted,false);
  assert.equal(matched.releaseAuthorized,false);
 }finally{db.release();}
});
