import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile } from "@/lib/server/session";
import { checkedDiscoveryMode } from "@/lib/discovery.mjs";

export const dynamic="force-dynamic";

/**
 * Transparent server-side ranking from real social data, not AI or market signals.
 * Candidate pool: 500 most recent visible posts from 14 days, max 20 results.
 * 'following' strictly filters to the account's followed creators; 'for-you'
 * boosts followed authors but falls back to public trending on cold start.
 */
export async function GET(request:NextRequest) {
 let mode:"trending"|"for-you"|"following";
 try {
  const parsed=checkedDiscoveryMode(request.nextUrl.searchParams.get("mode")??"trending");
  if(parsed==="latest")throw new RangeError("Latest is served by /api/posts");
  mode=parsed;
 }catch{return NextResponse.json({error:"Unsupported discovery feed"},{status:400});}
 try{
  const me=await currentProfile();
  if(mode==="following" && !me)return NextResponse.json({error:"Sign in to see followed creators"},{status:401,headers:{"Cache-Control":"no-store"}});
  const sql=database();
  const posts=await sql`
    WITH candidates AS (
      SELECT p.id,p.text,p.created_at,p.edited_at,p.profile_id,
        u.id AS author_id,u.handle AS author_handle,
        coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS author,
        (p.profile_id=${me?.id??null}::uuid) AS is_owner,
        (SELECT count(*)::int FROM looke_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT count(*)::int FROM looke_comments c WHERE c.post_id=p.id AND c.moderation_status='visible') AS comments,
        (SELECT count(*)::int FROM looke_reposts r WHERE r.post_id=p.id) AS reposts,
        EXISTS(SELECT 1 FROM looke_likes l WHERE l.post_id=p.id AND l.profile_id=${me?.id??null}::uuid) AS user_liked,
        EXISTS(SELECT 1 FROM looke_reposts r WHERE r.post_id=p.id AND r.profile_id=${me?.id??null}::uuid) AS user_reposted,
        EXISTS(SELECT 1 FROM looke_follows f WHERE f.follower_id=${me?.id??null}::uuid AND f.followed_id=p.profile_id) AS user_following
      FROM (
        SELECT * FROM looke_posts
        WHERE moderation_status='visible'
          AND created_at>now()-interval '14 days'
        ORDER BY created_at DESC,id DESC
        LIMIT 500
      ) p JOIN looke_profiles u ON u.id=p.profile_id
    ),
    scored AS (
      SELECT *,
        ((1 + ln(1 + 3*likes + 2*comments + 5*reposts)) /
          (1 + greatest(extract(epoch FROM now()-created_at),0)/86400.0)) *
        (CASE WHEN ${mode}='for-you' AND user_following THEN 2.5 ELSE 1 END) AS rank_score
      FROM candidates
    ),
    diversified AS (
      SELECT *,row_number() OVER(
        PARTITION BY profile_id ORDER BY rank_score DESC,created_at DESC,id DESC
      ) AS author_rank
      FROM scored
    )
    SELECT id,text,created_at,edited_at,author_id,author_handle,author,is_owner,
      likes,comments,reposts,user_liked,user_reposted,user_following
    FROM diversified
    WHERE (${mode}<>'following' OR user_following)
      AND (${mode}='following' OR author_rank<=3)
    ORDER BY
      CASE WHEN ${mode}='following' THEN NULL ELSE rank_score END DESC NULLS LAST,
      created_at DESC,id DESC
    LIMIT 20
  `;
  return NextResponse.json({
    mode,posts,nextCursor:null,
    explanation:mode==="following"?
      "Recent visible posts by creators you follow, from the last 14 days.":
      mode==="for-you"?
      "Recent, engaged posts ranked higher; creators you follow receive a boost. No behavioral tracking.":
      "Recent posts ranked by likes, comments and reposts with time decay. Not financial signals.",
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({error:"Recommended feed unavailable",posts:[],nextCursor:null},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
