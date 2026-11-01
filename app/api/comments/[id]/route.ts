import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { currentProfile, validOrigin } from "@/lib/server/session";
import { checkedSocialUuid } from "@/lib/social-interactions.mjs";

export const dynamic="force-dynamic";
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;
 try{id=checkedSocialUuid((await params).id);}
 catch{return NextResponse.json({error:"Invalid comment ID"},{status:400});}
 try {
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401});
  const sql=database();
  const removed=await sql`DELETE FROM looke_comments WHERE id=${id}::uuid AND profile_id=${me.id}::uuid RETURNING id`;
  if(!removed.length)return NextResponse.json({error:"Comment unavailable or not yours"},{status:404});
  return NextResponse.json({deleted:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Comment removal unavailable"},{status:503});}
}
