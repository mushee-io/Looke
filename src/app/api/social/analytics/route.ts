import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../lib/social/auth";
import {query} from "../../../../lib/social/db";
import {failure} from "../../../../lib/social/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** No user-supplied account: all metrics are bound to an active wallet session. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  const [summary,top,daily]=await Promise.all([
   query<{
    posts:number;pending_media:number;hidden_posts:number;
    followers:number;following:number;likes_received:number;reposts_received:number;
    comments_received:number;
   }>(`
    SELECT
      (SELECT count(*)::integer FROM social_posts p WHERE p.author=$1
        AND p.hidden=false AND p.deleted_at IS NULL
        AND (p.media_url IS NULL OR p.media_status='approved')) AS posts,
      (SELECT count(*)::integer FROM social_posts p WHERE p.author=$1
        AND p.deleted_at IS NULL AND p.media_status='pending') AS pending_media,
      (SELECT count(*)::integer FROM social_posts p WHERE p.author=$1
        AND p.hidden=true AND p.deleted_at IS NULL) AS hidden_posts,
      (SELECT count(*)::integer FROM social_follows f
        JOIN social_profiles pr ON pr.address=f.follower
        WHERE f.followed=$1 AND pr.suspended=false AND NOT EXISTS(
         SELECT 1 FROM social_blocks b WHERE
           (b.blocker=$1 AND b.blocked=f.follower) OR
           (b.blocker=f.follower AND b.blocked=$1))) AS followers,
      (SELECT count(*)::integer FROM social_follows f
        WHERE f.follower=$1) AS following,
      (SELECT count(*)::integer FROM social_post_likes l
        JOIN social_posts p ON p.id=l.post_id
        WHERE p.author=$1 AND p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')) AS likes_received,
      (SELECT count(*)::integer FROM social_post_reposts r
        JOIN social_posts p ON p.id=r.post_id
        WHERE p.author=$1 AND p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')) AS reposts_received,
      (SELECT count(*)::integer FROM social_comments c
        JOIN social_posts p ON p.id=c.post_id
        WHERE p.author=$1 AND c.hidden=false AND p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')) AS comments_received
   `,[actor]),
   query<{
    id:string;body:string;created_at:Date;
    likes:number;reposts:number;comments:number;
   }>(`
    SELECT p.id,p.body,p.created_at,
      (SELECT count(*)::integer FROM social_post_likes l WHERE l.post_id=p.id) AS likes,
      (SELECT count(*)::integer FROM social_post_reposts r WHERE r.post_id=p.id) AS reposts,
      (SELECT count(*)::integer FROM social_comments c WHERE c.post_id=p.id AND c.hidden=false) AS comments
    FROM social_posts p WHERE p.author=$1
      AND p.hidden=false AND p.deleted_at IS NULL
      AND (p.media_url IS NULL OR p.media_status='approved')
    ORDER BY ((SELECT count(*) FROM social_post_likes l WHERE l.post_id=p.id)
        +(SELECT count(*) FROM social_post_reposts r WHERE r.post_id=p.id)
        +(SELECT count(*) FROM social_comments c WHERE c.post_id=p.id AND c.hidden=false)) DESC,
      p.created_at DESC,p.id DESC LIMIT 10
   `,[actor]),
   query<{day:string;posts:number}>(`
    SELECT to_char(day.day,'YYYY-MM-DD') AS day,count(p.id)::integer AS posts
    FROM generate_series((now() AT TIME ZONE 'UTC')::date-13,
      (now() AT TIME ZONE 'UTC')::date,interval '1 day') day(day)
    LEFT JOIN social_posts p ON p.author=$1
      AND (p.created_at AT TIME ZONE 'UTC')::date=day.day::date
      AND p.hidden=false AND p.deleted_at IS NULL
      AND (p.media_url IS NULL OR p.media_status='approved')
    GROUP BY day.day ORDER BY day.day ASC
   `,[actor]),
  ]);
  return NextResponse.json({
   authenticated:true,ownerScoped:true,summary:summary.rows[0],
   topPosts:top.rows,daily:daily.rows,
   source:"actual-postgres-counts",periodDays:14,
   note:"Post and engagement counts only; no inferred impressions, reach or token valuations.",
  },{headers:{"cache-control":"private, no-store"}});
 }catch(error){return failure(error);}
}
