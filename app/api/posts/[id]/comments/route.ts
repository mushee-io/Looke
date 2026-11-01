import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, parseJson, validOrigin } from "@/lib/server/session";
import { checkedSocialUuid,cleanComment } from "@/lib/social-interactions.mjs";

export const dynamic="force-dynamic";
type Params={params:Promise<{id:string}>};

export async function GET(_request:Request,{params}:Params) {
 let id:string;
 try{id=checkedSocialUuid((await params).id);}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try {
  const sql=database();
  const posts=await sql`SELECT 1 FROM looke_posts WHERE id=${id}::uuid AND moderation_status='visible'`;
  if(!posts.length)return NextResponse.json({error:"Post unavailable"},{status:404});
  const viewer=await currentProfile();
  const comments=await sql`
   SELECT c.id,c.text,c.created_at,
      p.id AS author_id,p.handle AS author_handle,
      coalesce(p.display_name,p.handle,substr(p.evm_address,1,10)) AS author,
      (c.profile_id=${viewer?.id??null}::uuid) AS is_owner
   FROM looke_comments c JOIN looke_profiles p ON p.id=c.profile_id
   WHERE c.post_id=${id}::uuid AND c.moderation_status='visible'
   ORDER BY c.created_at DESC,c.id DESC LIMIT 30
  `;
  return NextResponse.json({comments},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Comments unavailable"},{status:503});}
}

export async function POST(request:Request,{params}:Params) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedSocialUuid((await params).id);}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400});}
 try {
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401});
  const body=await parseJson(request) as {text?:unknown};
  let text:string;
  try{text=cleanComment(body?.text);}
  catch{return NextResponse.json({error:"Comment must contain 1–500 valid characters"},{status:400});}
  const sql=database();
  const result=await sql.begin(async tx=>{
    // Atomic per-user throttle, including under parallel requests.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':comments'))`;
    const post=await tx`SELECT 1 FROM looke_posts WHERE id=${id}::uuid AND moderation_status='visible' FOR SHARE`;
    if(!post.length)return {error:"missing"};
    const recent=await tx`SELECT count(*)::int AS count FROM looke_comments WHERE profile_id=${me.id}::uuid AND created_at>now()-interval '5 minutes'`;
    if(Number(recent[0]?.count??0)>=10)return {error:"limited"};
    const rows=await tx`INSERT INTO looke_comments(post_id,profile_id,text) VALUES(${id}::uuid,${me.id}::uuid,${text})
      RETURNING id,text,created_at`;
    return {comment:rows[0]};
  });
  if(result.error==="missing")return NextResponse.json({error:"Post unavailable"},{status:404});
  if(result.error==="limited")return NextResponse.json({error:"Commenting limit reached; try later"},{status:429,headers:{"Retry-After":"300"}});
  return NextResponse.json({comment:result.comment},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Commenting unavailable"},{status:503});}
}
