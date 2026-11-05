import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin} from "../../../../../lib/social/auth";
import {query,rateLimit} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m24ReadOnly} from "../m24/route";
import {previewIdentity} from "../../../../../lib/beta/m23-witness";
import {m25ReviewBody,m25WritesEnabled,verifyM25Review,signatureHash,
 finalOperatorReviewGate} from "../../../../../lib/beta/m25-register";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type SignedEvidence={id:string;kind:string;evidence_sha256:string;evidence_url:string;
 preview_sha:string;auditor:string;recorded_by:string;recorded_at:Date};
type ReviewRow={id:string;gate:string;recorded_by:string;external_reviewer:string;
 decision:string;observed_at:Date;recorded_at:Date;evidence_id:string};
type TwoKeyWitness={wallet:string;reviewer:string;verified_at:Date;
 consumed_at:Date;preview_sha:string};
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [base,reviewRows,evidence,wallets]=await Promise.all([
   m24ReadOnly(req),
   query<ReviewRow>(`SELECT id,gate,recorded_by,external_reviewer,decision,
     observed_at,recorded_at,evidence_id
     FROM social_beta_release_reviews WHERE preview_sha=$1
     ORDER BY recorded_at DESC,id DESC LIMIT 40`,[sha]),
   query<SignedEvidence>(`SELECT id,kind,evidence_sha256,evidence_url,
     preview_sha,auditor,recorded_by,recorded_at
     FROM social_beta_evidence_signatures WHERE preview_sha=$1
     ORDER BY recorded_at DESC LIMIT 40`,[sha]),
   query<TwoKeyWitness>(`SELECT a.wallet,a.reviewer,a.verified_at,c.consumed_at,c.preview_sha
      FROM social_beta_wallet_acceptances a
      JOIN social_beta_wallet_challenges c ON c.id=a.challenge_id
      JOIN social_profiles p ON p.address=a.wallet
      WHERE c.preview_sha=$1 AND c.consumed_at IS NOT NULL
        AND p.suspended=false
      ORDER BY a.verified_at DESC LIMIT 40`,[sha]),
  ]);
  if(!base.ok)return base;
  const m24=await base.json() as {
   review:{decision:string;featureFlagsClosed:boolean};
   realModeration:{providerInspection:{status:string;reason:string}|null;
    pendingMedia:number;openReports:number};
   points:{complete:boolean;mismatches:number;totalApproved:number;approvedSourceScan:number;
    manualRiskReviews:number};
   realCreatorAssetProof:unknown;
   incidentJournal:{id:string;event_type:string;severity:string;observation:string}[];
  };
  const distinct=new Set(wallets.rows.map(w=>w.wallet));
  const gate=finalOperatorReviewGate({
   m24Decision:m24.review.decision,flagsClosed:m24.review.featureFlagsClosed,
   reviews:reviewRows.rows,
   humanWitnessAccepted:false,restoreWitnessAccepted:false,
   auditContentsVerified:false,
   providerVerified:m24.realModeration.providerInspection?.status==="verified",
  });
  return NextResponse.json({
   milestone:"M25",readOnly:true,reviewerAuthorized:true,
   reviewWritesEnabled:m25WritesEnabled(),immutablePreviewSha:sha||null,
   gate,
   operatorEvidenceReviews:reviewRows.rows.map(r=>({
    ...r,artifactBytesIndependentlyVerified:false,
    securityReviewHumanApproved:false,releasePermission:false,
   })),
   verifiedSourceReferences:evidence.rows,
   realOneUseWalletProofs:wallets.rows,
   distinctSignedWalletKeys:distinct.size,
   twoIndependentHumanWalletWitnessesApproved:false,
   moderation:m24.realModeration,
   actualPoints:m24.points,
   independentCreatorAssetProof:m24.realCreatorAssetProof,
   recovery:{full17TableTechnicalDigestTool:"npm run m24:full-restore-audit",
    actualIndependentlyRestoredBackupVerified:false,
    actualWitnessedDisasterRecovery:false,
    note:"Only independently compared actual primary and separately restored TLS PostgreSQL data may be accepted as a technical comparison. A separate operational witness is mandatory."},
   incidentObservations:m24.incidentJournal,
   operatorChecklist:[
    "Use real M23 one-use wallet signature records. Verify two separately controlled wallets and have an independent human observe both sessions; two keys alone prove no human uniqueness.",
    "Re-read actual Cloudinary provider media metadata, moderation audit trail and scan status. Pending/rejected posts must stay invisible.",
    "Provide canonical Ultra EVM CoinCreated factory transaction and current native Uniq owner evidence. Require independent RPC confirmation, never textual attachments.",
    "Complete PostgreSQL Points ledger source reconciliation and manually investigate sybil clusters, account age and source reversals. No claims are enabled.",
    "Restore an authentic primary backup into a separately controlled TLS PostgreSQL host; capture consistent cutoff and run the full 17-table schema/row SHA-256 comparison; have a different operator witness.",
    "Verify actual audit file bytes against a previously signed M23 external evidence hash; have independent reviewers inspect findings, scope and remediation.",
    "Use the signed, append-only M25 references only as records of external review acknowledgements, never as automated beta activation or completed independent approval.",
    "Review genuine incident records, Vercel Preview protection and protected production alias. A rollback must be separately authorized by an operator; this endpoint cannot deploy or roll back.",
    "Record a formal go/no-go decision outside this API after independent approval. Until then, release stays NO-GO and all beta/social/financial features remain off.",
   ],
   publicBetaActivated:false,productionChanged:false,transactionsSent:0,
  },{headers});
 }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!m25WritesEnabled())throw new HttpError(503,
   "M25 independent review reference recording is disabled on protected Preview.");
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const input=m25ReviewBody.parse(await readJson(req));
  const identity=previewIdentity();
  await rateLimit(actor,"m25_review",12,600);
  const signed=await query<SignedEvidence>(`SELECT id,kind,evidence_sha256,evidence_url,
    preview_sha,auditor,recorded_by,recorded_at
    FROM social_beta_evidence_signatures WHERE id=$1 AND preview_sha=$2`,
    [input.evidenceId,identity.sha]);
  const source=signed.rows[0];
  if(!source)throw new HttpError(409,"Actual signed evidence record for this immutable Preview commit required.");
  if(source.recorded_by!==actor)throw new HttpError(403,"The authenticated evidence-recording operator must own this review request.");
  if(source.auditor===input.externalReviewer)
   throw new HttpError(403,"External gate reviewer must be distinct from both reporter and original evidence signer.");
  const kindRules:Record<string,string>={
   complete_postgres_backup_restore_hashes:"restore",
   different_operator_witnessed_restore:"restore",
   independent_security_audit_content_hash_and_signoff:"security",
   explicit_operator_public_beta_go_live_authorization:"operator",
  };
  const expectedKind=kindRules[input.gate];
  if(expectedKind&&source.kind!==expectedKind)
   throw new HttpError(409,"Signed evidence type does not match this release gate.");
  if(input.gate==="two_real_wallets_with_independent_human_witness"){
   const count=await query<{count:string}>(`SELECT count(DISTINCT a.wallet)::text AS count
     FROM social_beta_wallet_acceptances a
     JOIN social_beta_wallet_challenges c ON c.id=a.challenge_id
     JOIN social_profiles p ON p.address=a.wallet
     WHERE c.preview_sha=$1 AND c.consumed_at IS NOT NULL AND p.suspended=false`,
     [identity.sha]);
   if(Number(count.rows[0]?.count)<2)
    throw new HttpError(409,"Two real one-use cryptographic key-control records are required before referencing a human witness.");
  }
  const verified=await verifyM25Review(input,{
    identity,artifactHash:source.evidence_sha256,operator:actor,
  });
  if(!verified.valid)throw new HttpError(403,verified.reason);
  const inserted=await query<{id:string}>(`INSERT INTO social_beta_release_reviews
   (gate,preview_sha,evidence_id,recorded_by,external_reviewer,decision,
    signature_sha256,observed_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT DO NOTHING RETURNING id`,[
    input.gate,identity.sha,input.evidenceId,actor,input.externalReviewer,
    input.decision,signatureHash(input.signature),new Date(input.observedAt),
   ]);
  if(inserted.rowCount!==1)throw new HttpError(409,"The reviewer has already recorded this evidence reference.");
  return NextResponse.json({
   ok:true,reviewId:inserted.rows[0].id,signatureVerified:true,
   artifactBytesVerified:false,independentHumanAcceptanceApproved:false,
   releaseDecision:"NO_GO",publicBetaActivated:false,
   productionChanged:false,transactionsSent:0,
   note:"One independently signed evidence-reference acknowledgement was recorded. Actual file contents, provider evidence, restore witnesses, findings, human independence and go-live authorization remain externally unverified.",
  },{headers});
 }catch(e){return failure(e);}
}
