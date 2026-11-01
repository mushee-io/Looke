import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { cleanPostText, checkedPostUuid } from "@/lib/post-content.mjs";

export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};

/** Edit a visible post only as its author, with a 10-second edit cooldown. */
export async function PATCH(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedPostUuid((await params).id);}catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try{
   const profile=await currentProfile();
   if(!profile)return NextResponse.json({error:"Sign in required"},{status:401});
   const input=await parseJson(request) as {text?:unknown};
   let text:string;
   try{text=cleanPostText(input?.text);}
   catch{return NextResponse.json({error:"Post must contain 1–1200 valid characters"},{status:400});}
   const sql=database();
   const rows=await sql`UPDATE looke_posts
     SET text=${text},edited_at=now()
     WHERE id=${id}::uuid AND profile_id=${profile.id}::uuid
       AND moderation_status='visible'
       AND (edited_at IS NULL OR edited_at<now()-interval '10 seconds')
     RETURNING id,text,created_at,edited_at`;
   if(!rows.length)return NextResponse.json({error:"Post unavailable, not yours or recently edited"},{status:404});
   return NextResponse.json({post:rows[0]},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Post editing unavailable"},{status:503});}
}

/** Permanently remove your own post; likes/reports cascade by foreign key. */
export async function DELETE(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedPostUuid((await params).id);}catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try{
   const profile=await currentProfile();
   if(!profile)return NextResponse.json({error:"Sign in required"},{status:401});
   const sql=database();
   const deleted=await sql`DELETE FROM looke_posts WHERE id=${id}::uuid
      AND profile_id=${profile.id}::uuid RETURNING id`;
   if(!deleted.length)return NextResponse.json({error:"Post unavailable or not yours"},{status:404});
   return NextResponse.json({deleted:true,id:deleted[0].id},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Post removal unavailable"},{status:503});}
}
