import { NextResponse } from "next/server";
import { encodeAbiParameters, getAddress, isAddress, keccak256, zeroAddress, zeroHash } from "viem";
import { database } from "@/lib/server/database";
import { currentProfile } from "@/lib/server/session";
import { ultraClient } from "@/lib/server/evm";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
import { creatorCoinPreview } from "@/lib/creator-coin.mjs";

export const dynamic="force-dynamic";
const cacheHeaders={"Cache-Control":"private, no-store"};
const mappingAbi=[{
  type:"function",name:"coinFor",stateMutability:"view",
  inputs:[{name:"key",type:"bytes32"}],outputs:[{name:"coin",type:"address"}]
}] as const;

/** Purely read-only checks. This route never constructs or broadcasts a spend. */
export async function GET() {
 try {
  const owner=await currentProfile();
  if(!owner)return NextResponse.json({error:"Sign in required"},{status:401,headers:cacheHeaders});
  const sql=database();
  const rows=await sql`
    SELECT name,symbol,supply_tokens,metadata_uri
    FROM looke_creator_coin_drafts WHERE profile_id=${owner.id}::uuid LIMIT 1
  `;
  if(!rows.length)return NextResponse.json({error:"Save a creator coin draft first"},{status:404,headers:cacheHeaders});
  const row=rows[0];
  // Only the authenticated profile's address is used. Users cannot supply a
  // creator address or obtain another account's private draft here.
  const preview=creatorCoinPreview({
    name:row.name,symbol:row.symbol,
    supplyTokens:Number(row.supply_tokens),metadataURI:row.metadata_uri,
  },owner.evm_address);

  const configured=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  const details={
    network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,
    factoryAddress:null as string|null, status:"unconfigured",
    existingCreatorCoin:null as string|null, audited:false,
    issuanceEnabled:false,
    warning:"This is a testnet planning and read-only check, not an audited token launch.",
  };
  if(!configured)return NextResponse.json({preview,check:details},{headers:cacheHeaders});
  if(!isAddress(configured))
    return NextResponse.json({preview,check:{...details,status:"invalid_factory_config"}},{headers:cacheHeaders});
  details.factoryAddress=getAddress(configured);
  try {
    if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId){
      return NextResponse.json({preview,check:{...details,status:"wrong_network"}},{headers:cacheHeaders});
    }
    const bytecode=await ultraClient.getBytecode({address:details.factoryAddress as `0x${string}`});
    if(!bytecode || bytecode==="0x")
      return NextResponse.json({preview,check:{...details,status:"not_deployed"}},{headers:cacheHeaders});
    // The factory stores creator coins under keccak256(abi.encode(creator,0,0)).
    const key=keccak256(encodeAbiParameters(
      [{type:"address"},{type:"uint8"},{type:"bytes32"}],
      [getAddress(owner.evm_address),0,zeroHash],
    ));
    const address=await ultraClient.readContract({
      address:details.factoryAddress as `0x${string}`,abi:mappingAbi,
      functionName:"coinFor",args:[key],
    });
    details.existingCreatorCoin=address.toLowerCase()===zeroAddress?null:address;
    details.status=details.existingCreatorCoin?"existing_testnet_coin":"unverified_factory_detected";
    // A nonempty bytecode and readable mapping do NOT prove audit, provenance,
    // issuer authority, liquidity or that this contract is the expected factory.
    return NextResponse.json({preview,check:details},{headers:cacheHeaders});
  }catch{
    return NextResponse.json({preview,check:{...details,status:"rpc_check_unavailable"}},{headers:cacheHeaders});
  }
 }catch{
  return NextResponse.json({error:"Creator coin preflight unavailable"},{status:503,headers:cacheHeaders});
 }
}
