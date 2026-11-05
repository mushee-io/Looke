import assert from "node:assert/strict";
import {before,after,test} from "node:test";
import {createHash,randomBytes} from "node:crypto";
import {NextRequest} from "next/server";
import {bytesToHex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {query,socialDb} from "../src/lib/social/db";
import {GET as m29GET} from "../src/app/api/social/ops/m29/route";
import {POST as m23POST} from "../src/app/api/social/ops/m23/route";
import {observerBinding,verifyConsumedWalletPair,type M29WalletPacket,type OneTimeWalletRow} from "../src/lib/beta/m29-wallet-crosscheck";
import {digestM27Database,compareM27Databases,reconcileEntirePointsLedger} from "../src/lib/beta/m27-evidence";

const holders=[privateKeyToAccount(bytesToHex(randomBytes(32))),
 privateKeyToAccount(bytesToHex(randomBytes(32)))];
const observers=[privateKeyToAccount(bytesToHex(randomBytes(32))),
 privateKeyToAccount(bytesToHex(randomBytes(32)))];
const operator="0x"+randomBytes(20).toString("hex");
const members=[operator,...holders.map(x=>x.address.toLowerCase())];
const origin="https://looke-m29-disposable-test.vercel.app",sha="a".repeat(40);
const settings=["LOOKE_SOCIAL_APP_ORIGIN","LOOKE_SOCIAL_MODERATORS",
 "LOOKE_M23_PREVIEW_ORIGIN","LOOKE_M23_PREVIEW_SHA","VERCEL_GIT_COMMIT_SHA",
 "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_PUBLIC_BETA_ENABLED",
 "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED"];
const prior=new Map<string,string|undefined>();
let cookie="",postId="",seasonId="",ledgerId="";
function req(who:"moderator"|"anonymous",method:"GET"|"POST",
 path="/api/social/ops/m29",body?:Record<string,unknown>){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(who==="moderator"?{cookie:COOKIE_NAME+"="+cookie}:{}),
   ...(method==="POST"?{origin:"http://localhost:3000","content-type":"application/json"}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function send(data:Record<string,unknown>){return m23POST(req("moderator","POST","/api/social/ops/m23",data));}
async function parse(r:Response){return r.json() as Promise<Record<string,unknown>>;}
before(async()=>{
 for(const k of settings)prior.set(k,process.env[k]);
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_SOCIAL_MODERATORS=operator;
 process.env.LOOKE_M23_PREVIEW_ORIGIN=origin;
 process.env.LOOKE_M23_PREVIEW_SHA=sha;
 delete process.env.VERCEL_GIT_COMMIT_SHA;
 process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED="true";
 process.env.LOOKE_PUBLIC_BETA_ENABLED="false";
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 for(const wallet of members)await query(`
  INSERT INTO social_profiles(address,handle,display_name,created_at)
  VALUES($1,$2,'M29 disposable CI profile only',now()-interval '10 days')`,
  [wallet,"u"+wallet.slice(2,17)]);
 cookie=randomBytes(32).toString("hex");
 await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
  VALUES($1,$2,now()+interval '1 hour')`,
  [createHash("sha256").update(cookie).digest("hex"),operator]);
 postId=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,created_at)
  VALUES($1,'M29 disposable creator source test only',now()-interval '9 minutes')
  RETURNING id`,[members[1]])).rows[0].id;
 seasonId=(await query<{id:string}>(`
  INSERT INTO social_points_seasons
  (slug,title,state,starts_at,ends_at,vest_start_at,vest_cliff_at,vest_end_at)
  VALUES($1,'M29 CI only','active',now()-interval '3 days',
  now()+interval '3 days',now()+interval '4 days',now()+interval '6 days',
  now()+interval '20 days') RETURNING id`,
  ["m29-"+randomBytes(7).toString("hex")])).rows[0].id;
 const when=(await query<{created_at:Date}>(`
  SELECT created_at FROM social_posts WHERE id=$1`,[postId])).rows[0].created_at;
 ledgerId=(await query<{id:string}>(`
  INSERT INTO social_points_ledger
  (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,
   points,status,review_note,reviewed_by,reviewed_at)
  VALUES($1,$2,'post',$3,$2,$4,$5,10,'approved',
   'Disposable M29 source check',$6,now()) RETURNING id`,
  [seasonId,members[1],postId,when,when.toISOString().slice(0,10),operator])).rows[0].id;
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
  for(const k of settings){const v=prior.get(k);if(v===undefined)delete process.env[k];else process.env[k]=v;}
  await socialDb().end();
 }
});
test("Operator M29 GET is authenticated, source-backed and NO-GO with no synthetic review approvals",async()=>{
 assert.equal((await m29GET(req("anonymous","GET"))).status,401);
 const r=await m29GET(req("moderator","GET"));assert.equal(r.status,200);
 const body=await parse(r);
 assert.equal(body.operatorAuthorized,true);
 assert.equal(body.decision,"NO_GO");
 assert.equal(body.publicBetaOpen,false);
 assert.equal(body.productionChanged,false);
 assert.equal(body.financialTransactionsSent,0);
 assert.equal((body.fullOperatorChecklist as unknown[]).length,8);
 const stats=body.realTechnicalObservations as {authenticAtomicNonceRecords:number;distinctAcceptedKeyCount:number};
 assert.equal(stats.authenticAtomicNonceRecords,0);
 assert.equal(stats.distinctAcceptedKeyCount,0);
});
test("Two genuinely issued and atomically consumed M23 nonces plus FOUR real EIP-191 signatures crosscheck from PostgreSQL",async()=>{
 const sessions=[] as M29WalletPacket["sessions"][number][];
 for(let i=0;i<2;i++){
  const issue=await send({action:"issue",wallet:holders[i].address.toLowerCase()});
  assert.equal(issue.status,200);
  const output=await parse(issue);
  const signature=await holders[i].signMessage({message:String(output.message)});
  const input={action:"consume",challengeId:output.challengeId,
   challenge:output.challenge,signature};
  const accepted=await send(input);assert.equal(accepted.status,200);
  const result=await parse(accepted);
  assert.equal(result.nonceConsumed,true);
  assert.equal(result.independentHumanWitnessAccepted,false);
  assert.equal((await send(input)).status,409);
  const actual=await query<OneTimeWalletRow>(`
   SELECT c.id,c.wallet,c.reviewer,c.nonce,c.preview_origin,c.preview_sha,
    c.challenge_message,c.consumed_at,c.expires_at,a.verified_at,
    a.wallet AS accepted_wallet,a.signature_sha256
   FROM social_beta_wallet_challenges c
   JOIN social_beta_wallet_acceptances a ON a.challenge_id=c.id
   WHERE c.id=$1`,[output.challengeId]);
  const row=actual.rows[0],observedAt=new Date().toISOString();
  const observer=observers[i].address.toLowerCase();
  const observerSignature=await observers[i].signMessage({
   message:observerBinding({origin,commit:sha},row,{observer,observedAt})});
  sessions.push({challengeId:String(output.challengeId),
   walletSignature:signature,observer,observerSignature,observedAt});
 }
 const packet={origin,commit:sha,sessions:sessions as M29WalletPacket["sessions"]};
 const c=await socialDb().connect();
 try{
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try{
   const result=await verifyConsumedWalletPair(c,packet);
   assert.equal(result.consumedNonceEvidenceVerified,true);
   assert.equal(result.walletKeysVerified,2);
   assert.equal(result.observerKeysVerified,2);
   assert.equal(result.distinctKeyCount,4);
   assert.equal(result.originalConsumptionReplayProtected,true);
   assert.equal(result.offlineAuditReportItselfReplayProtected,false);
   assert.equal(result.independentlyVerifiedHumanWitnesses,false);
   assert.equal(result.publicBetaAuthorized,false);
   await assert.rejects(()=>verifyConsumedWalletPair(c,{
    ...packet,sessions:[packet.sessions[0],{...packet.sessions[1],
     walletSignature:packet.sessions[0].walletSignature}]},new Date()),/signature hash/);
   await assert.rejects(()=>verifyConsumedWalletPair(c,{
    ...packet,commit:"b".repeat(40)},new Date()),/database records/);
   await c.query("COMMIT");
  }catch(e){await c.query("ROLLBACK");throw e;}
 }finally{c.release();}
 const report=await parse(await m29GET(req("moderator","GET")));
 const values=report.realTechnicalObservations as {
  authenticAtomicNonceRecords:number;distinctAcceptedKeyCount:number;
  recordsWithMissingOrInvalidConsumption:number;
 };
 assert.equal(values.authenticAtomicNonceRecords,2);
 assert.equal(values.distinctAcceptedKeyCount,2);
 assert.equal(values.recordsWithMissingOrInvalidConsumption,0);
 assert.equal(report.decision,"NO_GO");
});
test("Complete real-source Points reconciliation catches reversed eligibility without issuing rewards",async()=>{
 const c=await socialDb().connect();
 try{
  const check=await reconcileEntirePointsLedger(c,{batchSize:1,maxRows:50});
  assert.equal(check.complete,true);
  assert.equal(check.issues.length,0);
 }finally{c.release();}
 await query("UPDATE social_posts SET hidden=true WHERE id=$1",[postId]);
 const result=await parse(await m29GET(req("moderator","GET")));
 const stat=result.realTechnicalObservations as {sourcePointsDiscrepancies:number};
 assert.equal(stat.sourcePointsDiscrepancies,1);
 assert.equal(result.decision,"NO_GO");
 const ledger=await query<{status:string;points:number}>(`
  SELECT status,points FROM social_points_ledger WHERE id=$1`,[ledgerId]);
 assert.equal(ledger.rows[0].status,"approved");assert.equal(ledger.rows[0].points,10);
});
test("19 full PostgreSQL source/evidence table hashes retain locked release and no human-restoration inference",async()=>{
 const c=await socialDb().connect();
 try{
  const original=await digestM27Database(c,false);
  assert.equal(original.length,19);
  const result=compareM27Databases(original,original.map(x=>({...x})));
  assert.equal(result.comparison,"MATCHED_FULL_ROWS");
  assert.equal(result.operatorRestoreWitnessAccepted,false);
  assert.equal(result.releaseAuthorized,false);
 }finally{c.release();}
});
