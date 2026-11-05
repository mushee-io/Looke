import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin} from "../../../../../lib/social/auth";
import {query,rateLimit,socialDb} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m25ReadOnly} from "../m25/route";
import {previewIdentity} from "../../../../../lib/beta/m23-witness";
import {m26Decision,witnessWritesEnabled,verifyWitness,signatureHash,strictFinalDecision} from "../../../../../lib/beta/m26-acceptance";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const safe={"cache-control":"private, no-store"};
type Row={id:string;review_id:string;role:string;witness_wallet:string;
 decision:string;observed_at:Date;recorded_at:Date;evidence_sha256:string};
type Linked={id:string;preview_sha:string;gate:string;recorded_by:string;
 external_reviewer:string;evidence_id:string;evidence_sha256:string;auditor:string};
export async function GET(req:NextRequest){
 try{
  const operator=(await requireViewer(req)).address;assertModerator(operator);
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [m25,witnesses]=await Promise.all([
   m25ReadOnly(req),
   query<Row>(`SELECT id,review_id,role,witness_wallet,decision,observed_at,recorded_at,evidence_sha256
     FROM social_beta_release_witnesses WHERE preview_sha=$1
     ORDER BY recorded_at DESC LIMIT 40`,[sha]),
  ]);
  if(!m25.ok)return m25;
  const m25Data=await m25.json() as {
   gate:{decision:string;releaseFlagsClosed:boolean;unresolvedReleaseGates:number};
   distinctSignedWalletKeys:number;twoIndependentHumanWalletWitnessesApproved:false;
   verifiedSourceReferences:unknown[];
   operatorEvidenceReviews:unknown[];
   moderation:{providerInspection:{status:string;reason:string}|null;pendingMedia:number;openReports:number};
   actualPoints:{mismatches:number;complete:boolean;manualRiskReviews:number};
   independentCreatorAssetProof:unknown;incidentObservations:unknown[];
  };
  const decision=strictFinalDecision({
   m25Decision:m25Data.gate.decision,flagsClosed:m25Data.gate.releaseFlagsClosed,
   witnesses:witnesses.rows,digestMatched:false,sourceEvidenceVerified:false,
   operatorAuthorized:false,twoIndependentHumansObserved:false,providerAuthenticated:false,
  });
  return NextResponse.json({
   reviewerAuthorized:true,readOnly:true,milestone:"M26",immutablePreviewSha:sha||null,
   witnessWritesEnabled:witnessWritesEnabled(),decision,
   publicBetaOpen:false,realSignedEvidence:m25Data.verifiedSourceReferences,
   m25ReviewReferences:m25Data.operatorEvidenceReviews,
   dualRoleWitnessReferences:witnesses.rows.map(r=>({
    ...r,independentHumanIdentityEstablished:false,
    sourceDocumentVerified:false,releaseAuthorization:false,
   })),
   walletProofs:{distinctPublicKeys:m25Data.distinctSignedWalletKeys,
    independentlyWitnessedHumans:false},
   media:{...m25Data.moderation,liveProviderAccountVerified:false},
   currentChainEvidence:m25Data.independentCreatorAssetProof,
   points:{...m25Data.actualPoints,manualAntiSybilCleared:false},
   recovery:{tableCount:18,tool:"npm run m26:full-restore-audit",
    actualBackupsRestored:false,separateTLSHostDigestObservedByThisRequest:false,
    differentHumanRestoreWitness:false},
   externalAudits:{references:m25Data.operatorEvidenceReviews.length,
    independentlyInspectedOriginalFiles:false,approvedByAuditor:false},
   incidents:m25Data.incidentObservations,operatorRollbackEvidencePassed:false,
   outstanding:[ "Independent human observation of two real wallet sessions",
    "Actual authenticated media provider inspection and moderator review",
    "Current real Ultra EVM creator coin transaction and native Uniq ownership",
    "Current source-backed Points and manual anti-sybil reconciliation",
    "Verified separately restored TLS PostgreSQL full 18-table digest and distinct human witness",
    "Actual audited report file bytes, remediation and independent auditor decision",
    "Two separate authorized human roles and signed offchain operational GO decision",
    "Real incident rollback witness and signed-out protected Preview challenge",
   ],releaseEnabled:false,transactionsSent:0,
  },{headers:safe});
 }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!witnessWritesEnabled())throw new HttpError(503,"M26 evidence-reference writes disabled on protected Preview.");
  const operator=(await requireViewer(req)).address;assertModerator(operator);
  const input=m26Decision.parse(await readJson(req));
  const identity=previewIdentity();
  await rateLimit(operator,"m26_witness",12,600);
  const db=socialDb(),c=await db.connect();
  try{
   await c.query("BEGIN");
   // Serialize all reviewers against the same real M25 review row.
   const review=await c.query<Linked>(`SELECT r.id,r.preview_sha,r.gate,r.recorded_by,
     r.external_reviewer,r.evidence_id,e.evidence_sha256,e.auditor
     FROM social_beta_release_reviews r
     JOIN social_beta_evidence_signatures e ON e.id=r.evidence_id
     WHERE r.id=$1 AND r.preview_sha=$2 AND e.preview_sha=$2
     FOR UPDATE OF r`,[input.reviewId,identity.sha]);
   const source=review.rows[0];
   if(!source)throw new HttpError(409,"Existing exact-commit M25 review and signed M23 source required.");
   if(source.recorded_by!==operator)throw new HttpError(403,"Recorded source operator required.");
   const prior=await c.query<{role:string;witness_wallet:string}>(`
     SELECT role,witness_wallet FROM social_beta_release_witnesses
     WHERE review_id=$1 FOR UPDATE`,[source.id]);
   if(prior.rows.some(x=>x.role===input.role||
       x.witness_wallet.toLowerCase()===input.witnessWallet.toLowerCase()))
    throw new HttpError(409,"Role already signed or witness not independent from earlier role.");
   const verified=await verifyWitness(input,{
    origin:identity.origin,sha:identity.sha,evidenceSha:source.evidence_sha256,
    gate:source.gate,operator,originalReviewer:source.external_reviewer,
    evidenceSigner:source.auditor,
   });
   if(!verified.valid)throw new HttpError(403,verified.reason);
   const inserted=await c.query<{id:string}>(`INSERT INTO social_beta_release_witnesses
     (review_id,preview_sha,role,witness_wallet,submitted_by,decision,
      observed_at,signature_sha256,evidence_sha256)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`,[
      input.reviewId,identity.sha,input.role,input.witnessWallet,operator,input.decision,
      new Date(input.observedAt),signatureHash(input.signature),source.evidence_sha256,
     ]);
   if(inserted.rowCount!==1)throw new HttpError(409,"Duplicate external witness evidence reference.");
   await c.query("COMMIT");
   return NextResponse.json({ok:true,id:inserted.rows[0].id,
    signatureVerified:true,role:input.role,
    independentHumanIdentityVerified:false,sourceDocumentContentsVerified:false,
    betaActivated:false,productionChanged:false,financialBroadcasts:0,
    releaseDecision:"NO_GO",
    note:"External cryptographic signer acknowledged a reference only. Real human identity and independent operational GO have not been verified."},{headers:safe});
  }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 }catch(e){return failure(e);}
}
