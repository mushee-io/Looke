import {NextRequest,NextResponse} from "next/server";
import {createHash,timingSafeEqual} from "node:crypto";
import {createPublicClient,getAddress,http,isAddress,keccak256,parseAbi,zeroAddress} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient,ultraTestChain} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {checkedIndependentRpc} from "@/lib/testnet-evidence.mjs";
import {reviewedContentSource,verifiedFactoryObservations,unsignedContentPermit} from "@/lib/attestation-review.mjs";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
const postIdPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const hashPattern=/^0x[0-9a-f]{64}$/i;
const ABI=parseAbi([
 "function attestor() view returns (address)",
 "function authorizationNonces(address creator) view returns (uint256)",
 "function referenceCoinFor(uint8 kind,bytes32 reference) view returns (address)"
]);

/** Separate bearer: indexer/monitor credentials cannot review issuer payloads. */
function reviewAuthorized(req:Request){
 const secret=process.env.LOOKE_ATTESTATION_REVIEW_SECRET;
 if(!secret||secret.length<32||
    secret===process.env.LOOKE_INDEXER_SECRET||
    secret===process.env.LOOKE_INDEXER_MONITOR_SECRET)return false;
 const header=req.headers.get("authorization");
 if(!header?.startsWith("Bearer "))return false;
 const supplied=header.slice(7);
 if(supplied.length<32||supplied.length>1024)return false;
 const digest=(x:string)=>createHash("sha256").update(x).digest();
 return timingSafeEqual(digest(supplied),digest(secret));
}

/**
 * Private read-only post ownership and trusted-factory preflight. It prepares
 * EIP-712 structured data but NEVER signs, sends, deploys, or approves it.
 * Trends remain denied: no binding moderator/governance approval exists.
 */
export async function GET(request:NextRequest){
 if(!reviewAuthorized(request))
  return NextResponse.json({error:"Unauthorized"},{status:401,headers:HEADERS});
 if(process.env.LOOKE_ATTESTATION_REVIEW_ENABLED!=="true")
  return NextResponse.json({error:"Attestation review explicitly disabled",signed:false,
   issuanceEnabled:false},{status:503,headers:HEADERS});
 const id=request.nextUrl.searchParams.get("postId");
 if(!id||!postIdPattern.test(id) || request.nextUrl.searchParams.has("kind"))
  return NextResponse.json({error:"A valid content postId is required; trend attestations are disabled"},
   {status:400,headers:HEADERS});

 const address=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
 const attestor=process.env.LOOKE_EXPECTED_ATTESTOR_ADDRESS??"";
 const codeHash=process.env.LOOKE_EXPECTED_FACTORY_CODE_HASH??"";
 if(!isAddress(address)||!isAddress(attestor)||!hashPattern.test(codeHash)||
    address.toLowerCase()===zeroAddress||attestor.toLowerCase()===zeroAddress)
  return NextResponse.json({error:"Pinned factory and external attestor not configured",
   issuanceEnabled:false},{status:503,headers:HEADERS});
 let rpc:string;
 try{rpc=checkedIndependentRpc(process.env.LOOKE_INDEPENDENT_EVM_TESTNET_RPC,ULTRA_EVM_TESTNET.rpc);}
 catch{return NextResponse.json({error:"Independently configured second HTTPS Testnet RPC required"},
   {status:503,headers:HEADERS});}
 try{
  // Only current, visible, owner-linked source data from our isolated SQL store.
  const sql=database();
  const rows=await sql`
   SELECT d.post_id::text,d.profile_id::text AS draft_profile_id,
      p.profile_id::text AS post_profile_id,prof.id::text AS profile_id,
      prof.evm_address AS profile_evm_address,d.creator_address,
      p.text AS post_text,p.edited_at AS current_edited_at,p.moderation_status,
      d.source_edited_at,d.source_text_hash,d.content_ref,d.ref_version,
      d.name,d.symbol,d.supply_tokens::text AS supply_tokens,d.metadata_uri,
      (SELECT count(*)::int FROM looke_post_reports r WHERE r.post_id=p.id) AS report_count
   FROM looke_content_coin_drafts d
   JOIN looke_posts p ON p.id=d.post_id
   JOIN looke_profiles prof ON prof.id=d.profile_id
   WHERE d.post_id=${id}::uuid LIMIT 1
  `;
  if(rows.length!==1) return NextResponse.json({error:"Review source unavailable"},
   {status:404,headers:HEADERS});
  const source=reviewedContentSource(rows[0]);
  const factory=getAddress(address);
  const secondary=createPublicClient({chain:ultraTestChain,
    transport:http(rpc,{timeout:8000,retryCount:0})});
  const [chain1,chain2,head1,head2]=await Promise.all([
   ultraClient.getChainId(),secondary.getChainId(),
   ultraClient.getBlockNumber(),secondary.getBlockNumber()
  ]);
  if(chain1!==18881||chain2!==18881||head1<13n||head2<13n)
   throw new RangeError("Wrong chain or insufficient confirmed height");
  // Read exactly the same canonical block on two RPCs; not merely two latest states.
  const at=(head1<head2?head1:head2)-12n;
  const observe=async(client:typeof ultraClient)=>{
   const [block,code,issuer,nonce,mapped]=await Promise.all([
     client.getBlock({blockNumber:at}),
     client.getCode({address:factory,blockNumber:at}),
     client.readContract({address:factory,abi:ABI,functionName:"attestor",blockNumber:at}),
     client.readContract({address:factory,abi:ABI,functionName:"authorizationNonces",
       args:[source.creator],blockNumber:at}),
     client.readContract({address:factory,abi:ABI,functionName:"referenceCoinFor",
       args:[1,source.contentRef],blockNumber:at})
   ]);
   return {chainId:18881,blockHash:block.hash,blockTimestamp:block.timestamp,
     code:code??"0x",attestor:issuer,nonce,existingCoin:mapped};
  };
  const [first,second]=await Promise.all([observe(ultraClient),observe(secondary)]);
  const pinned=verifiedFactoryObservations(first,second,{
   factory,attestor,codeHash
  });
  const permit=unsignedContentPermit(source,pinned);
  // A durable signature requires an external audit/approval process and fresh
  // revalidation at the actual signing moment. No endpoint accepts an approval.
  const typedData=JSON.parse(JSON.stringify(permit.typedData,
    (_key,v)=>typeof v==="bigint"?v.toString():v));
  return NextResponse.json({
   status:"manual_review_required",network:"Ultra EVM Testnet",chainId:18881,
   reviewSource:{postId:source.postId,creator:source.creator,contentRef:source.contentRef,
    sourceTextHash:source.sourceTextHash,postVisible:true,unresolvedReports:0},
   factory,attestor,observedBlockNumber:at.toString(),
   observedBlockHash:pinned.blockHash,pinnedCodeHash:pinned.codeHash,
   nonce:pinned.nonce.toString(),typedData,digest:permit.digest,
   signed:false,manualApprovalRequired:true,issuanceEnabled:false,tradingEnabled:false,
   warning:permit.warning
  },{status:200,headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Post, factory or independent RPC review failed closed",
   signed:false,issuanceEnabled:false,manualApprovalRequired:true},
   {status:503,headers:HEADERS});
 }
}
