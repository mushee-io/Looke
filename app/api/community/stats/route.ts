import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store"};
/** Aggregate visible activity only. No public personal ranking/wallet identities. */
export async function GET(){
 try{
  const sql=database();
  const [row]=await sql`
   SELECT
    (SELECT count(*)::int FROM looke_posts p
      WHERE p.moderation_status='visible'
        AND p.created_at>=now()-interval '14 days') AS visible_posts,
    (SELECT count(DISTINCT p.profile_id)::int FROM looke_posts p
      WHERE p.moderation_status='visible'
        AND p.created_at>=now()-interval '14 days') AS active_creators,
    (SELECT count(*)::int FROM looke_comments c
      JOIN looke_posts p ON p.id=c.post_id
      WHERE c.moderation_status='visible' AND p.moderation_status='visible'
        AND c.created_at>=now()-interval '14 days') AS visible_comments
  `;
  return NextResponse.json({
   period:"rolling_14_days",visiblePosts:Number(row?.visible_posts??0),
   activeCreators:Number(row?.active_creators??0),
   visibleComments:Number(row?.visible_comments??0),
   derivedFrom:"Current moderated Looke social data",
   rewardsAvailable:false,leaderboardEnabled:false,
   warning:"These are social activity aggregates, not verified unique humans, token rewards or audited participation."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Community activity aggregates unavailable",rewardsAvailable:false},
    {status:503,headers:HEADERS});
 }
}
