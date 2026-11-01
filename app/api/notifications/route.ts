import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, validOrigin } from "@/lib/server/session";

export const dynamic="force-dynamic";

/**
 * Server-derived alerts: no user-facing fake events or unconfigured push provider.
 * Reactions disappearing after an unlike/unfollow is intentional. User read state
 * is persisted separately from social activity.
 */
export async function GET() {
 try {
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in first",notifications:[],unread:0},{status:401});
  const sql=database();
  const notifications=await sql`
    WITH events AS (
      SELECT 'follow'::text AS kind,
        coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS actor,
        u.handle AS actor_handle,u.id AS actor_id,
        u.id AS source_id,NULL::uuid AS post_id,f.created_at AS event_time
      FROM looke_follows f JOIN looke_profiles u ON u.id=f.follower_id
      WHERE f.followed_id=${me.id}::uuid
      UNION ALL
      SELECT 'like',coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)),
        u.handle,u.id,l.post_id,l.post_id,l.created_at
      FROM looke_likes l JOIN looke_posts p ON p.id=l.post_id
      JOIN looke_profiles u ON u.id=l.profile_id
      WHERE p.profile_id=${me.id}::uuid AND l.profile_id<>${me.id}::uuid
        AND p.moderation_status='visible'
      UNION ALL
      SELECT 'comment',coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)),
        u.handle,u.id,c.id,c.post_id,c.created_at
      FROM looke_comments c JOIN looke_posts p ON p.id=c.post_id
      JOIN looke_profiles u ON u.id=c.profile_id
      WHERE p.profile_id=${me.id}::uuid AND c.profile_id<>${me.id}::uuid
        AND p.moderation_status='visible' AND c.moderation_status='visible'
      UNION ALL
      SELECT 'repost',coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)),
        u.handle,u.id,r.post_id,r.post_id,r.created_at
      FROM looke_reposts r JOIN looke_posts p ON p.id=r.post_id
      JOIN looke_profiles u ON u.id=r.profile_id
      WHERE p.profile_id=${me.id}::uuid AND r.profile_id<>${me.id}::uuid
        AND p.moderation_status='visible'
    ),
    read_state AS (
      SELECT coalesce((SELECT last_read_at FROM looke_notification_state WHERE profile_id=${me.id}::uuid),to_timestamp(0)) AS last_read
    )
    SELECT events.*,(events.event_time > read_state.last_read) AS unread,
      count(*) FILTER(WHERE events.event_time > read_state.last_read) OVER()::int AS unread_total
    FROM events CROSS JOIN read_state
    ORDER BY events.event_time DESC,events.source_id DESC LIMIT 50
  `;
  const unread=Number(notifications[0]?.unread_total??0);
  const items=notifications.map(({unread_total: _count,...item})=>item);
  return NextResponse.json({notifications:items,unread},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Notifications unavailable",notifications:[],unread:0},{status:503});}
}

/** User-triggered read acknowledgement, scoped to their own session. */
export async function POST(request:Request) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 try {
   const me=await currentProfile();
   if(!me)return NextResponse.json({error:"Sign in first"},{status:401});
   const sql=database();
   await sql`INSERT INTO looke_notification_state(profile_id,last_read_at)
       VALUES(${me.id}::uuid,now())
       ON CONFLICT(profile_id) DO UPDATE SET last_read_at=greatest(
         looke_notification_state.last_read_at,excluded.last_read_at)`;
   return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not mark notifications read"},{status:503});}
}
