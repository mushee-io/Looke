import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,validOrigin} from "@/lib/server/session";
import {checkedTrendId} from "@/lib/trend-coin.mjs";

export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 let id:string;try{id=checkedTrendId((await params).id);}
 catch{return NextResponse.json({error:"Invalid proposal ID"},{status:400});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401});
  const sql=database();
  const rows=await sql`UPDATE looke_trend_proposals SET status='withdrawn',updated_at=now()
    WHERE id=${id}::uuid AND proposer_id=${me.id}::uuid AND status='under_review'
    RETURNING id`;
  if(!rows.length)return NextResponse.json({error:"Nomination unavailable or not yours"},{status:404});
  // Do not free topic_slug for impersonation or re-nomination under the old topic.
  return NextResponse.json({withdrawn:true,issuanceEnabled:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Could not withdraw nomination"},{status:503});}
}
