import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin} from "../../../../../lib/social/auth";
import {query,rateLimit} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {GET as m23ReadOnly} from "../m23/route";
import {GET as m21ReadOnly} from "../acceptance/route";
import {incidentSchema,m24IncidentWritesEnabled,launchReview} from "../../../../../lib/beta/m24-review";
import {previewIdentity} from "../../../../../lib/beta/m23-witness";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"cache-control":"private, no-store"};
type IncidentRow={id:string;event_type:string;severity:string;reviewer:string;preview_sha:string;
 observation:string;external_evidence_id:string|null;action_taken:"none";
 production_changed:false;public_beta_activated:false;created_at:Date};
type ExternalEvidence={id:string;kind:string;auditor:string;recorded_by:string;
 evidence_sha256:string;evidence_url:string;recorded_at:Date;preview_sha:string};
export async function GET(req:NextRequest){
 try{
  const reviewer=(await requireViewer(req)).address;
  assertModerator(reviewer);
  const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA||"";
  const [m21,m23,incidentRows,externalRows]=await Promise.all([
   m21ReadOnly(req),m23ReadOnly(req),
   query<IncidentRow>(`SELECT id,event_type,severity,reviewer,preview_sha,observation,
     external_evidence_id,action_taken,production_changed,public_beta_activated,created_at
     FROM social_beta_incident_journal WHERE preview_sha=$1
     ORDER BY created_at DESC,id DESC LIMIT 20`,[sha]),
   query<ExternalEvidence>(`SELECT id,kind,auditor,recorded_by,evidence_sha256,evidence_url,
     recorded_at,preview_sha FROM social_beta_evidence_signatures WHERE preview_sha=$1
     ORDER BY recorded_at DESC,id DESC LIMIT 20`,[sha]),
  ]);
  if(!m21.ok)return m21;
  if(!m23.ok)return m23;
  const m21Data=await m21.json() as {
   report:import("../../../../../lib/ops/m21-acceptance").M21Report;flagsClosed:boolean;
   liveEvidence:{provider:{status:string;reason:string}|null};
  };
  const m23Data=await m23.json() as {
   operatorWalletProofs:{wallet:string}[];distinctWalletsWithConsumedNonce:number;
   twoWalletIndependentHumanWitnessAccepted:false;
   reports:{pendingMedia:number;openReports:number;riskReviews:number};
   pointsReconciliation:{scanned:number;totalApproved:number;complete:boolean;issues:unknown[]};
   independentlyCheckedMediaProvider:{status:string;reason:string}|null;
   independentAssetProof:unknown;
  };
  const critical=incidentRows.rows.filter(x=>x.severity==="critical").length;
  const review=launchReview({
   m21:m21Data.report,featureFlagsClosed:m21Data.flagsClosed,
   evidence:{
    realWallets:m23Data.distinctWalletsWithConsumedNonce,
    pointScanComplete:m23Data.pointsReconciliation.complete,
    pointIssues:m23Data.pointsReconciliation.issues.length,
    pendingMedia:m23Data.reports.pendingMedia,
    openReports:m23Data.reports.openReports,
    criticalIncidents:critical,restoreFullCompareVerified:false,
    auditorContentInspected:false,
   },
  });
  return NextResponse.json({
   milestone:"M24",reviewerAuthorized:true,readOnly:true,
   productionUnchangedByThisEndpoint:true,publicBetaOpen:false,
   incidentWritesEnabled:m24IncidentWritesEnabled(),
   immutablePreviewSha:sha||null,
   review,
   realWallets:{distinctKeys:m23Data.distinctWalletsWithConsumedNonce,
    humanWitnessApproved:false,acceptanceOnly:true},
   realModeration:{pendingMedia:m23Data.reports.pendingMedia,
    openReports:m23Data.reports.openReports,
    providerInspection:m23Data.independentlyCheckedMediaProvider??null,
    realReviewRequired:true},
   realCreatorAssetProof:m23Data.independentAssetProof,
   points:{approvedSourceScan:m23Data.pointsReconciliation.scanned,
    totalApproved:m23Data.pointsReconciliation.totalApproved,
    complete:m23Data.pointsReconciliation.complete,
    mismatches:m23Data.pointsReconciliation.issues.length,
    manualRiskReviews:m23Data.reports.riskReviews},
   evidenceReferences:externalRows.rows.map(e=>({
    ...e,actualFileDigestRechecked:false,independentAuditorContentApproved:false,
   })),
   incidentJournal:incidentRows.rows,
   recovery:{fullRestoreRowsCompared:false,actualRestoreWitnessAccepted:false,
    next:"Run m24:full-restore-audit with separate verified TLS PostgreSQL endpoints; match full rows and schema under a common source cutoff, then obtain independent operator witness."},
   incidentResponsePlan:[
    "Record the real incident severity, affected subsystem and observed evidence; no fabricated event counts.",
    "Freeze any proposed beta activation. Public beta already remains off; do not toggle finance or social write flags.",
    "Confirm exact Vercel production alias and protected Preview SHA independently before touching hosting.",
    "Check source-backed Points drift, provider media approvals, external Ultra token and Uniq receipts and index checkpoints.",
    "If production was unexpectedly changed, a separately authorized operator must roll back using the existing known-good deployment dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG; this service NEVER executes a rollback.",
    "Create a verified TLS database backup, restore to a separate host and compare full schema and row digests; preserve independent restore logs.",
    "Request auditor review and signed human authorization before any public release; incident evidence is NOT a release permission.",
   ],
   note:"This server cannot approve beta, verify local artifact file bytes, perform a real restore, roll back Vercel, mint, claim, moderate automatically or broadcast.",
   transactionsSent:0,
  },{headers});
 }catch(e){return failure(e);}
}
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!m24IncidentWritesEnabled())
   throw new HttpError(503,"M24 incident journal writes are disabled on protected Preview.");
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const data=incidentSchema.parse(await readJson(req));
  const identity=previewIdentity();
  await rateLimit(reviewer,"m24_incident",15,600);
  if(data.evidenceId){
   const matching=await query<{id:string}>(`
    SELECT id FROM social_beta_evidence_signatures WHERE id=$1 AND preview_sha=$2`,
    [data.evidenceId,identity.sha]);
   if(matching.rowCount!==1)throw new HttpError(409,
    "Independent reference must exist for this exact Preview commit.");
  }
  const recorded=await query<{id:string}>(`INSERT INTO social_beta_incident_journal
   (event_type,severity,reviewer,preview_sha,observation,external_evidence_id)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
   [data.eventType,data.severity,reviewer,identity.sha,data.observation,data.evidenceId]);
  return NextResponse.json({ok:true,incidentId:recorded.rows[0].id,
   actionTaken:"none",productionChanged:false,publicBetaActivated:false,
   note:"Append-only observation recorded. Nothing was restored, rolled back, transferred or approved."},
   {headers});
 }catch(e){return failure(e);}
}
