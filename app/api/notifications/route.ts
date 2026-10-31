import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile } from "@/lib/server/session";
export const dynamic="force-dynamic";
export async function GET(){
 try {
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in first",notifications:[]},{status:401});
  const sql=database();
  const notifications=await sql`
    SELECT kind,actor,event_time,source_id FROM (
      SELECT 'follow'::text AS kind, coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS actor,
        f.created_at AS event_time, u.id::text AS source_id
      FROM looke_follows f JOIN looke_profiles u ON u.id=f.follower_id
      WHERE f.followed_id=${me.id}
      UNION ALL
      SELECT 'like'::text AS kind, coalesce(u.display_name,u.handle,substr(u.evm_address,1,10)) AS actor,
        l.created_at AS event_time, l.post_id::text AS source_id
      FROM looke_likes l JOIN looke_posts p ON p.id=l.post_id
      JOIN looke_profiles u ON u.id=l.profile_id
      WHERE p.profile_id=${me.id} AND u.id<>${me.id}
    ) events ORDER BY event_time DESC LIMIT 30
  `;
  return NextResponse.json({notifications},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Notifications unavailable",notifications:[]},{status:503});}
}
