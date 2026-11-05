import {type NextRequest,NextResponse} from "next/server";
import {verifyMessage} from "viem";
import {HttpError,requireViewer,verifyRequestOrigin} from "../../../../../lib/social/auth";
import {query,rateLimit,socialDb} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {reconcileApproved} from "../../../../../lib/social/m20-reconcile";
import {GET as betaReadOnly} from "../beta/route";
import {GET as acceptanceReadOnly} from "../acceptance/route";
import {
 issueSchema,consumeSchema,recordEvidenceSchema,previewIdentity,acceptanceWritesEnabled,
 createWitnessChallenge,witnessMessage,verifyAuditorSignature,signatureDigest,
} from "../../../../../lib/beta/m23-witness";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type ChallengeRow={id:string;wallet:string;reviewer:string;challenge_message:string;
 nonce:string;preview_sha:string;preview_origin:string;expires_at:Date;consumed_at:Date|null};
type WalletRow={wallet:string;reviewer:string;verified_at:Date;session_expires_at:Date;challenge_id:string};
type AuditRow={kind:string;auditor:string;recorded_by:string;evidence_sha256:string;
 evidence_url:string;recorded_at:Date};
type Counts={realProfiles:number;visiblePosts:number;pendingMedia:number;
 openReports:number;riskReviews:number;realMediaUploads:number};

export async function GET(req:NextRequest){
 try{
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const previewCommit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [wallets,audits,stats,db]=await Promise.all([
   query<WalletRow>(`SELECT a.wallet,a.reviewer,a.verified_at,a.session_expires_at,a.challenge_id
     FROM social_beta_wallet_acceptances a JOIN social_beta_wallet_challenges c
       ON c.id=a.challenge_id
     WHERE a.session_expires_at>now() AND c.preview_sha=$1
     ORDER BY a.verified_at DESC LIMIT 20`,[previewCommit]),
   query<AuditRow>(`SELECT kind,auditor,recorded_by,evidence_sha256,evidence_url,recorded_at
     FROM social_beta_evidence_signatures WHERE preview_sha=$1
     ORDER BY recorded_at DESC LIMIT 20`,[previewCommit]),
   query<Counts>(`SELECT
      (SELECT count(*)::integer FROM social_profiles WHERE suspended=false) AS "realProfiles",
      (SELECT count(*)::integer FROM social_posts p JOIN social_profiles x ON x.address=p.author
       WHERE p.hidden=false AND p.deleted_at IS NULL AND x.suspended=false
       AND (p.media_url IS NULL OR p.media_status='approved')) AS "visiblePosts",
      (SELECT count(*)::integer FROM social_posts WHERE media_status='pending') AS "pendingMedia",
      (SELECT count(*)::integer FROM social_reports WHERE reviewed_at IS NULL) AS "openReports",
      (SELECT count(*)::integer FROM social_risk_review_events) AS "riskReviews",
      (SELECT count(*)::integer FROM social_media_uploads WHERE state='attached') AS "realMediaUploads"`),
   socialDb().connect(),
  ]);
  let points;
  try{points=await reconcileApproved(db,40);}finally{db.release();}
  const [beta,live]=await Promise.all([
   req.nextUrl.searchParams.has("assetKind")?betaReadOnly(req):null,
   req.nextUrl.searchParams.get("live")==="true"?acceptanceReadOnly(req):null,
  ]);
  let independentAssetProof:null|unknown=null;
  if(beta){if(!beta.ok)return beta;
   independentAssetProof=(await beta.json() as {independentAssetProof:unknown}).independentAssetProof;}
  let independentMediaProvider:{status:string;reason:string}|null=null;
  let independentRpc:unknown=null;
  if(live){if(!live.ok)return live;
   const r=await live.json() as {liveEvidence:{provider:{status:string;reason:string}|null;rpc:unknown}};
   independentMediaProvider=r.liveEvidence.provider;
   independentRpc=r.liveEvidence.rpc;
  }
  const distinct=new Set(wallets.rows.map(x=>x.wallet));
  const evidenceKinds=new Set(audits.rows.map(a=>a.kind));
  return NextResponse.json({
   milestone:"M23",reviewerAuthorized:true,readOnly:true,
   previewOnly:true,publicBetaOpen:false,releaseDecision:"NO_GO",
   acceptanceWritesEnabled:acceptanceWritesEnabled(),
   previewIdentity:{origin:process.env.LOOKE_M23_PREVIEW_ORIGIN||null,sha:previewCommit||null},
   nonceConsumptionSupported:true,
   operatorWalletProofs:wallets.rows,
   distinctWalletsWithConsumedNonce:distinct.size,
   twoWalletCryptographicProof:distinct.size>=2,
   twoWalletIndependentHumanWitnessAccepted:false,
   socialLoginSessionsCreated:0,
   reports:stats.rows[0],
   pointsReconciliation:points,
   countersignatures:audits.rows.map(a=>({
     ...a,artifactContentIndependentlyVerified:false,
   })),
   externalSignaturesRecorded:[...evidenceKinds],
   securityAuditApproved:false,
   databaseRestoreIndependentlyWitnessed:false,
   operatorReleaseApproved:false,
   independentlyCheckedMediaProvider:independentMediaProvider,
   independentChainHeads:independentRpc,
   independentAssetProof,
   liveProviderVerification:"Run M21 security ?live=true provider check with real approved media and authenticated provider credentials; stored metadata alone is not provider proof.",
   independentChainEvidence:"Only independently checked Ultra EVM receipts and native Ultra current ownership qualify; post references alone are not proof.",
   note:"A consumed genuine EIP-191 challenge is a cryptographically checked, one-use acceptance-only witness; NOT an existing social auth cookie, unique-human verification, an independent human approval, or a beta release.",
   transactionsSent:0,
  },{headers});
 }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!acceptanceWritesEnabled())throw new HttpError(503,
   "M23 controlled operator evidence writes are disabled on Preview.");
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const body=await readJson(req);
  const identity=previewIdentity();
  if(body.action==="issue"){
   const input=issueSchema.parse(body);
   if(input.wallet===reviewer)throw new HttpError(403,"Witness wallet must not be the operator wallet.");
   await rateLimit(reviewer,"m23_issue",12,600);
   const owner=await query<{address:string}>(`SELECT address FROM social_profiles
    WHERE address=$1 AND suspended=false`,[input.wallet]);
   if(owner.rowCount!==1)throw new HttpError(404,"Genuine unsuspended creator profile required.");
   const challenge=createWitnessChallenge({
    address:input.wallet,origin:identity.origin,previewCommit:identity.sha,
   });
   const message=witnessMessage(challenge);
   const created=await query<{id:string}>(`INSERT INTO social_beta_wallet_challenges
    (wallet,reviewer,preview_origin,preview_sha,challenge_message,nonce,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[
    input.wallet,reviewer,identity.origin,identity.sha,message,challenge.nonce,
    new Date(challenge.expiresAt),
   ]);
   return NextResponse.json({ok:true,challengeId:created.rows[0].id,challenge,
    message,expiresAt:challenge.expiresAt,transactionRequired:false,
    note:"Have the real wallet holder personally sign this EIP-191 message only. No private key or on-chain transaction."},{headers});
  }
  if(body.action==="consume"){
   const input=consumeSchema.parse(body);
   await rateLimit(reviewer,"m23_consume",25,600);
   const challengeRow=await query<ChallengeRow>(`
    SELECT id,wallet,reviewer,challenge_message,nonce,preview_sha,preview_origin,
     expires_at,consumed_at FROM social_beta_wallet_challenges WHERE id=$1`,[input.challengeId]);
   const stored=challengeRow.rows[0];
   if(!stored||stored.reviewer!==reviewer||stored.consumed_at||
      new Date(stored.expires_at).getTime()<=Date.now())
    throw new HttpError(409,"Challenge is expired, consumed or belongs to another operator.");
   const matched=stored.wallet===input.challenge.address.toLowerCase() &&
    stored.preview_origin===identity.origin && stored.preview_sha===identity.sha &&
    stored.nonce===input.challenge.nonce &&
    stored.challenge_message===witnessMessage(input.challenge) &&
    new Date(stored.expires_at).getTime()===Date.parse(input.challenge.expiresAt);
   if(!matched)throw new HttpError(409,"Signature payload does not match the actual one-use server-issued challenge.");
   const valid=await verifyMessage({
    address:stored.wallet as `0x${string}`,message:stored.challenge_message,
    signature:input.signature as `0x${string}`,
   });
   if(!valid)throw new HttpError(401,"Wallet signature does not match the issued challenge.");
   const db=socialDb();const conn=await db.connect();
   try{
    await conn.query("BEGIN");
    // Atomic nonce consumption is the replay barrier. Exactly one concurrent verifier wins.
    const consumed=await conn.query<{wallet:string}>(`UPDATE social_beta_wallet_challenges
     SET consumed_at=now() WHERE id=$1 AND reviewer=$2 AND consumed_at IS NULL
       AND expires_at>now() RETURNING wallet`,[stored.id,reviewer]);
    if(consumed.rowCount!==1)throw new HttpError(409,"Challenge was already consumed.");
    const recorded=await conn.query<{id:string}>(`INSERT INTO social_beta_wallet_acceptances
     (challenge_id,wallet,reviewer,signature_sha256,session_expires_at)
     VALUES($1,$2,$3,$4,now()+interval '10 minutes') RETURNING id`,
     [stored.id,stored.wallet,reviewer,signatureDigest(input.signature)]);
    await conn.query("COMMIT");
    return NextResponse.json({ok:true,acceptanceId:recorded.rows[0].id,
     wallet:stored.wallet,nonceConsumed:true,signatureVerified:true,
     acceptanceSessionScope:"operator-only-readiness",
     socialLoginCreated:false,independentHumanWitnessAccepted:false,
     tokensIssued:0,transactionsSent:0,
     note:"Cryptographic one-use proof recorded, not an approved human beta session."},{headers});
   }catch(e){await conn.query("ROLLBACK");throw e;}finally{conn.release();}
  }
  if(body.action==="record_evidence"){
   const input=recordEvidenceSchema.parse(body);
   await rateLimit(reviewer,"m23_evidence",15,600);
   const verdict=await verifyAuditorSignature(input,identity,reviewer);
   if(!verdict.valid)throw new HttpError(403,verdict.reason);
   const recorded=await query<{id:string}>(`INSERT INTO social_beta_evidence_signatures
     (kind,evidence_sha256,evidence_url,preview_sha,auditor,recorded_by,signed_at,signature_sha256)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[
    input.kind,input.evidenceHash,input.evidenceUrl,identity.sha,input.auditor,
    reviewer,new Date(input.signedAt),signatureDigest(input.signature),
   ]);
   return NextResponse.json({ok:true,attestationId:recorded.rows[0].id,
    signatureVerified:true,artifactContentIndependentlyVerified:false,
    operationalReleaseAuthorized:false,transactionsSent:0,
    note:"External reviewer's key-control signature stored. Actual artifact, restore process, security review and human beta authorization STILL need independent checks."},{headers});
  }
  throw new HttpError(400,"Unsupported M23 operator acceptance operation.");
 }catch(e){return failure(e);}
}
