import {NextRequest,NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {normalizeTrendTopic,trendEvidenceEligible} from "@/lib/trend-coin.mjs";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 let topic:string;
 try{topic=normalizeTrendTopic(request.nextUrl.searchParams.get("topic")).topic;}
 catch{return NextResponse.json({error:"Invalid trend topic"},{status:400});}
 try{
  const sql=database();
  const counts=await sql`
    SELECT count(*)::int AS posts,count(DISTINCT profile_id)::int AS authors
    FROM looke_posts
    WHERE moderation_status='visible'
      AND created_at>now()-interval '14 days'
      AND to_tsvector('simple',text) @@ plainto_tsquery('simple',${topic})
  `;
  const posts=Number(counts[0]?.posts??0),authors=Number(counts[0]?.authors??0);
  return NextResponse.json({topic,posts,authors,eligibleForNomination:trendEvidenceEligible(posts,authors),
   criterion:"At least 3 visible posts from 2 different Looke accounts in the last 14 days. This is not proof of independent humans or organic popularity.",
   tokenIssuanceEnabled:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Trend evidence unavailable"},{status:503});}
}
