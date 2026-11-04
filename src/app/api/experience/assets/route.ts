import {NextRequest,NextResponse} from "next/server";
import {indexCreatorLaunches} from "../../../../lib/ops/m13-index";
import {getNativeTestnetInfo,ownedUniqs} from "../../../../lib/ultra-native-rpc";
import {parseAssetLookup,type AssetProof} from "../../../../lib/experience/assets";
import {findNativeUniq} from "../../../../lib/experience/uniq-lookup";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store"};
/**
 * Ultra Testnet chain evidence only. A nonmatching page is NOT proof of
 * nonexistence or lack of ownership; verified origin/ownership is explicit.
 */
export async function GET(req:NextRequest){
 let input:ReturnType<typeof parseAssetLookup>;
 try{input=parseAssetLookup(req.nextUrl.searchParams);}
 catch{return NextResponse.json({error:"Invalid asset reference."},{status:400,headers});}
 try{
   if(input.kind==="token"){
     const page=await indexCreatorLaunches();
     const found=page.status==="verified"?
       page.launches.find(l=>l.token.toLowerCase()===input.id.toLowerCase()):null;
     const result:AssetProof={
       kind:"token",id:input.id,network:"Ultra EVM Testnet",
       verified:!!found,status:found?"verified":page.status==="unconfigured"?"unconfigured":"unindexed",
       proof:found?"Canonical CoinCreated receipt, creator and deployed token code verified.":
         "Only the latest bounded factory event page was scanned. No creator deployment claim.",
       block:found?.blockNumber??null,source:found?.txHash??null,owner:null,transactionsSent:0,
     };
     return NextResponse.json(result,{headers});
   }
   const [info,lookup]=await Promise.all([
     getNativeTestnetInfo(),
     findNativeUniq(input.account,input.id,ownedUniqs,3),
   ]);
   const token=lookup.found;
   const result:AssetProof={
     kind:"uniq",id:input.id,network:"Ultra native Testnet",
     verified:!!token,status:token?"verified":"unindexed",
     proof:token?"Uniq token found in actual native account scope on correct Testnet.":
       "No matching Uniq in the first "+lookup.scanned+" actual scoped rows across "+
       lookup.pages+" page(s). This does NOT prove non-ownership.",
     block:String(Math.min(info.last_irreversible_block_num,lookup.irreversibleBlock)),
     source:token?.token_factory_id??null,owner:token?input.account:null,transactionsSent:0,
   };
   return NextResponse.json(result,{headers});
 }catch{
   return NextResponse.json({
     kind:input.kind,id:input.id,network:input.kind==="token"?"Ultra EVM Testnet":"Ultra native Testnet",
     verified:false,status:"unavailable",proof:"Independent Testnet RPC evidence unavailable.",
     block:null,source:null,owner:null,transactionsSent:0,
   } satisfies AssetProof,{status:503,headers});
 }
}
