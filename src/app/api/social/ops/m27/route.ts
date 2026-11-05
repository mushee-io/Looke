import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {query,socialDb} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m26ReadOnly} from "../m26/route";
import {m27ReleaseRehearsal,reconcileEntirePointsLedger} from "../../../../../lib/beta/m27-evidence";
import {releaseFlagsClosed} from "../../../../../lib/ops/m21-acceptance";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type Stats={
 active_wallet_keys:number;accepted_nonce_records:number;
 moderator_approved_posts:number;pending_media:number;
 pending_reports:number;manual_risk_review_events:number;
};
type Reference={review_id:string;gate:string;role:string;witness_wallet:string;
 original_signer:string;original_reviewer:string;operator:string;source_sha256:string};
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  assertModerator(actor);
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [prev,counts,references]=await Promise.all([
   m26ReadOnly(req),
   query<Stats>(`SELECT
    (SELECT count(DISTINCT a.wallet)::integer FROM social_beta_wallet_acceptances a
       JOIN social_beta_wallet_challenges c ON c.id=a.challenge_id
       JOIN social_profiles p ON p.address=a.wallet
       WHERE c.preview_sha=$1 AND c.consumed_at IS NOT NULL
         AND p.suspended=false) AS active_wallet_keys,
    (SELECT count(*)::integer FROM social_beta_wallet_acceptances a
       JOIN social_beta_wallet_challenges c ON c.id=a.challenge_id
       WHERE c.preview_sha=$1 AND c.consumed_at IS NOT NULL) AS accepted_nonce_records,
    (SELECT count(DISTINCT p.id)::integer FROM social_posts p
       JOIN social_moderation_audit a ON a.target_id=p.id::text AND a.action='approve_media'
       WHERE p.media_status='approved' AND p.hidden=false AND p.deleted_at IS NULL) AS moderator_approved_posts,
    (SELECT count(*)::integer FROM social_posts WHERE media_status='pending') AS pending_media,
    (SELECT count(*)::integer FROM social_reports WHERE reviewed_at IS NULL) AS pending_reports,
    (SELECT count(*)::integer FROM social_risk_review_events) AS manual_risk_review_events`,[sha]),
   query<Reference>(`SELECT r.id AS review_id,r.gate,w.role,w.witness_wallet,
    e.auditor AS original_signer,r.external_reviewer AS original_reviewer,
    r.recorded_by AS operator,e.evidence_sha256 AS source_sha256
    FROM social_beta_release_witnesses w
    JOIN social_beta_release_reviews r ON r.id=w.review_id AND r.preview_sha=w.preview_sha
    JOIN social_beta_evidence_signatures e ON e.id=r.evidence_id AND e.preview_sha=w.preview_sha
    WHERE w.preview_sha=$1 ORDER BY w.recorded_at DESC LIMIT 50`,[sha]),
  ]);
  if(!prev.ok)return prev;
  const base=await prev.json() as {
   decision:{decision:"NO_GO";flagsClosed:boolean};
   walletProofs:{distinctPublicKeys:number};
   media:{providerInspection:{status:string;reason:string}|null;
     pendingMedia:number;openReports:number};
   currentChainEvidence:unknown;
   externalAudits:{references:number;independentlyInspectedOriginalFiles:false};
   incidents:unknown[];
  };
  let points:{complete:boolean;scanned:number;totalApproved:number;issues:{ledgerId:string;reason:string}[];
    note:string;status:string}|null=null;
  let pointsBlocker:string|null=null;
  const db=await socialDb().connect();
  try{
   try{points=await reconcileEntirePointsLedger(db,{batchSize:80,maxRows:250});}
   catch(e){pointsBlocker=e instanceof Error?e.message:"Full approved-Points audit not available.";}
  }finally{db.release();}
  const stats=counts.rows[0],ref=references.rows;
  const rolesByReview=new Map<string,Set<string>>();
  const walletsByReview=new Map<string,Set<string>>();
  let invalidSignerSeparation=0;
  for(const item of ref){
   if([item.original_signer,item.original_reviewer,item.operator].some(x=>x===item.witness_wallet))
    invalidSignerSeparation++;
   const roles=rolesByReview.get(item.review_id)??new Set<string>();
   roles.add(item.role);rolesByReview.set(item.review_id,roles);
   const owners=walletsByReview.get(item.review_id)??new Set<string>();
   owners.add(item.witness_wallet);walletsByReview.set(item.review_id,owners);
  }
  const twoRoleReviewIds=[...rolesByReview.keys()].filter(id=>
   rolesByReview.get(id)?.size===2&&walletsByReview.get(id)?.size===2);
  const flagsClosed=releaseFlagsClosed(process.env) &&
   [
    "LOOKE_M23_ACCEPTANCE_WRITES_ENABLED","LOOKE_M24_INCIDENT_WRITES_ENABLED",
    "LOOKE_M25_REVIEW_WRITES_ENABLED","LOOKE_M26_WITNESS_WRITES_ENABLED"
   ].every(x=>process.env[x]!=="true");
  const rehearsal=m27ReleaseRehearsal({
   flagsClosed,publicBetaFlag:process.env.LOOKE_PUBLIC_BETA_ENABLED==="true",
   realKeyCount:stats.active_wallet_keys,
   roleWallets:ref.map(x=>x.witness_wallet),
   providerStatus:base.media.providerInspection?.status??null,
   pointsComplete:points?.complete??false,pointsIssues:points?.issues.length??0,
   recoveryMatches:false,humanRestoreWitness:false,externalAuditContentApproved:false,
   independentlyWitnessedHumans:false,assetsVerified:false,
   productionAliasMatches:false,incidentDrillObserved:false,
  });
  return NextResponse.json({
   milestone:"M27",operatorAuthorized:true,readOnly:true,previewSha:sha||null,
   rehearsal,productionAliasExpected:"dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG",
   productionAliasIndependentlyCheckedByThisAPI:false,
   walletAcceptance:{...stats,independentTwoHumanWitnessVerified:false,
    challengeSignaturesReverifiedFromOriginalRawBytes:false,
    note:"A previously consumed unique nonce and recorded wallet are cryptographic key-control evidence, not unique-human testimony."},
   moderatedMedia:{moderatorApprovedPostReceipts:stats.moderator_approved_posts,
    pendingMedia:stats.pending_media,pendingReports:stats.pending_reports,
    hostedProvider:base.media.providerInspection,
    independentProviderWitnessApproved:false,
    note:"Actual moderated DB state is not the same as authenticated Cloudinary provider verification."},
   assetProof:base.currentChainEvidence,
   proofOfBothAssetsAtCurrentChainHeads:false,
   pointsFullSourceReconciliation:points,
   pointsScanBlocker:pointsBlocker,
   antiSybil:{manualReviewEventCount:stats.manual_risk_review_events,
    humanIndependenceCleared:false},
   dualRole:{realSignedReferenceRows:ref.length,qualifiedTwoRoleReviewIds:twoRoleReviewIds,
    distinctRoleSeparationFailures:invalidSignerSeparation,
    actualHumanRoleSignoff:false,sourceFileContentsIndependentlyVerified:false},
   recovery:{requiredTables:19,tool:"npm run m27:full-restore-audit",
    separateTLSRestoreObserved:false,
    independentBackupProvenanceVerified:false,
    independentHumanRestoreWitnessAccepted:false},
   externalAudit:{signedReferences:base.externalAudits.references,
    actualFileContentsIndependentlyInspected:false,
    securityFindingsRemediated:false},
   incidentRehearsal:{realRecordedIncidents:base.incidents.length,
    realProductionRollbackConducted:false,
    protectedAliasVerifiedByExternalOperator:false},
   releaseDecision:"NO_GO",publicBetaOpen:false,
   tokensClaimed:0,transactionsSent:0,
   note:"The API never promotes a deployment, changes feature flags, approves an unreviewed audit or simulates genuine end-user activity.",
  },{headers});
 }catch(e){return failure(e);}
}
