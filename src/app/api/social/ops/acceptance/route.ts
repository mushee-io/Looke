import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {query,socialDb} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {reconcileApproved} from "../../../../../lib/social/m20-reconcile";
import {assembleM21Report,defaultM21Gates,gate,replaceM21Gate,releaseFlagsClosed} from "../../../../../lib/ops/m21-acceptance";
import {collectLiveRpcEvidence} from "../../../../../lib/ops/m8-probe";
import {inspectSocialOperations} from "../../../../../lib/ops/m11-social";
import {probeProtectedStaging} from "../../../../../lib/ops/m10-protection";
import {indexCreatorLaunches} from "../../../../../lib/ops/m13-index";
import {uploadConfig,uploadDraft,fetchProviderAsset,verifyProviderAsset} from "../../../../../lib/social/upload-provider";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const safe={"cache-control":"private, no-store"};

type Counters={
 profiles:number;posts:number;visible_posts:number;pending_media:number;
 approved_media:number;media_approvals:number;live_sessions:number;
 approved_points:string;approved_points_events:number;index_events:number;
 index_rewinds:number;index_scans:number;risk_reviews:number;
 unreviewed_reports:number;
};
type ProviderRow={
 public_id:string;kind:"image"|"video";mime:"image/png"|"image/jpeg"|"image/webp"|"image/gif"|"video/mp4"|"video/webm";
 declared_bytes:number;owner:string;
};

/** Read-only evidence collection, not beta readiness or signed wallet acceptance. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  assertModerator(actor);
  const live=req.nextUrl.searchParams.get("live")==="true";
  const db=await query<Counters>(`
    SELECT
      (SELECT count(*)::integer FROM social_profiles) AS profiles,
      (SELECT count(*)::integer FROM social_posts) AS posts,
      (SELECT count(*)::integer FROM social_posts p
        WHERE p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')) AS visible_posts,
      (SELECT count(*)::integer FROM social_posts WHERE media_status='pending') AS pending_media,
      (SELECT count(*)::integer FROM social_posts WHERE media_status='approved') AS approved_media,
      (SELECT count(*)::integer FROM social_moderation_audit a
        JOIN social_posts p ON p.id::text=a.target_id
        WHERE a.action='approve_media' AND p.media_status='approved'
          AND p.hidden=false AND p.deleted_at IS NULL) AS media_approvals,
      (SELECT count(*)::integer FROM social_sessions WHERE expires_at>now()) AS live_sessions,
      (SELECT COALESCE(sum(points),0)::text FROM social_points_ledger
        WHERE status='approved') AS approved_points,
      (SELECT count(*)::integer FROM social_points_ledger WHERE status='approved') AS approved_points_events,
      (SELECT count(*)::integer FROM social_activity_index) AS index_events,
      (SELECT count(*)::integer FROM social_index_runs WHERE action='rewind') AS index_rewinds,
      (SELECT count(*)::integer FROM social_index_runs WHERE action='scan') AS index_scans,
      (SELECT count(*)::integer FROM social_risk_review_events) AS risk_reviews,
      (SELECT count(*)::integer FROM social_reports WHERE reviewed_at IS NULL) AS unreviewed_reports
  `);
  const counts=db.rows[0];
  const connection=await socialDb().connect();
  let reconciliation;
  try{reconciliation=await reconcileApproved(connection,40);}finally{connection.release();}
  let gates=defaultM21Gates();
  // Only genuine eligible reviewed Points qualify for an independent evidence match.
  if(reconciliation.complete && reconciliation.totalApproved>0 && reconciliation.issues.length===0){
   gates=replaceM21Gate(gates,gate("pointsEvidenceReconciliation","verified",
    "All currently approved Points entries matched current real source and season policy.",
    "PostgreSQL social_points_ledger / social source records"));
  }
  // Existing moderator decisions are evidence of storage, NOT proof of independent security review.
  if(counts.media_approvals>0&&counts.approved_media>0){
   gates=replaceM21Gate(gates,gate("mediaModerationAudit","verified",
    "Actual approved-media posts and recorded moderation actions exist; provider scan remains separate.",
    "PostgreSQL social_posts / social_moderation_audit"));
  }
  const flags=releaseFlagsClosed(process.env);
  let liveEvidence:{
   rpc:Awaited<ReturnType<typeof collectLiveRpcEvidence>>|null;
   factory:{status:string;confirmedLaunches:number;complete:boolean;sourceHashes:string[]}|null;
   provider:{status:string;reason:string}|null;
   database:{status:string;leastPrivilege:boolean;note:string}|null;
   protection:{status:string;reason:string;signedOutChallengeVerified:boolean}|null;
  }={rpc:null,factory:null,provider:null,database:null,protection:null};
  if(live){
   const [rpc,launch,operations,stage]=await Promise.allSettled([
    collectLiveRpcEvidence(),indexCreatorLaunches(),inspectSocialOperations(),
    probeProtectedStaging({
     vercelToken:process.env.VERCEL_TOKEN,
     deploymentUrl:process.env.LOOKE_M21_PREVIEW_URL,
     expectedRevision:process.env.VERCEL_GIT_COMMIT_SHA,
    }),
   ]);
   if(rpc.status==="fulfilled"){
    liveEvidence.rpc=rpc.value;
    if(rpc.value.evm.status==="verified"){
     gates=replaceM21Gate(gates,gate("ultraEvmReadOnlyHead","verified",
      "Real Ultra EVM Testnet chain 18881 head and block hash independently observed.",
      String(rpc.value.evm.headHash)));
    }
    if(rpc.value.native.status==="verified"){
     gates=replaceM21Gate(gates,gate("ultraNativeReadOnlyHead","verified",
      "Native Ultra Testnet head and irreversible block independently observed.",
      "Ultra native RPC irreversible block "+String(rpc.value.native.irreversibleBlock)));
    }
   }
   if(launch.status==="fulfilled"){
    liveEvidence.factory={status:launch.value.status,
     confirmedLaunches:launch.value.launches.length,complete:launch.value.complete,
     sourceHashes:launch.value.launches.slice(0,10).map(x=>x.txHash)};
    if(launch.value.status==="verified"&&launch.value.launches.length>0){
     gates=replaceM21Gate(gates,gate("creatorCoinReceiptProof","verified",
      "Actual factory-sourced CoinCreated receipts and deployed token states verified in a bounded window.",
      launch.value.launches[0].txHash));
    }
   }
   if(operations.status==="fulfilled"){
    liveEvidence.database={status:operations.value.status,leastPrivilege:operations.value.leastPrivilege,
     note:operations.value.note};
    if(operations.value.status==="verified")
     gates=replaceM21Gate(gates,gate("databaseTLSLeastPrivilege","verified",
      "Live TLS database schema and non-superuser role inspected independently.",
      "PostgreSQL role/catalog audit via inspectSocialOperations"));
   }
   if(stage.status==="fulfilled"){
    liveEvidence.protection={status:stage.value.status,
     reason:stage.value.reason,signedOutChallengeVerified:stage.value.signedOutChallengeVerified};
    if(stage.value.status==="verified"&&stage.value.signedOutChallengeVerified){
     for(const id of ["previewDeploymentIdentity","signedOutProtection"] as const)
      gates=replaceM21Gate(gates,gate(id,"verified",
       "Actual immutable SHA-matched protected Preview and signed-out Vercel challenge verified.",
       stage.value.deploymentOrigin??"Vercel protected Preview origin"));
    }
   }
   const provider=await query<ProviderRow>(`
    SELECT u.public_id,u.kind,u.mime,u.declared_bytes,u.owner
    FROM social_media_uploads u
    JOIN social_posts p ON p.id=u.post_id AND p.author=u.owner
    WHERE u.state='attached' AND p.media_status='approved'
      AND u.verified_url=p.media_url
    ORDER BY u.attached_at DESC LIMIT 1`);
   if(provider.rows[0]){
    try{
     const row=provider.rows[0],cfg=uploadConfig();
     const draft=uploadDraft.parse({kind:row.kind,mime:row.mime,bytes:row.declared_bytes});
     const asset=await fetchProviderAsset(cfg,row.kind,row.public_id);
     verifyProviderAsset({config:cfg,asset,publicId:row.public_id,draft,expectedOwner:row.owner});
     liveEvidence.provider={status:"verified",reason:"Independent provider API confirmed a real attached and approved upload."};
     gates=replaceM21Gate(gates,gate("mediaProviderInspection","verified",
      "Provider independently reverified real wallet-scoped attached media.",
      "Cloudinary server-side authenticated asset API / PostgreSQL upload"));
    }catch{
     liveEvidence.provider={status:"blocked",reason:"Provider verification was unavailable or mismatched the stored authorization."};
    }
   }else{
    liveEvidence.provider={status:"blocked",reason:"No actual attached and approved provider media exists for inspection."};
   }
  }
  // Explicitly do not infer independent wallet witness, real native ownership,
  // external audit, cross-wallet anti-sybil clearance or deployment authorization from CI.
  const report=assembleM21Report(gates);
  return NextResponse.json({
   authorized:true,readOnly:true,liveProbesRequested:live,
   source:"actual-db-with-optional-independent-testnet-probes",
   flagsClosed:flags,
   operational:counts,
   reconciliation,
   liveEvidence,
   report,
   note:"These are bounded observations. No signed wallet session was initiated, and no Testnet transaction, token mint, reward claim or public beta activation was performed.",
  },{headers:safe});
 }catch(error){return failure(error);}
}
