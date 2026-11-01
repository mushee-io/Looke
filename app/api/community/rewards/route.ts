import {NextResponse} from "next/server";
import {currentProfile} from "@/lib/server/session";
import {database} from "@/lib/server/database";
import {readCommunityParticipation} from "@/lib/server/community-rewards";
import {CATEGORY_POLICY,REWARD_POLICY_VERSION} from "@/lib/community-rewards.mjs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
/** Account-scoped participation review. No wallet credit or token entitlement. */
export async function GET(){
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in to review your own provisional participation"},{status:401,headers:HEADERS});
  const {window,report}=await readCommunityParticipation(me.id,new Date());
  const sql=database();
  const saved=await sql`
   SELECT period_start::text AS "periodStart",
     period_end::text AS "periodEnd",
     scoring_version AS "policyVersion",
     provisional_points AS "provisionalPoints",
     active_days AS "activeDays",
     counterpart_creators AS "counterpartCreators",
     activity_digest AS "digest",
     review_status AS "reviewStatus",revision,
     last_computed_at AS "computedAt"
   FROM looke_participation_snapshots
   WHERE profile_id=${me.id}::uuid
   ORDER BY period_end DESC,revision DESC LIMIT 7
  `;
  return NextResponse.json({
   network:"Looke authenticated social activity (offchain)",
   source:"Current visible posts, moderated comments, live likes/reposts/follows; account-scoped",
   window,report,categoryPolicy:CATEGORY_POLICY,
   savedSnapshots:saved,
   policyVersion:REWARD_POLICY_VERSION,
   pointsTransferable:false,redeemable:false,airdropEntitlement:false,
   payoutProgramConfigured:false,
   note:"Provisional participation is recalculated from currently qualifying social data. Saved snapshots are historical unverified summaries, not frozen/approved balances."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Community scoring unavailable; no points inferred"},{status:503,headers:HEADERS});
 }
}
