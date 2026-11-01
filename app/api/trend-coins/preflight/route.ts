import {NextRequest,NextResponse} from "next/server";
import {encodeAbiParameters,getAddress,isAddress,keccak256,zeroAddress} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {checkedTrendId,trendEvidenceEligible,trendReference} from "@/lib/trend-coin.mjs";

export const dynamic="force-dynamic";
const mappingAbi=[{
 type:"function",name:"coinFor",stateMutability:"view",
 inputs:[{name:"key",type:"bytes32"}],outputs:[{name:"coin",type:"address"}],
}] as const;

/** Public read-only social evidence and optional unverified factory mapping. */
export async function GET(request:NextRequest){
 let id:string;
 try{id=checkedTrendId(request.nextUrl.searchParams.get("id"));}
 catch{return NextResponse.json({error:"Invalid nomination ID"},{status:400});}
 try{
  const sql=database();
  const rows=await sql`
    SELECT p.topic_label,p.trend_ref,p.proposer_address,p.status,
      (SELECT count(*)::int FROM looke_posts po WHERE po.moderation_status='visible'
       AND po.created_at>now()-interval '14 days'
       AND to_tsvector('simple',po.text) @@ plainto_tsquery('simple',p.topic_label)) AS evidence_posts,
      (SELECT count(DISTINCT po.profile_id)::int FROM looke_posts po
       WHERE po.moderation_status='visible' AND po.created_at>now()-interval '14 days'
       AND to_tsvector('simple',po.text) @@ plainto_tsquery('simple',p.topic_label)) AS evidence_authors
    FROM looke_trend_proposals p WHERE p.id=${id}::uuid LIMIT 1
  `;
  if(!rows.length)return NextResponse.json({error:"Nomination unavailable"},{status:404});
  const row=rows[0],reference=trendReference(row.topic_label);
  const current=reference.trendRef===row.trend_ref &&
    trendEvidenceEligible(Number(row.evidence_posts),Number(row.evidence_authors)) &&
    row.status==="under_review";
  const preview={chainId:18881,kind:2,topic:reference.topic,trendRef:reference.trendRef,
    evidencePosts:Number(row.evidence_posts),evidenceAuthors:Number(row.evidence_authors),
    evidenceCurrent:current,governanceBinding:false,issuanceEnabled:false};
  const configured=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  let status="unconfigured",existingCoin:string|null=null,factoryAddress:string|null=null;
  if(configured){
    if(!isAddress(configured))status="invalid_factory_config";
    else {
      factoryAddress=getAddress(configured);
      try{
        if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)status="wrong_network";
        else{
          const code=await ultraClient.getBytecode({address:factoryAddress as `0x${string}`});
          if(!code||code==="0x")status="not_deployed";
          else{
            const key=keccak256(encodeAbiParameters(
              [{type:"address"},{type:"uint8"},{type:"bytes32"}],
              [getAddress(row.proposer_address),2,row.trend_ref as `0x${string}`]
            ));
            const mapped=await ultraClient.readContract({
              address:factoryAddress as `0x${string}`,abi:mappingAbi,functionName:"coinFor",args:[key]
            });
            existingCoin=mapped.toLowerCase()===zeroAddress?null:mapped;
            status=existingCoin?"unverified_mapping_present":"unverified_factory_detected";
          }
        }
      }catch{status="rpc_unavailable";}
    }
  }
  return NextResponse.json({preview,check:{status,factoryAddress,existingCoin,audited:false,
    issuanceEnabled:false},warning:"This check does not prove a legitimate trend, independent votes, contract authorization, or any token value."},
    {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Trend coin preflight unavailable"},{status:503});}
}
