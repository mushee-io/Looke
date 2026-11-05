import type {PoolClient} from "pg";
import {type SourceKind} from "./points";

type Evidence={owner:string;actor:string;activity_at:Date};
/** Strict, pre-existing source evidence; every table reference is server-selected. */
const proofQueries:Record<SourceKind,string>={
 post:`SELECT p.author AS owner,p.author AS actor,p.created_at AS activity_at
   FROM social_posts p JOIN social_profiles author ON author.address=p.author
   WHERE p.id=$1 AND p.hidden=false AND p.deleted_at IS NULL
     AND (p.media_url IS NULL OR p.media_status='approved')
     AND author.suspended=false
     AND author.created_at<=p.created_at-interval '24 hours'`,
 comment:`SELECT c.author AS owner,c.author AS actor,c.created_at AS activity_at
   FROM social_comments c JOIN social_posts p ON p.id=c.post_id
   JOIN social_profiles author ON author.address=c.author
   JOIN social_profiles parent ON parent.address=p.author
   WHERE c.id=$1 AND c.hidden=false AND p.hidden=false AND p.deleted_at IS NULL
     AND (p.media_url IS NULL OR p.media_status='approved')
     AND c.author<>p.author AND p.created_at<=c.created_at
     AND author.suspended=false AND parent.suspended=false
     AND author.created_at<=c.created_at-interval '24 hours'
     AND parent.created_at<=c.created_at-interval '24 hours'
     AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE
       (b.blocker=c.author AND b.blocked=p.author)
       OR (b.blocker=p.author AND b.blocked=c.author))`,
 like_received:`SELECT p.author AS owner,l.actor AS actor,l.created_at AS activity_at
   FROM social_post_likes l JOIN social_posts p ON p.id=l.post_id
   JOIN social_profiles author ON author.address=p.author
   JOIN social_profiles liker ON liker.address=l.actor
   WHERE l.id=$1 AND l.actor<>p.author AND p.created_at<=l.created_at
     AND p.hidden=false AND p.deleted_at IS NULL
     AND (p.media_url IS NULL OR p.media_status='approved')
     AND author.suspended=false AND liker.suspended=false
     AND author.created_at<=l.created_at-interval '24 hours'
     AND liker.created_at<=l.created_at-interval '24 hours'
     AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE
       (b.blocker=l.actor AND b.blocked=p.author)
       OR (b.blocker=p.author AND b.blocked=l.actor))`,
 repost_received:`SELECT p.author AS owner,r.actor AS actor,r.created_at AS activity_at
   FROM social_post_reposts r JOIN social_posts p ON p.id=r.post_id
   JOIN social_profiles author ON author.address=p.author
   JOIN social_profiles reposter ON reposter.address=r.actor
   WHERE r.id=$1 AND r.actor<>p.author AND p.created_at<=r.created_at
     AND p.hidden=false AND p.deleted_at IS NULL
     AND (p.media_url IS NULL OR p.media_status='approved')
     AND author.suspended=false AND reposter.suspended=false
     AND author.created_at<=r.created_at-interval '24 hours'
     AND reposter.created_at<=r.created_at-interval '24 hours'
     AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE
       (b.blocker=r.actor AND b.blocked=p.author)
       OR (b.blocker=p.author AND b.blocked=r.actor))`,
};
export async function lookupEvidence(conn:Pick<PoolClient,"query">,kind:SourceKind,id:string){
 const found=await conn.query<Evidence>(proofQueries[kind],[id]);
 return found.rows[0]??null;
}
export function utcActivityDay(date:Date){
 if(!Number.isFinite(date.getTime()))throw Error("Invalid participation evidence timestamp.");
 return date.toISOString().slice(0,10);
}
