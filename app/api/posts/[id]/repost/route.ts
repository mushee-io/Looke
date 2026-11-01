import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { checkedSocialUuid } from "@/lib/social-interactions.mjs";

export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedSocialUuid((await params).id);}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try {
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401});
  const body=await parseJson(request) as {repost?:unknown};
  if(typeof body?.repost!=="boolean")return NextResponse.json({error:"Invalid repost action"},{status:400});
  const sql=database();
  if(body.repost) {
    const result=await sql.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':reposts'))`;
      const post=await tx`SELECT profile_id FROM looke_posts WHERE id=${id}::uuid AND moderation_status='visible' FOR SHARE`;
      if(!post.length)return "missing";
      if(post[0].profile_id===me.id)return "own";
      const existing=await tx`SELECT 1 FROM looke_reposts WHERE profile_id=${me.id}::uuid AND post_id=${id}::uuid`;
      if(existing.length)return "already";
      const count=await tx`SELECT count(*)::int AS count FROM looke_reposts WHERE profile_id=${me.id}::uuid AND created_at>now()-interval '24 hours'`;
      if(Number(count[0]?.count??0)>=30)return "limited";
      await tx`INSERT INTO looke_reposts(profile_id,post_id) VALUES(${me.id}::uuid,${id}::uuid) ON CONFLICT DO NOTHING`;
      return "added";
    });
    if(result==="missing")return NextResponse.json({error:"Post unavailable"},{status:404});
    if(result==="own")return NextResponse.json({error:"You cannot repost your own post"},{status:400});
    if(result==="limited")return NextResponse.json({error:"Daily repost limit reached"},{status:429});
  }else{
    await sql`DELETE FROM looke_reposts WHERE profile_id=${me.id}::uuid AND post_id=${id}::uuid`;
  }
  return NextResponse.json({ok:true,reposted:body.repost},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Reposting unavailable"},{status:503});}
}
