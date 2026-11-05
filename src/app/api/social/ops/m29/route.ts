import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {query} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m28ReadOnly} from "../m28/route";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type Status={distinct_keys:number;accepted_challenges:number;expired_sessions:number;
 invalid_challenge_joins:number;distinct_operator_reviewers:number};
type Evidence={kind:string;reference_count:number};
export async function GET(req:NextRequest){
 try{
  const operator=(await requireViewer(req)).address;assertModerator(operator);
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [existing,nonce,refs]=await Promise.all([
   m28ReadOnly(req),
   query<Status>(`SELECT
    count(DISTINCT a.wallet)::integer AS distinct_keys,
    count(*)::integer AS accepted_challenges,
    count(*) FILTER(WHERE a.session_expires_at<=now())::integer AS expired_sessions,
    count(*) FILTER(WHERE c.consumed_at IS NULL OR c.preview_sha<>$1
       OR c.wallet<>a.wallet OR c.expires_at<c.consumed_at)::integer AS invalid_challenge_joins,
    count(DISTINCT a.reviewer)::integer AS distinct_operator_reviewers
    FROM social_beta_wallet_acceptances a
    JOIN social_beta_wallet_challenges c ON c.id=a.challenge_id
    JOIN social_profiles p ON p.address=a.wallet AND p.suspended=false
    WHERE c.preview_sha=$1`,[sha]),
   query<Evidence>(`SELECT kind,count(*)::integer AS reference_count
    FROM social_beta_evidence_signatures WHERE preview_sha=$1
    GROUP BY kind ORDER BY kind ASC`,[sha]),
  ]);
  if(!existing.ok)return existing;
  const prev=await existing.json() as {
   immutablePreviewCommit:string|null;
   wallets:{distinctKeysWithConsumedNonce:number;authenticConsumedProofRecords:number};
   liveMedia:{status:string;verified:number;inspected:number;reason:string};
   chain:{token:{status:string;reason:string};uniq:{status:string;reason:string};
    bothIndependentlyVerified:boolean};
   points:{complete?:boolean;issues?:unknown[];totalApproved?:number;scanned?:number;
    blockedReason?:string};
   dualRole:{qualifiedTwoRoleReviewIds:string[]};
   audit:{signedReferenceCount:number};
   incident:{actualJournalEntries:number};
  };
  const observed=nonce.rows[0];
  const providerRead=prev.liveMedia.status==="verified"&&prev.liveMedia.verified>0;
  const tokenRead=prev.chain.token.status==="verified";
  const uniqRead=prev.chain.uniq.status==="verified";
  const technical={
   authenticAtomicNonceRecords:observed?.accepted_challenges??0,
   distinctAcceptedKeyCount:observed?.distinct_keys??0,
   recordsWithMissingOrInvalidConsumption:observed?.invalid_challenge_joins??0,
   expiredWitnessScopes:observed?.expired_sessions??0,
   eligibleRealModerationUploads:prev.liveMedia.inspected,
   matchingAuthenticatedCloudinaryAssets:providerRead?prev.liveMedia.verified:0,
   currentCanonicalEvmReceiptVerified:tokenRead,
   currentIrreversibleNativeUniqVerified:uniqRead,
   sourcePointsScanComplete:prev.points?.complete??false,
   sourcePointsDiscrepancies:prev.points?.issues?.length??0,
   twoDistinctSignedReviewRoles:prev.dualRole.qualifiedTwoRoleReviewIds.length>0,
   originalSignedReferenceCounts:refs.rows,
   realIncidentRecords:prev.incident.actualJournalEntries,
  };
  const tasks=[
   {id:"wallet_sessions",label:"Actual two-wallet holder acceptance + anti-replay",
    status:technical.distinctAcceptedKeyCount>=2&&technical.recordsWithMissingOrInvalidConsumption===0?"database_key_proof_only":"blocked",
    command:"npm run m29:verify-wallet-sessions -- --file /secure/two-original-signatures.json",
    external:"Witnesses must personally attend and independently establish human uniqueness; observer signatures alone are not enough."},
   {id:"hosted_media",label:"Authenticated Cloudinary ownership and moderator receipts",
    status:providerRead?"provider_metadata_only":"blocked",
    command:"Use M29 protected operator tab with inspectProvider=true",
    external:"A real moderator must inspect the actual content and safety decisions."},
   {id:"creator_coin",label:"Canonical live Ultra EVM CoinCreated receipt",
    status:tokenRead?"rpc_state_verified":"blocked",
    command:"Supply tokenFactory and coinTx for chain 18881",
    external:"Confirm exact asset corresponds to independently approved creator."},
   {id:"native_uniq",label:"Current native Ultra Uniq factory and irreversible owner",
    status:uniqRead?"native_rpc_owner_verified":"blocked",
    command:"Supply uniqFactoryId, uniqTokenId and uniqOwner",
    external:"A different reviewer must inspect actual native proof at the specified head."},
   {id:"postgres_restore19",label:"Actual independently restored TLS PostgreSQL 19-table recovery",
    status:"external_backup_and_restore_unverified",
    command:"npm run m27:full-restore-audit",
    external:"Restore into distinct TLS environment; separate witness must inspect backup origin, cutoff and logs."},
   {id:"points_anti_sybil",label:"Complete Points ledger and independent anti-sybil investigation",
    status:technical.sourcePointsScanComplete&&!technical.sourcePointsDiscrepancies?"source_reconciled_only":"blocked",
    command:"npm run m27:full-points-audit",
    external:"No chain rewards without actual investigation of cross-account farming."},
   {id:"security_audit",label:"Original external security-audit bytes and remediation",
    status:"original_document_and_findings_not_reviewed",
    command:"npm run m24:verify-evidence -- --file REPORT --evidence-id REAL_UUID --commit EXACT_SHA",
    external:"A qualified independent auditor must read the original report and retest material findings."},
   {id:"incident_rollback",label:"Read-only production-alias and witnessed recovery drill",
    status:"actual_human_rollback_not_witnessed",
    command:"npm run m27:release-rehearsal",
    external:"Independent operator must document an authorized rollback drill; no automatic production mutation."},
  ] as const;
  return NextResponse.json({
   milestone:"M29",readOnly:true,operatorAuthorized:true,
   exactPreviewCommit:prev.immutablePreviewCommit,
   decision:"NO_GO",publicBetaOpen:false,
   realTechnicalObservations:technical,
   fullOperatorChecklist:tasks,
   actualExternalEvidencePacketCommand:"npm run m29:verify-evidence-bundle -- --manifest /secure/manifest.json --directory /secure/evidence",
   actualHumanIndependenceVerified:false,
   signedHumanSecurityAndOperatorLaunchAuthorizationAccepted:false,
   originalAuditContentAndRemediationIndependentlyApproved:false,
   actualIndependentBackupRestorationVerified:false,
   incidentRollbackIndependentlyWitnessed:false,
   sourceReviewResult:prev,
   socialMediaWritesEnabled:false,pointsIssued:0,
   tokenClaimsEnabled:false,financialTransactionsSent:0,productionChanged:false,
   note:"The eight artifacts must be real external documents or captured source reports. Hash matches and public signature checks do not prove content, human uniqueness, provider authenticity or launch safety.",
  },{headers});
 }catch(e){return failure(e);}
}
