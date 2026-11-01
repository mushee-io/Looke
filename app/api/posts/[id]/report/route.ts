import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { checkedPostUuid, checkedReportReason } from "@/lib/post-content.mjs";

export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};

/** Create a private report. This does not auto-hide or publicly expose reports. */
export async function POST(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedPostUuid((await params).id);}catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try{
   const me=await currentProfile();
   if(!me)return NextResponse.json({error:"Sign in to report a post"},{status:401});
   const body=await parseJson(request) as {reason?:unknown};
   let reason:string;
   try{reason=checkedReportReason(body?.reason);}
   catch{return NextResponse.json({error:"Invalid report reason"},{status:400});}
   const sql=database();
   const result=await sql.begin(async tx=>{
     await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text || ':reports'))`;
     const posts=await tx`SELECT profile_id FROM looke_posts
        WHERE id=${id}::uuid AND moderation_status='visible' LIMIT 1`;
     if(!posts.length)return "missing";
     if(posts[0].profile_id===me.id)return "self";
     const existing=await tx`SELECT 1 FROM looke_post_reports
        WHERE post_id=${id}::uuid AND reporter_id=${me.id}::uuid`;
     if(existing.length)return "already";
     const recent=await tx`SELECT count(*)::int AS count FROM looke_post_reports
        WHERE reporter_id=${me.id}::uuid AND created_at>now()-interval '24 hours'`;
     if(Number(recent[0]?.count??0)>=20)return "limited";
     await tx`INSERT INTO looke_post_reports(post_id,reporter_id,reason)
       VALUES(${id}::uuid,${me.id}::uuid,${reason}) ON CONFLICT DO NOTHING`;
     return "reported";
   });
   if(result==="missing")return NextResponse.json({error:"Post unavailable"},{status:404});
   if(result==="self")return NextResponse.json({error:"Cannot report your own post"},{status:400});
   if(result==="limited")return NextResponse.json({error:"Daily reporting limit reached"},{status:429});
   return NextResponse.json({ok:true,submitted:result==="reported"},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Reporting unavailable"},{status:503});}
}
