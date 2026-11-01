import {NextRequest,NextResponse} from "next/server";
import {checkedNativeAccount} from "@/lib/uniq-creation.mjs";
import {checkedUniqTokenId,parseNativeSalePrice,validateMarketIntent,
 verifyResaleOwnership,MARKET_REVIEW_TTL_MS} from "@/lib/uniq-market.mjs";
import {checkNativeMarketplaceChain,nativeResaleRow,nativeOwnedToken,
 nativeFactoryRow,NativeMarketReadError} from "@/lib/server/uniq-market";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store"};
/** No transaction bytes, seller/buyer signature, allowance or custody operations. */
export async function GET(request:NextRequest){
 const q=request.nextUrl.searchParams;
 const action=q.get("intent");
 if(action!=="buy"&&action!=="cancel"&&action!=="list")
  return NextResponse.json({error:"Invalid marketplace intent"},{status:400,headers:HEADERS});
 let account:string,tokenId:string;
 try{
  account=checkedNativeAccount(q.get("account"));
  tokenId=checkedUniqTokenId(q.get("tokenId"));
 }catch{
  return NextResponse.json({error:"Invalid native account or token ID"},{status:400,headers:HEADERS});
 }
 let proposedPrice:string|null=null;
 if(action==="list"){
  try{
   const parsed=parseNativeSalePrice(q.get("price"));
   if(parsed.currency!=="UOS")throw new RangeError("Only UOS listing proposals are supported");
   proposedPrice=parsed.amount;
  }catch{
   return NextResponse.json({error:"Listing review requires a positive, exact UOS price"},{status:400,headers:HEADERS});
  }
 }
 try{
  const chain=await checkNativeMarketplaceChain();
  const raw=await nativeResaleRow(tokenId);
  // An existing resale with a missing owner record cannot be treated as an
  // unlisted token; show a blocker rather than implying permission to relist.
  const listing=raw?await (async()=>{
   const parsed=await nativeOwnedToken(tokenId,String(raw.owner));
   return parsed?verifyResaleOwnership(raw,parsed):null;
  })():null;
  const own=action==="list"?await nativeOwnedToken(tokenId,account):null;
  const ownedUnlisted=own&&!raw?{owner:account}:null;
  const verdict=validateMarketIntent(action,account,listing,ownedUnlisted);
  if(raw&&!listing)verdict.reasons.push("Resale row could not be reconciled to an owner-scoped token.b record");
  const knownFactory=listing?.factoryId??(own?
   (typeof own.token_factory_id==="number"?String(own.token_factory_id):
     typeof own.token_factory_id==="string"?own.token_factory_id:null):null);
  let factoryChecked=false,factoryStatus:unknown=null;
  if(knownFactory){
   const factory=await nativeFactoryRow(knownFactory);
   factoryChecked=!!factory;
   factoryStatus=factory?.stat??null;
   if(!factory)verdict.reasons.push("Native Uniq factory record is missing");
  }else verdict.reasons.push("Native Uniq factory record is unknown");
  const conditionsMet=verdict.reasons.length===0;
  return NextResponse.json({
    ...chain,checkedAt:new Date().toISOString(),
    expiresAt:new Date(Date.now()+MARKET_REVIEW_TTL_MS).toISOString(),
    intent:action,tokenId,account,listing,proposedPrice,review:{
     ...verdict,conditionsMet,
     nativeFactoryFound:factoryChecked,factoryStatus,
     feeDisclosureComplete:false,lockupAndTradingWindowVerified:false,
     currentWalletControlVerified:false,
     purchasePriceCanChange:true,
     executionEnabled:false,
    },
    blockers:[
      ...verdict.reasons,
      "No verified native wallet ownership challenge and no reviewed signing/cancellation workflow.",
      "Final price, lockups, factory sale restrictions, royalties/promoter fees and network costs are not fully simulated.",
      "An Ultra buy action's max_price protection differs across NFT versions; this read is not a binding quote."
    ],
    warning:"Review only: no resell/buy/cancel transaction payload or approval is produced. RPC state may change before any future wallet action."
  },{headers:HEADERS});
 }catch(e){
  return NextResponse.json({error:e instanceof NativeMarketReadError?e.message:
    "Native Uniq marketplace review unavailable",executionEnabled:false},
    {status:e instanceof NativeMarketReadError?e.status:503,headers:HEADERS});
 }
}
