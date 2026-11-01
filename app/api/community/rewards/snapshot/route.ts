import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {currentProfile,validOrigin} from "@/lib/server/session";
import {database} from "@/lib/server/database";
import {readCommunityParticipation} from "@/lib/server/community-rewards";
import {REWARD_POLICY_VERSION} from "@/lib/community-rewards.mjs";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
/**
 * An authenticated creator can save a provisional score summary for the last
 * 14 complete UTC days. It is not approval or user-issued rewards. Unique
 * period/policy records are idempotent; changes due to moderation are visibly
 * revisioned when the user requests reconciliation again.
 */
export async function POST(request:Request){
 if(!validOrigin(request))
  return NextResponse.json({error:"Invalid origin"},{status:403,headers:HEADERS});
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers:HEADERS});
  const asOf=new Date();
  const {window,report}=await readCommunityParticipation(me.id,asOf,true);
  const evidenceSummary={
   windowStart:window.start,windowEndExclusive:window.end,
   categoryScores:report.daily,scoringVersion:REWARD_POLICY_VERSION,
   accountedDays:report.activeDays,uniqueCounterparts:report.uniqueCounterpartCreators,
   qualifiesForManualReview:report.qualifiesForManualReview
  };
  // This fingerprint covers aggregated source observations; it does NOT prove
  // individual event authenticity, independent anti-sybil checks or finality.
  const raw=JSON.stringify(evidenceSummary);
  const digest=createHash("sha256").update(raw,"utf8").digest("hex");
  const sql=database();
  const saved=await sql`
   INSERT INTO looke_participation_snapshots(
     profile_id,period_start,period_end,scoring_version,
     provisional_points,active_days,counterpart_creators,
     activity_digest,evidence_summary
   )
   VALUES(
     ${me.id}::uuid,${window.startDay}::date,${window.endDay}::date,
     ${REWARD_POLICY_VERSION},
     ${report.totalProvisionalPoints},${report.activeDays},
     ${report.uniqueCounterpartCreators},${digest},${raw}::jsonb
   )
   ON CONFLICT(profile_id,period_start,scoring_version) DO UPDATE SET
     provisional_points=excluded.provisional_points,
     active_days=excluded.active_days,
     counterpart_creators=excluded.counterpart_creators,
     activity_digest=excluded.activity_digest,
     evidence_summary=excluded.evidence_summary,
     review_status='unverified',
     revision=looke_participation_snapshots.revision+1,
     last_computed_at=now()
   WHERE looke_participation_snapshots.activity_digest<>excluded.activity_digest
   RETURNING period_start::text AS "periodStart",period_end::text AS "periodEnd",
     revision,activity_digest AS digest
  `;
  const row=saved[0]??(await sql`
    SELECT period_start::text AS "periodStart",period_end::text AS "periodEnd",
      revision,activity_digest AS digest
    FROM looke_participation_snapshots
    WHERE profile_id=${me.id}::uuid AND period_start=${window.startDay}::date
      AND scoring_version=${REWARD_POLICY_VERSION} LIMIT 1
  `)[0];
  return NextResponse.json({
   snapshot:row,changed:saved.length>0,
   score:report.totalProvisionalPoints,status:"unverified",
   eligibleForOperatorReview:report.qualifiesForManualReview,
   allocatedTokens:"0",claimable:false,
   note:"Private provisional 14-day activity record only. A source change can revise the digest. No rewards, token distribution, verified identity or payout permission are conferred."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Provisional reward snapshot unavailable"},{status:503,headers:HEADERS});
 }
}
