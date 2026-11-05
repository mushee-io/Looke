import assert from "node:assert/strict";
import {after,before,test} from "node:test";
import {randomBytes,createHash,randomUUID} from "node:crypto";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {NextRequest} from "next/server";
import {query,socialDb} from "../src/lib/social/db";
import {COOKIE_NAME} from "../src/lib/social/auth";
import {GET as betaGET} from "../src/app/api/social/ops/beta/route";
import {POST as witnessPOST} from "../src/app/api/social/ops/beta/witness/route";
import {createWitnessChallenge,witnessMessage} from "../src/lib/beta/m22-witness";
import {auditReadOnlySnapshot,compareRestoredSnapshots} from "../src/lib/beta/m22-restore";

const creatorAccount=privateKeyToAccount(bytesToHex(randomBytes(32)));
const witnessAccount=privateKeyToAccount(bytesToHex(randomBytes(32)));
const moderator="0x"+randomBytes(20).toString("hex");
const creator=creatorAccount.address.toLowerCase(),other=witnessAccount.address.toLowerCase();
const wallets=[creator,other,moderator];
const sessions=new Map<string,string>();
const handle=(x:string)=>"u"+x.slice(2,17);
const origin="https://looke-m22-preview.vercel.app",revision="a".repeat(40);
const flags=[
 "LOOKE_SOCIAL_MODERATORS","LOOKE_SOCIAL_APP_ORIGIN","LOOKE_M22_PREVIEW_ORIGIN",
 "LOOKE_M22_ACCEPTANCE_SHA","LOOKE_SOCIAL_WRITES_ENABLED",
 "LOOKE_MEDIA_UPLOADS_ENABLED","LOOKE_POINTS_ACCOUNTING_ENABLED",
 "LOOKE_M20_INDEX_WRITES_ENABLED",
];
const previous=new Map<string,string|undefined>();
let approvedPost="",pendingPost="",textPost="";
function request(actor:string|null,method:"GET"|"POST",path:string,
 body?:Record<string,unknown>,host="http://localhost:3000"){
 return new NextRequest("http://localhost:3000"+path,{
  method,headers:{
   ...(actor?{cookie:COOKIE_NAME+"="+sessions.get(actor)}:{}),
   ...(method==="POST"?{origin:host,"content-type":"application/json"}:{}),
  },...(body?{body:JSON.stringify(body)}:{}),
 });
}
async function data(r:Response){return r.json() as Promise<Record<string,unknown>>;}
before(async()=>{
 for(const f of flags)previous.set(f,process.env[f]);
 process.env.LOOKE_SOCIAL_MODERATORS=moderator;
 process.env.LOOKE_SOCIAL_APP_ORIGIN="http://localhost:3000";
 process.env.LOOKE_M22_PREVIEW_ORIGIN=origin;
 process.env.LOOKE_M22_ACCEPTANCE_SHA=revision;
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="false";
 process.env.LOOKE_MEDIA_UPLOADS_ENABLED="false";
 process.env.LOOKE_POINTS_ACCOUNTING_ENABLED="false";
 process.env.LOOKE_M20_INDEX_WRITES_ENABLED="false";
 for(const a of wallets){
  await query(`INSERT INTO social_profiles(address,handle,display_name,created_at)
   VALUES($1,$2,'M22 disposable validation',now()-interval '4 days')`,[a,handle(a)]);
  const token=randomBytes(32).toString("hex");sessions.set(a,token);
  await query(`INSERT INTO social_sessions(token_hash,address,expires_at)
   VALUES($1,$2,now()+interval '30 minutes')`,
   [createHash("sha256").update(token).digest("hex"),a]);
 }
 textPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body) VALUES($1,'M22 disposable original text post')
  RETURNING id`,[creator])).rows[0].id;
 const id="looke/social/"+creator+"/"+randomUUID();
 approvedPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status,
   asset_chain,asset_type,asset_id)
  VALUES($1,'M22 approved-media CI fixture',$2,'image','approved',
   'ultra-evm','token',$3) RETURNING id`,
  [creator,"https://res.cloudinary.com/lookecloud/image/upload/v123/"+id+".png",
  "0x"+"b".repeat(40)])).rows[0].id;
 pendingPost=(await query<{id:string}>(`
  INSERT INTO social_posts(author,body,media_url,media_kind,media_status)
  VALUES($1,'M22 pending-media CI fixture',$2,'image','pending') RETURNING id`,
  [creator,"https://res.cloudinary.com/lookecloud/image/upload/v123/pending-"+randomUUID()+".png"])).rows[0].id;
});
after(async()=>{
 try{
  await query("DELETE FROM social_rate_windows WHERE actor=ANY($1::text[])",[wallets]);
  await query("DELETE FROM social_profiles WHERE address=ANY($1::text[])",[wallets]);
 }finally{
  for(const f of flags){const v=previous.get(f);
   if(v===undefined)delete process.env[f];else process.env[f]=v;}
  await socialDb().end();
 }
});
test("Beta preflight is moderator-only and reports only real creator profiles and visible moderated posts",async()=>{
 assert.equal((await betaGET(request(null,"GET","/api/social/ops/beta"))).status,401);
 assert.equal((await betaGET(request(creator,"GET","/api/social/ops/beta"))).status,403);
 const response=await betaGET(request(moderator,"GET","/api/social/ops/beta"));
 assert.equal(response.status,200);
 const r=await data(response);
 assert.equal(r.reviewerAuthorized,true);
 assert.equal(r.readOnly,true);
 assert.equal(r.betaActivated,false);
 assert.equal(r.transactionsSent,0);
 const readiness=r.readiness as {releaseDecision:string;mayActivate:boolean;publicBetaOpen:boolean;
  flagsClosed:boolean;requiredWitnesses:unknown[]};
 assert.equal(readiness.releaseDecision,"NO_GO");
 assert.equal(readiness.publicBetaOpen,false);
 assert.equal(readiness.flagsClosed,true);
 assert.equal(readiness.mayActivate,false);
 assert.equal(readiness.requiredWitnesses.length,9);
 const profiles=r.realCreatorProfiles as {address:string;handle:string;visible_posts:number}[];
 assert.ok(profiles.some(p=>p.address===creator&&p.visible_posts===2));
 const posts=r.visibleModeratedPosts as {id:string;assetAttachmentVerified:boolean}[];
 assert.ok(posts.some(x=>x.id===textPost));
 assert.ok(posts.some(x=>x.id===approvedPost));
 assert.ok(!posts.some(x=>x.id===pendingPost));
 assert.equal(posts.find(x=>x.id===approvedPost)?.assetAttachmentVerified,false);
 const m=r.moderation as {pendingMedia:number};
 assert.ok(m.pendingMedia>=1);
 assert.equal((r.points as {claimsEnabled:boolean}).claimsEnabled,false);
 assert.equal((r.recovery as {independentRestoreWitness:boolean}).independentRestoreWitness,false);
 assert.equal((r.witness as {noncePersistenceEnabled:boolean}).noncePersistenceEnabled,false);
 assert.equal((r.testFundingGuidance as unknown[]).length,6);
});
test("No fabricated creator token or native Uniq proof accepted from malformed input",async()=>{
 const bad=await betaGET(request(moderator,"GET",
  "/api/social/ops/beta?assetKind=token&factory=0xbad&tx=0xdead"));
 assert.equal(bad.status,400);
 const also=await betaGET(request(moderator,"GET",
  "/api/social/ops/beta?assetKind=uniq&factoryId=0&nativeOwner=INVALID&tokenId=0"));
 assert.equal(also.status,400);
 const unknown=await betaGET(request(moderator,"GET",
  "/api/social/ops/beta?assetKind=ether"));
 assert.equal(unknown.status,400);
});
test("Only the moderator can verify a genuine EIP-191 public signature without issuing a session",async()=>{
 const at=new Date();
 const challenge=createWitnessChallenge({address:other,origin,previewCommit:revision,now:at});
 const signature=await witnessAccount.signMessage({message:witnessMessage(challenge)});
 const body={challenge,signature};
 const unauthorized=await witnessPOST(request(creator,"POST",
  "/api/social/ops/beta/witness",body));
 assert.equal(unauthorized.status,403);
 const forged=await witnessPOST(request(moderator,"POST",
  "/api/social/ops/beta/witness",body,"https://evil.example"));
 assert.equal(forged.status,403);
 const correct=await witnessPOST(request(moderator,"POST","/api/social/ops/beta/witness",body));
 assert.equal(correct.status,200);
 const proof=await data(correct);
 assert.equal(proof.signatureValid,true);
 assert.equal(proof.status,"cryptographic-proof-only");
 assert.equal(proof.walletSessionWitnessAccepted,false);
 assert.equal(proof.operatorReviewed,false);
 assert.equal(proof.replayProtectionProven,false);
 assert.equal(proof.transactionsSent,0);
 // A second identical signature remains cryptographically valid, NOT
 // replay safe: no real session or one-use accepted witness was recorded.
 const replay=await data(await witnessPOST(request(moderator,"POST",
  "/api/social/ops/beta/witness",body)));
 assert.equal(replay.signatureValid,true);
 assert.equal(replay.replayProtectionProven,false);
 const impersonated=await witnessPOST(request(moderator,"POST",
  "/api/social/ops/beta/witness",{challenge,signature:await creatorAccount.signMessage({
   message:witnessMessage(challenge),
  })}));
 assert.equal(impersonated.status,422);
 const forgedResult=await data(impersonated);
 assert.equal(forgedResult.signatureValid,false);
});
test("M22 witness rejects stale proofs and unconfigured Preview identity",async()=>{
 const at=new Date(Date.now()-11*60_000);
 const challenge=createWitnessChallenge({address:creator,origin,previewCommit:revision,now:at});
 const signature=await creatorAccount.signMessage({message:witnessMessage(challenge)});
 const stale=await witnessPOST(request(moderator,"POST",
  "/api/social/ops/beta/witness",{challenge,signature}));
 assert.equal(stale.status,422);
 assert.equal((await data(stale)).withinFiveMinuteWindow,false);
 const original=process.env.LOOKE_M22_PREVIEW_ORIGIN;
 delete process.env.LOOKE_M22_PREVIEW_ORIGIN;
 try{
  assert.equal((await witnessPOST(request(moderator,"POST",
   "/api/social/ops/beta/witness",{challenge,signature})).status,503);
 }finally{if(original!==undefined)process.env.LOOKE_M22_PREVIEW_ORIGIN=original;}
});
test("Real disposable database snapshots are read-only, bounded, and never accepted as restored-backup witnesses",async()=>{
 const conn=await socialDb().connect();
 let before:Awaited<ReturnType<typeof auditReadOnlySnapshot>>=[];
 let second:Awaited<ReturnType<typeof auditReadOnlySnapshot>>=[];
 try{
  before=await auditReadOnlySnapshot(conn);
  second=await auditReadOnlySnapshot(conn);
 }finally{conn.release();}
 assert.equal(before.length,8);
 assert.equal(second.length,8);
 const posts=before.find(x=>x.table==="social_posts");
 assert.ok(posts && Number(posts.rows)>=3);
 assert.ok(posts?.sampleSize!==undefined&&posts.sampleSize<=50);
 const diff=compareRestoredSnapshots(before,second);
 assert.equal(diff.status,"sample_matched");
 assert.equal(diff.fullRowHashCoverage,false);
 assert.equal(diff.independentRestoreWitness,false);
 assert.equal(diff.backupProvenanceValidated,false);
 // A modified snapshot is detected, but does not trigger an unauthorized restore.
 const changed=second.map(x=>x.table==="social_posts"?{...x,rows:"999"}:x);
 assert.equal(compareRestoredSnapshots(before,changed).status,"needs_operator_review");
});
test("Preview release remains NO-GO even when social writes mistakenly enabled",async()=>{
 const prior=process.env.LOOKE_SOCIAL_WRITES_ENABLED;
 process.env.LOOKE_SOCIAL_WRITES_ENABLED="true";
 try{
  const response=await data(await betaGET(request(moderator,"GET","/api/social/ops/beta")));
  const readiness=response.readiness as {releaseDecision:string;flagsClosed:boolean;mayActivate:boolean};
  assert.equal(readiness.flagsClosed,false);
  assert.equal(readiness.releaseDecision,"NO_GO");
  assert.equal(readiness.mayActivate,false);
 }finally{if(prior===undefined)delete process.env.LOOKE_SOCIAL_WRITES_ENABLED;
  else process.env.LOOKE_SOCIAL_WRITES_ENABLED=prior;}
});
