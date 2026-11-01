import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {checkedTrendId,TREND_MAX_ENDORSEMENTS_24H} from "@/lib/trend-coin.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/** One account-level endorsement per nomination; this is not token-holder governance. */
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 let id:string;
 try{id=checkedTrendId((await params).id);}
 catch{return NextResponse.json({error:"Invalid proposal ID"},{status:400,headers});}
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in required"},{status:401,headers});
  const body=await parseJson(request) as {endorse?:unknown};
  if(typeof body?.endorse!=="boolean")return NextResponse.json({error:"Expected endorsement action"},{status:400,headers});
  const sql=database();
  const result=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':trend-endorsements'))`;
    const proposal=await tx`SELECT proposer_id,status,created_at
      FROM looke_trend_proposals WHERE id=${id}::uuid FOR SHARE`;
    if(!proposal.length)return "missing";
    if(!body.endorse){
      await tx`DELETE FROM looke_trend_endorsements
        WHERE proposal_id=${id}::uuid AND voter_id=${me.id}::uuid`;
      return "removed";
    }
    if(proposal[0].proposer_id===me.id)return "self";
    if(proposal[0].status!=="under_review" ||
       new Date(proposal[0].created_at).getTime()+14*86400_000<=Date.now())return "closed";
    const existing=await tx`SELECT 1 FROM looke_trend_endorsements
      WHERE proposal_id=${id}::uuid AND voter_id=${me.id}::uuid`;
    if(existing.length)return "already";
    const recent=await tx`SELECT count(*)::int AS count FROM looke_trend_endorsements
      WHERE voter_id=${me.id}::uuid AND created_at>now()-interval '24 hours'`;
    if(Number(recent[0]?.count??0)>=TREND_MAX_ENDORSEMENTS_24H)return "rate_limited";
    await tx`INSERT INTO looke_trend_endorsements(proposal_id,voter_id)
      VALUES(${id}::uuid,${me.id}::uuid) ON CONFLICT DO NOTHING`;
    return "endorsed";
  });
  if(result==="missing")return NextResponse.json({error:"Proposal unavailable"},{status:404,headers});
  if(result==="self")return NextResponse.json({error:"You cannot endorse your own nomination"},{status:400,headers});
  if(result==="closed")return NextResponse.json({error:"The endorsement window is closed"},{status:409,headers});
  if(result==="rate_limited")return NextResponse.json({error:"Daily endorsement limit reached"},{status:429,headers});
  return NextResponse.json({ok:true,endorsement:result==="endorsed"||result==="already",
    governanceBinding:false,issuanceEnabled:false},{headers});
 }catch{return NextResponse.json({error:"Endorsement unavailable"},{status:503,headers});}
}
