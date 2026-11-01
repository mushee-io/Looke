import "server-only";
import {ULTRA_NATIVE_TESTNET} from "@/lib/ultra";
import {MARKET_PAGE_SIZE,checkedUniqTokenId,checkedMarketCursor,
 nextMarketCursor,validateResaleRow,verifyResaleOwnership} from "@/lib/uniq-market.mjs";
import {checkedNativeAccount,checkedUniqFactoryId} from "@/lib/uniq-creation.mjs";

const CONTRACT="eosio.nft.ft";
type Row=Record<string,unknown>;
type TableResult={rows?:unknown[];more?:boolean;next_key?:unknown};
function row(value:unknown):Row|null {
 return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Row:null;
}
export class NativeMarketReadError extends Error {
 constructor(message:string,public status:number=503){super(message);}
}
async function rpc(path:string,body:Record<string,unknown>){
 const response=await fetch(ULTRA_NATIVE_TESTNET.rpc+path,{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw new NativeMarketReadError("Ultra native testnet RPC refused the query");
 const data=await response.json() as unknown;
 if(!row(data))throw new NativeMarketReadError("Malformed native RPC response");
 return data as Row;
}
export async function checkNativeMarketplaceChain(){
 const info=await rpc("/v1/chain/get_info",{});
 if(info.chain_id!==ULTRA_NATIVE_TESTNET.chainId)
  throw new NativeMarketReadError("Native RPC returned an unexpected Ultra network",503);
 const irreversible=info.last_irreversible_block_num;
 return {
  chainId:ULTRA_NATIVE_TESTNET.chainId,
  headBlock:typeof info.head_block_num==="number"&&Number.isSafeInteger(info.head_block_num)
    ?String(info.head_block_num):null,
  lastIrreversibleBlock:typeof irreversible==="number"&&Number.isSafeInteger(irreversible)
    ?String(irreversible):null
 };
}
async function table(name:"resale.a"|"token.b"|"factory.b",scope:string,lowerBound:string,limit:number){
 const response=await rpc("/v1/chain/get_table_rows",{
  json:true,code:CONTRACT,scope,table:name,
  lower_bound:lowerBound,limit,reverse:false
 }) as TableResult;
 if(!Array.isArray(response.rows)||typeof response.more!=="boolean")
  throw new NativeMarketReadError("Native marketplace table returned invalid pagination data");
 return response;
}
function matchesId(candidate:unknown,id:string){
 try{return checkedUniqTokenId(candidate)===id;}
 catch{return false;}
}
export async function nativeResaleRow(tokenId:string){
 const id=checkedUniqTokenId(tokenId);
 const result=await table("resale.a",CONTRACT,id,1);
 const first=row(result.rows?.[0]);
 return first && matchesId(first.token_id,id)?first:null;
}
export async function nativeOwnedToken(tokenId:string,account:string) {
 const id=checkedUniqTokenId(tokenId),owner=checkedNativeAccount(account);
 const result=await table("token.b",owner,id,1);
 const first=row(result.rows?.[0]);
 return first && matchesId(first.id,id)?first:null;
}
export async function nativeFactoryRow(factoryId:string){
 const id=checkedUniqFactoryId(factoryId);
 const result=await table("factory.b",CONTRACT,id,1);
 const first=row(result.rows?.[0]);
 return first && matchesId(first.id,id)?first:null;
}
export async function checkNativeResaleRecord(raw:unknown){
 const listing=validateResaleRow(raw);
 const token=await nativeOwnedToken(listing.tokenId,listing.owner);
 if(!token)return null; // Legacy token.a, disappeared, or unsettled: never call it verified.
 return verifyResaleOwnership(raw,token);
}
export async function readMarketplacePage(cursor:string|null){
 const start=checkedMarketCursor(cursor);
 const info=await checkNativeMarketplaceChain();
 const result=await table("resale.a",CONTRACT,start??"1",MARKET_PAGE_SIZE);
 const page=result.rows??[];
 // Fail closed on unexpected row shape. A missing owner's token.b hides a row,
 // while RPC outage throws and makes the page unavailable.
 const verified=await Promise.all(page.map(raw=>checkNativeResaleRecord(raw)));
 const listings=verified.filter((entry):entry is NonNullable<typeof entry>=>entry!==null);
 const nextCursor=nextMarketCursor(page as {token_id:string|number}[],result.more??false,result.next_key);
 return {
  ...info,source:"eosio.nft.ft::resale.a + owner-scoped token.b",
  rowsScanned:page.length,ownerNotConfirmed:page.length-listings.length,
  listings,nextCursor,
  nonAtomicReadWarning:"Resale and ownership were read in separate native testnet RPC calls. Values may change immediately; this is not a finality or purchase authorization proof.",
  purchasesEnabled:false,listingsEnabled:false,cancellationsEnabled:false,
  checkedAt:new Date().toISOString()
 };
}
