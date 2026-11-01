import { NextRequest, NextResponse } from "next/server";
import { encodeAbiParameters,getAddress,isAddress,keccak256,zeroAddress } from "viem";
import { currentProfile } from "@/lib/server/session";
import { database } from "@/lib/server/database";
import { ultraClient } from "@/lib/server/evm";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
import { checkedContentPostId,contentSnapshotIsCurrent } from "@/lib/content-coin.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const mappingAbi=[{
 type:"function",name:"coinFor",stateMutability:"view",
 inputs:[{name:"key",type:"bytes32"}],outputs:[{name:"coin",type:"address"}],
}] as const;

/**
 * Only provides an offchain source consistency check and read-only testnet
 * introspection. Presence of code or a mapping does NOT verify contract origin
 * or a wallet-signed attestation. No signing or spending action is possible.
 */
export async function GET(request:NextRequest) {
 let postId:string;
 try{postId=checkedContentPostId(request.nextUrl.searchParams.get("postId"));}
 catch{return NextResponse.json({error:"Invalid post ID"},{status:400,headers});}
 try{
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in first"},{status:401,headers});
  const sql=database();
  const rows=await sql`
    SELECT d.content_ref,d.source_text_hash,d.source_edited_at,
      d.creator_address,d.name,d.symbol,d.supply_tokens::text,d.metadata_uri,
      p.text,p.edited_at,p.moderation_status
    FROM looke_content_coin_drafts d JOIN looke_posts p ON p.id=d.post_id
    WHERE d.post_id=${postId}::uuid AND d.profile_id=${owner.id}::uuid
      AND p.profile_id=${owner.id}::uuid LIMIT 1
  `;
  if(!rows.length)return NextResponse.json({error:"Content coin proposal unavailable"},{status:404,headers});
  const row=rows[0];
  const sourceCurrent=row.moderation_status==="visible" &&
    row.creator_address.toLowerCase()===owner.evm_address.toLowerCase() &&
    contentSnapshotIsCurrent({textHash:row.source_text_hash,contentRef:row.content_ref},
      postId,owner.evm_address,row.text,row.edited_at);
  const preview={
    postId,creatorAddress:owner.evm_address,contentRef:row.content_ref,
    sourceTextHash:row.source_text_hash,sourceCurrent,
    kind:1,chainId:ULTRA_EVM_TESTNET.chainId,
    name:row.name,symbol:row.symbol,supplyTokens:row.supply_tokens,
    supplyRaw:(BigInt(row.supply_tokens)*10n**18n).toString(),
    metadataURI:row.metadata_uri,
    creatorSignatureVerified:false,onchainPostAttestation:false,
    issuanceEnabled:false,liquidityCreated:false,
  };
  if(!sourceCurrent)return NextResponse.json({
    preview,
    check:{status:"stale_or_moderated_source",audited:false,issuanceEnabled:false,existingCoin:null},
    warning:"Source post changed or is no longer public. Refresh the draft after a legitimate revision; nothing will be issued.",
  },{status:409,headers});

  const configured=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  let status="unconfigured";
  let factoryAddress:string|null=null;
  let existingCoin:string|null=null;
  if(configured){
   if(!isAddress(configured)){status="invalid_factory_config";}
   else{
    factoryAddress=getAddress(configured);
    try{
     if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId){
       status="wrong_network";
     }else{
       const code=await ultraClient.getBytecode({address:factoryAddress as `0x${string}`});
       if(!code || code==="0x")status="not_deployed";
       else{
         const key=keccak256(encodeAbiParameters(
           [{type:"address"},{type:"uint8"},{type:"bytes32"}],
           [getAddress(owner.evm_address),1,row.content_ref as `0x${string}`]
         ));
         const address=await ultraClient.readContract({
           address:factoryAddress as `0x${string}`,abi:mappingAbi,
           functionName:"coinFor",args:[key],
         });
         existingCoin=address.toLowerCase()===zeroAddress?null:address;
         status=existingCoin?"factory_mapping_present_unverified":"unverified_factory_detected";
       }
     }
    }catch{status="rpc_check_unavailable";}
   }
  }
  return NextResponse.json({
    preview,
    check:{status,factoryAddress,existingCoin,audited:false,issuanceEnabled:false},
    warning:"Read-only contract inspection cannot prove post ownership onchain, factory provenance, liquidity or token legitimacy.",
  },{headers});
 }catch{
  return NextResponse.json({error:"Content coin preflight unavailable"},{status:503,headers});
 }
}
