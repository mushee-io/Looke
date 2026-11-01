import {NextRequest,NextResponse} from "next/server";
import {getAddress,parseAbi} from "viem";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {checkedEvmWallet,configuredPortfolioTokens,checkedAssetRaw}
 from "@/lib/portfolio-guards.mjs";
export const dynamic="force-dynamic";
const ERC20=parseAbi([
 "function balanceOf(address owner) view returns (uint256)",
 "function decimals() view returns (uint8)",
 "function symbol() view returns (string)"
]);
const headers={"Cache-Control":"no-store"};
/** Read-only Ultra EVM 18881 balance snapshot; never produces a USD valuation. */
export async function GET(request:NextRequest){
 let address:string,tokens:string[];
 try{
  address=checkedEvmWallet(request.nextUrl.searchParams.get("address"));
  tokens=configuredPortfolioTokens(process.env.LOOKE_PORTFOLIO_TOKEN_ALLOWLIST??"");
 }catch(e){return NextResponse.json({
  error:e instanceof Error?e.message:"Invalid portfolio request"
 },{status:400,headers});}
 try{
  if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
   return NextResponse.json({error:"Wrong Ultra EVM RPC chain"},{status:503,headers});
  const height=await ultraClient.getBlockNumber();
  // A single pinned block prevents internally inconsistent balances and metadata.
  const block=await ultraClient.getBlock({blockNumber:height});
  if(!block.hash)throw Error("Missing block hash");
  const account=getAddress(address);
  const nativeBalance=await ultraClient.getBalance({address:account,blockNumber:height});
  const balances=await Promise.all(tokens.map(async value=>{
   const token=getAddress(value);
   const code=await ultraClient.getCode({address:token,blockNumber:height});
   if(!code||code==="0x")throw Error("Configured ERC-20 token not deployed");
   const [raw,decimals,symbol]=await Promise.all([
    ultraClient.readContract({address:token,abi:ERC20,functionName:"balanceOf",
      args:[account],blockNumber:height}),
    ultraClient.readContract({address:token,abi:ERC20,functionName:"decimals",
      blockNumber:height}),
    ultraClient.readContract({address:token,abi:ERC20,functionName:"symbol",
      blockNumber:height})
   ]);
   if(!Number.isSafeInteger(decimals)||decimals>36||typeof symbol!=="string"||
      !symbol.trim()||symbol.length>32||/[\u0000-\u001f]/.test(symbol))
    throw Error("Unsupported ERC-20 metadata");
   return {address:token,symbol,decimals,balanceRaw:checkedAssetRaw(raw),
    source:"ERC20.balanceOf at observed Ultra EVM testnet block",
    independentlyAudited:false};
  }));
  // Ensure the single-block snapshot did not change in the meantime.
  const confirmation=await ultraClient.getBlock({blockNumber:height});
  if(confirmation.hash!==block.hash)throw Error("Observed EVM block changed during reads");
  return NextResponse.json({
   network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,
   address:account,observedBlock:height.toString(),observedBlockHash:block.hash,
   native:{symbol:"UOS",decimals:18,balanceRaw:checkedAssetRaw(nativeBalance)},
   tokens:balances,tokenAllowlistConfigured:tokens.length>0,
   coverage:tokens.length?"only explicitly operator-curated ERC20 tokens":"no ERC20 token sources configured",
   tokenPriceAvailable:false,portfolioUsdValue:null,realizedPnl:null,
   walletControlVerified:false,transferEnabled:false,
   warning:"Balances are current testnet RPC observations, not independent token provenance, USD market value, verified trading PnL, or permission to spend."
  },{headers});
 }catch{return NextResponse.json({
  error:"Ultra EVM portfolio block or one configured token contract unavailable; no incomplete balance totals returned"
 },{status:503,headers});}
}
