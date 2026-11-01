import "server-only";
import {database} from "@/lib/server/database";
import {computeCommunityParticipation,utcWindow} from "@/lib/community-rewards.mjs";

/**
 * Reads *current* moderated social state using a repeatable-read snapshot.
 * Engagement is distinct by target creator within each UTC day AND category.
 * No self-engagement, hidden posts, removed comments or unreviewed reports as
 * automatic penalties. This is not bot/Sybil detection or money accounting.
 */
export async function readCommunityParticipation(profileId:string,asOf:Date,
 completedOnly=false){
 const window=utcWindow(asOf,completedOnly);
 const sql=database();
 const result=await sql.begin(async tx=>{
  await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;
  const profiles=await tx`
    SELECT created_at FROM looke_profiles WHERE id=${profileId}::uuid LIMIT 1
  `;
  if(!profiles.length)throw new Error("Creator profile unavailable");
  const rows=await tx`
    WITH actions AS (
      SELECT (p.created_at AT TIME ZONE 'UTC')::date AS activity_day,
        'post'::text AS kind,p.id AS target
      FROM looke_posts p
      WHERE p.profile_id=${profileId}::uuid
        AND p.moderation_status='visible'
        AND p.created_at>=${window.start}::timestamptz
        AND p.created_at<${window.end}::timestamptz
      UNION ALL
      SELECT (c.created_at AT TIME ZONE 'UTC')::date,'comment',p.profile_id
      FROM looke_comments c JOIN looke_posts p ON p.id=c.post_id
      WHERE c.profile_id=${profileId}::uuid
        AND p.profile_id<>${profileId}::uuid
        AND c.moderation_status='visible' AND p.moderation_status='visible'
        AND c.created_at>=${window.start}::timestamptz
        AND c.created_at<${window.end}::timestamptz
      UNION ALL
      SELECT (l.created_at AT TIME ZONE 'UTC')::date,'like',p.profile_id
      FROM looke_likes l JOIN looke_posts p ON p.id=l.post_id
      WHERE l.profile_id=${profileId}::uuid
        AND p.profile_id<>${profileId}::uuid AND p.moderation_status='visible'
        AND l.created_at>=${window.start}::timestamptz
        AND l.created_at<${window.end}::timestamptz
      UNION ALL
      SELECT (r.created_at AT TIME ZONE 'UTC')::date,'repost',p.profile_id
      FROM looke_reposts r JOIN looke_posts p ON p.id=r.post_id
      WHERE r.profile_id=${profileId}::uuid
        AND p.profile_id<>${profileId}::uuid AND p.moderation_status='visible'
        AND r.created_at>=${window.start}::timestamptz
        AND r.created_at<${window.end}::timestamptz
      UNION ALL
      SELECT (f.created_at AT TIME ZONE 'UTC')::date,'follow',f.followed_id
      FROM looke_follows f
      WHERE f.follower_id=${profileId}::uuid
        AND f.followed_id<>${profileId}::uuid
        AND f.created_at>=${window.start}::timestamptz
        AND f.created_at<${window.end}::timestamptz
    ), distinct_daily AS (
      SELECT DISTINCT activity_day,kind,target FROM actions
    )
    SELECT to_char(activity_day,'YYYY-MM-DD') AS day,
      count(*) FILTER (WHERE kind='post')::int AS posts,
      count(*) FILTER (WHERE kind='comment')::int AS comments,
      count(*) FILTER (WHERE kind='like')::int AS likes,
      count(*) FILTER (WHERE kind='repost')::int AS reposts,
      count(*) FILTER (WHERE kind='follow')::int AS follows,
      (SELECT count(DISTINCT target)::int FROM actions WHERE kind<>'post')
        AS counterpart_creators
    FROM distinct_daily
    GROUP BY activity_day
    ORDER BY activity_day DESC
    LIMIT 14
  `;
  return {joined:profiles[0].created_at,
   rows:rows.map(x=>({
    day:String(x.day),posts:Number(x.posts),comments:Number(x.comments),
    likes:Number(x.likes),reposts:Number(x.reposts),follows:Number(x.follows)
   })),
   counterpartCreators:Number(rows[0]?.counterpart_creators??0)};
 });
 return {window,report:computeCommunityParticipation({
  rows:result.rows,createdAt:result.joined,asOf,
  uniqueCounterpartCreators:result.counterpartCreators
 })};
}
