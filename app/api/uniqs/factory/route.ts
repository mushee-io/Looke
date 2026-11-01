import {NextRequest,NextResponse} from "next/server";
import {ULTRA_NATIVE_TESTNET} from "@/lib/ultra";
import {checkedNativeAccount,checkedUniqFactoryId,reviewNativeUniqFactory} from "@/lib/uniq-creation.mjs";

export const dynamic="force-dynamic";
type Row=Record<string,unknown>;
type RpcResponse={rows?:unknown[];more?:boolean};
const CONTRACT="eosio.nft.ft";
function asRow(value:unknown):Row|null{
 return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Row:null;
}
async function nativeRpc(path:string,body:Record<string,unknown>){
 const response=await fetch(ULTRA_NATIVE_TESTNET.rpc+path,{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw new Error("Native Ultra RPC refused the request");
 return response.json() as Promise<Record<string,unknown>>;
}
/**
 * Verified-shape, read-only factory.b and authmintrs.a inspection on native
 * ULTRA TESTNET. The supplied account is not cryptographically authenticated.
 */
export async function GET(request:NextRequest){
 const q=request.nextUrl.searchParams;
 let factoryId:string,account:string;
 try{factoryId=checkedUniqFactoryId(q.get("factoryId"));
   account=checkedNativeAccount(q.get("account"));}
 catch{return NextResponse.json({error:"Invalid native account or factory ID"},{status:400});}
 try{
  const info=await nativeRpc("/v1/chain/get_info",{});
  if(info.chain_id!==ULTRA_NATIVE_TESTNET.chainId)
   return NextResponse.json({error:"Native RPC returned the wrong testnet chain"},{status:503});
  const result=await nativeRpc("/v1/chain/get_table_rows",{
   code:CONTRACT,scope:CONTRACT,table:"factory.b",
   lower_bound:factoryId,limit:1,json:true
  }) as RpcResponse;
  const row=asRow(result.rows?.[0]);
  if(!row||String(row.id)!==factoryId)
   return NextResponse.json({error:"No factory.b entry exists for this ID on Ultra native testnet",
    factoryFound:false,eligibleForReview:false},{status:404,headers:{"Cache-Control":"no-store"}});
  const nowSeconds=Math.floor(Date.now()/1000);
  const manager=typeof row.asset_manager==="string"?row.asset_manager:"";
  const base=reviewNativeUniqFactory(row,manager,nowSeconds);
  const isManager=account===manager;
  let authorizedMinter=false;
  let minterRemaining:number|null=null;
  if(!isManager){
   const minters=await nativeRpc("/v1/chain/get_table_rows",{
    code:CONTRACT,scope:factoryId,table:"authmintrs.a",
    lower_bound:account,limit:1,json:true
   }) as RpcResponse;
   const found=asRow(minters.rows?.[0]);
   const remaining=Number(found?.quantity);
   authorizedMinter=found?.authorized_minter===account &&
      Number.isSafeInteger(remaining)&&remaining>0;
   minterRemaining=authorizedMinter?remaining:null;
  }
  const eligibleForReview=base.eligible&&(isManager||authorizedMinter);
  const reasons=[...base.reasons.filter(x=>!x.startsWith("Connected account is not the factory asset manager"))];
  if(!isManager&&!authorizedMinter)reasons.push("Account is neither asset manager nor a verified positive-quota authorized minter");
  if(BigInt(factoryId)>BigInt(Number.MAX_SAFE_INTEGER))
   reasons.push("This factory ID exceeds the current Ultra Wallet SDK integration's safe numeric range");
  const canUseLab=eligibleForReview&&BigInt(factoryId)<=BigInt(Number.MAX_SAFE_INTEGER);
  return NextResponse.json({
   network:"Ultra Native Testnet",chainId:ULTRA_NATIVE_TESTNET.chainId,
   factoryId,account,assetManager:manager,
   assetCreator:typeof row.asset_creator==="string"?row.asset_creator:null,
   factoryStatus:row.stat,maximumMintable:row.max_mintable_tokens??null,
   mintedCount:row.minted_tokens_no??null,
   mintableWindowStart:row.mintable_window_start??null,
   mintableWindowEnd:row.mintable_window_end??null,
   hasFactoryMetadata:typeof row.factory_uri==="string"&&row.factory_uri.length>0,
   role:isManager?"asset_manager":authorizedMinter?"authorized_minter":"unverified",
   authorizedMinterRemaining:minterRemaining,
   eligibleForReview:canUseLab,
   reasons,source:"eosio.nft.ft::factory.b and authmintrs.a",
   walletControlVerified:false,finalityVerified:false,
   transactionSimulationVerified:false,mintingEnabled:false,
   warning:"Read-only eligibility estimate. An account name supplied in a URL is not a signature, and factory status can change before a user-signed mint."
  },{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Native Ultra factory state unavailable; mint verification cannot proceed",
   eligibleForReview:false,mintingEnabled:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
