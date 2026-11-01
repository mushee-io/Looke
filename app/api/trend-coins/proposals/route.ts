import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {currentProfile,parseJson,validOrigin} from "@/lib/server/session";
import {normalizeTrendProposal,trendEvidenceEligible,trendReference,
 TREND_MAX_NOMINATIONS_30D} from "@/lib/trend-coin.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};

/** 20 public governance nominations, sourced from real Looke rows. No token listings. */
export async function GET(){
 try{
  const me=await currentProfile();
  const sql=database();
  const proposals=await sql`
    SELECT p.id,p.topic_slug,p.topic_label,p.trend_ref,p.name,p.symbol,
       p.supply_tokens::text AS supply_tokens,p.metadata_uri,p.status,
       p.created_at,p.proposer_id,
       coalesce(u.display_name,u.handle,'A Looke creator') AS proposer_name,
       u.handle AS proposer_handle,
       (p.proposer_id=${me?.id??null}::uuid) AS is_owner,
       (SELECT count(*)::int FROM looke_trend_endorsements e WHERE e.proposal_id=p.id) AS endorsements,
       EXISTS(SELECT 1 FROM looke_trend_endorsements e
         WHERE e.proposal_id=p.id AND e.voter_id=${me?.id??null}::uuid) AS viewer_endorsed,
       (SELECT count(*)::int FROM looke_posts po
          WHERE po.moderation_status='visible'
            AND po.created_at>now()-interval '14 days'
            AND to_tsvector('simple',po.text) @@ plainto_tsquery('simple',p.topic_label)) AS evidence_posts,
       (SELECT count(DISTINCT po.profile_id)::int FROM looke_posts po
          WHERE po.moderation_status='visible'
            AND po.created_at>now()-interval '14 days'
            AND to_tsvector('simple',po.text) @@ plainto_tsquery('simple',p.topic_label)) AS evidence_authors
    FROM looke_trend_proposals p JOIN looke_profiles u ON u.id=p.proposer_id
    WHERE p.status='under_review'
    ORDER BY p.created_at DESC,p.id DESC LIMIT 20
  `;
  return NextResponse.json({
    proposals:proposals.map(row=>({
      id:row.id,topic:row.topic_label,slug:row.topic_slug,trendRef:row.trend_ref,
      name:row.name,symbol:row.symbol,supplyTokens:row.supply_tokens,
      metadataURI:row.metadata_uri,status:row.status,createdAt:row.created_at,
      proposerName:row.proposer_name,proposerHandle:row.proposer_handle,
      isOwner:row.is_owner,endorsements:Number(row.endorsements),
      viewerEndorsed:row.viewer_endorsed,evidencePosts:Number(row.evidence_posts),
      evidenceAuthors:Number(row.evidence_authors),
      evidenceCurrent:trendEvidenceEligible(Number(row.evidence_posts),Number(row.evidence_authors)),
    })),
    issuanceEnabled:false,governanceBinding:false,
    disclaimer:"Community endorsements are mutable account-level interest signals, not sybil-resistant votes or permission to issue tokens.",
  },{headers});
 }catch{return NextResponse.json({error:"Trend nominations unavailable"},{status:503,headers});}
}

/** Only evidenced topics can be nominated by signed-in creators. No public issuance. */
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403,headers});
 try{
  const me=await currentProfile();
  if(!me)return NextResponse.json({error:"Sign in first"},{status:401,headers});
  if(!me.handle)return NextResponse.json({error:"Save a public creator handle first"},{status:409,headers});
  const body=await parseJson(request);
  let proposal:{topic:string;slug:string;name:string;symbol:string;supplyTokens:number;metadataURI:string};
  try{proposal=normalizeTrendProposal(body);}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Invalid proposal"},{status:400,headers});}
  const reference=trendReference(proposal.topic);
  const sql=database();
  const result=await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext(${me.id}::text||':trend-proposals'))`;
    const previous=await tx`SELECT count(*)::int AS count FROM looke_trend_proposals
      WHERE proposer_id=${me.id}::uuid AND created_at>now()-interval '30 days'`;
    if(Number(previous[0]?.count??0)>=TREND_MAX_NOMINATIONS_30D)return {status:"rate_limited"} as const;
    const evidence=await tx`
      SELECT count(*)::int AS posts,count(DISTINCT profile_id)::int AS authors FROM looke_posts
      WHERE moderation_status='visible' AND created_at>now()-interval '14 days'
        AND to_tsvector('simple',text) @@ plainto_tsquery('simple',${proposal.topic})
    `;
    const posts=Number(evidence[0]?.posts??0),authors=Number(evidence[0]?.authors??0);
    if(!trendEvidenceEligible(posts,authors))
      return {status:"insufficient_evidence",posts,authors} as const;
    const inserted=await tx`
      INSERT INTO looke_trend_proposals(
        topic_slug,topic_label,trend_ref,proposer_id,proposer_address,
        name,symbol,supply_tokens,metadata_uri)
      VALUES(${proposal.slug},${proposal.topic},${reference.trendRef},
        ${me.id}::uuid,${me.evm_address},${proposal.name},${proposal.symbol},
        ${proposal.supplyTokens},${proposal.metadataURI})
      ON CONFLICT DO NOTHING RETURNING id,topic_slug,trend_ref
    `;
    if(!inserted.length)return {status:"exists"} as const;
    return {status:"created",row:inserted[0],posts,authors} as const;
  });
  if(result.status==="rate_limited")return NextResponse.json({error:"Maximum 3 nominations per account in 30 days"},{status:429,headers});
  if(result.status==="insufficient_evidence")return NextResponse.json({
    error:"Topic needs at least 3 public posts by 2 accounts in the past 14 days.",
    posts:result.posts,authors:result.authors
  },{status:409,headers});
  if(result.status==="exists")return NextResponse.json({error:"This topic already has a nomination"},{status:409,headers});
  return NextResponse.json({created:true,proposalId:result.row.id,
    trendRef:result.row.trend_ref,evidencePosts:result.posts,evidenceAuthors:result.authors,
    status:"under_review",issuanceEnabled:false},{status:201,headers});
 }catch{return NextResponse.json({error:"Trend nomination unavailable"},{status:503,headers});}
}
