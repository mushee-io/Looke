import {NextRequest,NextResponse} from "next/server";
import {ULTRA_NATIVE_TESTNET} from "@/lib/ultra";
import {checkedNativeAccount} from "@/lib/uniq-creation.mjs";
import {checkedNativePortfolioCursor,checkedNativePortfolioRow,nativePortfolioNextCursor,
 NATIVE_PAGE_SIZE} from "@/lib/portfolio-guards.mjs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
type ResponseRows={rows?:unknown[];more?:boolean;next_key?:unknown};
async function rpc(path:string,body:Record<string,unknown>){
 const response=await fetch(ULTRA_NATIVE_TESTNET.rpc+path,{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
  cache:"no-store",signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error("Native RPC unavailable");
 return response.json() as Promise<Record<string,unknown>>;
}
/** Owner-scoped native token.b pages; not merged with EVM token balances. */
export async function GET(request:NextRequest) {
 let account:string,cursor:string|null;
 try{
  account=checkedNativeAccount(request.nextUrl.searchParams.get("account"));
  cursor=checkedNativePortfolioCursor(request.nextUrl.searchParams.get("cursor"));
 }catch{return NextResponse.json({error:"Invalid native Ultra account or token cursor"},{status:400,headers});}
 try{
  const info=await rpc("/v1/chain/get_info",{});
  if(info.chain_id!==ULTRA_NATIVE_TESTNET.chainId)
   return NextResponse.json({error:"Native RPC is not on Ultra native testnet"},{status:503,headers});
  const page=await rpc("/v1/chain/get_table_rows",{
   json:true,code:"eosio.nft.ft",scope:account,table:"token.b",
   lower_bound:cursor??"1",limit:NATIVE_PAGE_SIZE,reverse:false
  }) as ResponseRows;
  if(!Array.isArray(page.rows)||typeof page.more!=="boolean")
   throw Error("Native token.b returned malformed results");
  const uniqs=page.rows.map(checkedNativePortfolioRow);
  const nextCursor=nativePortfolioNextCursor(
   page.rows as Array<{id:string|number}>,page.more,page.next_key);
  return NextResponse.json({
   network:"Ultra Native Testnet",chainId:ULTRA_NATIVE_TESTNET.chainId,
   account,source:"eosio.nft.ft::token.b owner account scope",
   uniqs,nextCursor,pageSize:NATIVE_PAGE_SIZE,
   pageItemCount:uniqs.length,
   headBlock:typeof info.head_block_num==="number"?String(info.head_block_num):null,
   lastIrreversibleBlock:typeof info.last_irreversible_block_num==="number"?
     String(info.last_irreversible_block_num):null,
   walletControlVerified:false,allHoldingsLoaded:nextCursor===null,
   valuationUos:null,valuationUsd:null,
   warning:"Native wallet-account table read: current ownership may change, pending NFTs or legacy token versions may be omitted; an account name is not cryptographic wallet ownership proof."
  },{headers});
 }catch{
  return NextResponse.json({error:"Native token.b holdings RPC unavailable; no holdings invented",
   uniqs:[]},{status:503,headers});
 }
}
