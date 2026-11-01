import {NextRequest,NextResponse} from "next/server";
import {checkedNativeAccount,checkedUniqFactoryId} from "@/lib/uniq-creation.mjs";
import {checkedUniqTokenId} from "@/lib/uniq-market.mjs";
import {estimateNativeResaleDistribution} from "@/lib/creator-earnings.mjs";
import {ULTRA_NATIVE_TESTNET} from "@/lib/ultra";
import {checkNativeMarketplaceChain,nativeFactoryRow,nativeOwnedToken,nativeResaleRow}
 from "@/lib/server/uniq-market";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store"};
const CONTRACT="eosio.nft.ft";
type RpcData={rows?:unknown[];more?:boolean};
type TableRow=Record<string,unknown>;
function object(value:unknown):TableRow|null{
 return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as TableRow:null;
}
async function readPolicy(table:string,scope:string):Promise<RpcData>{
 const response=await fetch(ULTRA_NATIVE_TESTNET.rpc+"/v1/chain/get_table_rows",{
  method:"POST",headers:{"content-type":"application/json"},cache:"no-store",
  signal:AbortSignal.timeout(8000),
  body:JSON.stringify({code:CONTRACT,scope,table,json:true,limit:50})
 });
 if(!response.ok)throw new Error("Native policy table unavailable");
 const data=await response.json() as RpcData;
 if(!Array.isArray(data.rows)||data.more===true)
   throw new Error("Incomplete native fee policy table; preview blocked");
 return data;
}
function asShares(value:unknown){
 if(!Array.isArray(value))throw new Error("Factory beneficiary settings are missing or malformed");
 return value;
}
/**
 * Projected UOS distributions for an ACTUAL LISTED Uniq at a current testnet
 * policy snapshot. No historical sale, settlement proof, wallet ownership,
 * withdrawability, earnings credit, or transaction is established here.
 */
export async function GET(request:NextRequest){
 const q=request.nextUrl.searchParams;
 let tokenId:string,account:string,factoryId:string;
 try{
  tokenId=checkedUniqTokenId(q.get("tokenId"));
  account=checkedNativeAccount(q.get("account"));
  factoryId=checkedUniqFactoryId(q.get("factoryId"));
 }catch{
  return NextResponse.json({error:"Invalid native account, factory or Uniq token ID"},{status:400,headers:HEADERS});
 }
 try{
  const chain=await checkNativeMarketplaceChain();
  const sale=await nativeResaleRow(tokenId);
  if(!sale)return NextResponse.json({
   tokenId,factoryId,actualSaleVerified:false,earningsCredited:false,
   previewAvailable:false,reason:"No current resale.a listing. There is no sale price to project."
  },{headers:HEADERS});
  const seller=typeof sale.owner==="string"?checkedNativeAccount(sale.owner):null;
  if(!seller)throw new Error("Resale seller unavailable");
  const owned=await nativeOwnedToken(tokenId,seller);
  if(!owned||checkedUniqFactoryId(String(owned.token_factory_id))!==factoryId)
   throw new Error("Factory and seller-scoped token.b ownership do not match the listing");
  const factory=await nativeFactoryRow(factoryId);
  if(!factory)throw new Error("Factory.b record unavailable");
  const [globalTable,limitsTable]=await Promise.all([
   readPolicy("global.share",CONTRACT),
   readPolicy("saleshrlmcfg","1")
  ]);
  if(!globalTable.rows?.length||limitsTable.rows?.length!==1)
   throw new Error("Protocol share or promoter configuration is missing");
  const limits=object(limitsTable.rows[0]);
  if(!limits || typeof limits.promoter_payments_enabled!=="boolean")
   throw new Error("Promoter payment configuration is unavailable");
  const promoterBp=typeof sale.promoter_basis_point==="number"?
   sale.promoter_basis_point:Number(sale.promoter_basis_point);
  if(!Number.isSafeInteger(promoterBp))throw new Error("Invalid listed promoter fee");
  const scenario=estimateNativeResaleDistribution({
   price:sale.price,seller,factoryShares:asShares(factory.resale_shares),
   globalShares:globalTable.rows,promoterBasisPoints:promoterBp,
   promoterRecipient:typeof limits.default_promoter==="string"?limits.default_promoter:null,
   promoterPaymentsEnabled:limits.promoter_payments_enabled
  });
  const accountAllocations=scenario.allocations.filter(x=>x.receiver===account);
  const accountScenarioRawUos=accountAllocations.reduce((sum,x)=>
    sum+BigInt(x.rawUos),0n).toString();
  return NextResponse.json({
   ...chain,factoryId,tokenId,listingSeller:seller,
   observedAt:new Date().toISOString(),
   projectedDistribution:scenario,
   previewForAccount:{account,rawUos:accountScenarioRawUos,
    allocations:accountAllocations,nativeWalletControlVerified:false},
   promoterAssumption:"Current onchain default promoter was used. A future buyer can choose a different eligible promoter.",
   policySources:["eosio.nft.ft::factory.b","eosio.nft.ft::global.share",
     "eosio.nft.ft::saleshrlmcfg","eosio.nft.ft::resale.a","seller-scoped token.b"],
   nonAtomicSnapshot:true,actualSaleVerified:false,earningsCredited:false,
   payoutsVerified:false,withdrawalsEnabled:false,
   warning:"Hypothetical current listed-price distribution, NOT earned royalties or paid revenue. Factory/sale/policy were read in separate RPC calls and may change."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({
   error:"Resale policy, ownership or accurate UOS distribution unavailable; cannot estimate earnings",
   previewAvailable:false,earningsCredited:false
  },{status:503,headers:HEADERS});
 }
}
