import { NextRequest, NextResponse } from "next/server";
import { inspectEvmCoin, inspectEvmFactory, inspectNativeUniq } from "../../../../lib/beta/acceptance";
import { validEvmAddress, validHash } from "../../../../lib/beta/policy";
import { positiveId, validateNativeAccount } from "../../../../lib/ultra-native";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** Read-only, bounded wallet/contract acceptance checks; NEVER requests a signature. */
export async function GET(req:NextRequest){
  // Expensive read-only chain proof checks are available only when a protected
  // staging operator deliberately enables them. Never enable on public beta by default.
  if(process.env.LOOKE_M6_EVIDENCE_ENABLED!=="true"){
    return NextResponse.json({verified:false,readOnly:true,error:"Staging evidence verification is disabled."},
      {status:403,headers:{"cache-control":"no-store"}});
  }
  const p=req.nextUrl.searchParams;
  const kind=p.get("kind");
  const address=p.get("address")||"";
  const tx=p.get("tx")||"";
  try{
    let result:unknown;
    if(kind==="factory"){
      if(!validEvmAddress(address)||!validHash(tx))throw new Error("Valid factory address and 32-byte deployment hash required.");
      result=await inspectEvmFactory(address,tx);
    }else if(kind==="coin"){
      if(!validEvmAddress(address)||!validHash(tx))throw new Error("Valid factory address and coin-creation hash required.");
      result=await inspectEvmCoin(address,tx);
    }else if(kind==="uniq"){
      const factory=positiveId(p.get("factoryId")||"");
      const owner=validateNativeAccount(p.get("owner")||"");
      const token=positiveId(p.get("tokenId")||"");
      result=await inspectNativeUniq(factory,owner,token);
    }else{
      return NextResponse.json({error:"Choose kind=factory, coin or uniq."},{status:400});
    }
    return NextResponse.json({verified:true,proof:result,readOnly:true},{headers:{"cache-control":"no-store"}});
  }catch(error){
    // Do not claim an absent/failed transaction is verified.
    return NextResponse.json({
      verified:false,readOnly:true,error:error instanceof Error?error.message:"Testnet evidence could not be verified.",
    },{status:422,headers:{"cache-control":"no-store"}});
  }
}
