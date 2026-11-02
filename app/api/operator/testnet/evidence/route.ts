import {NextRequest,NextResponse} from "next/server";
import {createPublicClient,getAddress,http,isAddress,parseAbiItem,toEventSelector,decodeEventLog} from "viem";
import {ultraClient,ultraTestChain} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {configuredPools} from "@/lib/server/trade-pool";
import {operatorAuthorized} from "@/lib/server/indexer-operations";
import {checkedEvidenceHash,checkedEvidenceAddress,checkedIndependentRpc,
 corroborateTestnetReceipt} from "@/lib/testnet-evidence.mjs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
const factoryEvent=parseAbiItem(
 "event CoinCreated(address indexed coin,address indexed creator,uint8 indexed kind,bytes32 contentRef,uint256 supply,string metadataURI)"
);
const swapEvent=parseAbiItem(
 "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"
);
type Kind="factory"|"swaps";
type Client=typeof ultraClient;
/** Fetch source-bound transaction evidence from one RPC with no write or signer. */
async function observe(client:Client,hash:`0x${string}`,source:`0x${string}`){
 const [chainId,head,tx,receipt]=await Promise.all([
  client.getChainId(),client.getBlockNumber(),
  client.getTransaction({hash}),client.getTransactionReceipt({hash})
 ]);
 const [block,code]=await Promise.all([
  client.getBlock({blockNumber:receipt.blockNumber}),
  client.getCode({address:source,blockNumber:receipt.blockNumber})
 ]);
 return {chainId,head,transaction:tx,receipt,block,code};
}
/**
 * Testnet-only operator evidence check. The two node URLs are SERVER config,
 * never supplied by the user. No writes, DB credits, wallet signature or claim.
 */
export async function GET(request:NextRequest){
 if(!operatorAuthorized(request,"LOOKE_INDEXER_MONITOR_SECRET"))
  return NextResponse.json({error:"Unauthorized"},{status:401,headers:HEADERS});
 const params=request.nextUrl.searchParams;
 let hash:`0x${string}`,source:`0x${string}`,from:string|null;
 let kind:Kind;
 const stream=params.get("stream")??"";
 try{
  kind=stream==="coins"?"factory":stream==="swaps"?"swaps":
   (()=>{throw new RangeError("Unsupported evidence stream")})();
  hash=checkedEvidenceHash(params.get("tx")) as `0x${string}`;
  from=params.get("from")?checkedEvidenceAddress(params.get("from")):null;
  const configured=kind==="factory"?process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"":
   params.get("pool")??"";
  if(!isAddress(configured))throw new RangeError("Source contract unavailable");
  if(kind==="swaps"&&!configuredPools().includes(configured.toLowerCase()))
   throw new RangeError("Source pool not approved for indexed testnet reads");
  if(kind==="factory"&&
     !/^(0|[1-9][0-9]{0,17})$/.test(process.env.LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK??""))
   throw new RangeError("Factory deployment block is not configured");
  source=getAddress(configured);
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Invalid evidence request",
   verified:false,executionEnabled:false},{status:400,headers:HEADERS});
 }
 let secondaryUrl:string;
 try{
  secondaryUrl=checkedIndependentRpc(
   process.env.LOOKE_INDEPENDENT_EVM_TESTNET_RPC,ULTRA_EVM_TESTNET.rpc);
 }catch{
  return NextResponse.json({error:"A distinct, operator-configured HTTPS Ultra EVM testnet RPC is required for corroboration",
   verified:false,executionEnabled:false},{status:503,headers:HEADERS});
 }
 try{
  const independent=createPublicClient({
   chain:ultraTestChain,transport:http(secondaryUrl,{timeout:8000,retryCount:0})
  });
  const [primary,secondary]=await Promise.all([
   observe(ultraClient,hash,source),
   observe(independent,hash,source)
  ]);
  const event=kind==="factory"?factoryEvent:swapEvent;
  const selector=toEventSelector(event);
  const verified=corroborateTestnetReceipt(primary,secondary,{
   kind,txHash:hash,source,eventSelector:selector,
   expectedFrom:from
  });
  const found=primary.receipt.logs.filter(log=>
   log.address.toLowerCase()===source.toLowerCase() &&
   log.topics[0]?.toLowerCase()===selector.toLowerCase());
  if(!found.length)throw Error("Expected event absent");
  const details=found.map(log=>{
   // Only decode events from the configured contract using the pinned ABI.
   const parsed=decodeEventLog({
    abi:[event],data:log.data,
    topics:log.topics as [`0x${string}`,...`0x${string}`[]],strict:true
   });
   if(kind==="factory"){
    if(parsed.eventName!=="CoinCreated"||
       typeof parsed.args.creator!=="string"||
       parsed.args.creator.toLowerCase()!==verified.transactionSigner)
     throw Error("Factory-created coin is not attributable to the transaction signer");
   }else{
    if(parsed.eventName!=="Swap")throw Error("Unexpected pool event ABI");
    const args=parsed.args;
    if([args.amount0In,args.amount1In,args.amount0Out,args.amount1Out]
      .every(amount=>amount===BigInt(0)))
     throw Error("Empty pool Swap event");
   }
   return {logIndex:log.logIndex,eventName:parsed.eventName};
  });
  return NextResponse.json({
   ...verified,source:getAddress(source),events:details,
   checkedAt:new Date().toISOString(),
   primarySource:"documented Ultra EVM testnet RPC",
   secondarySource:"operator-configured distinct-host testnet RPC",
   network:"Ultra EVM Testnet",verified:true,
   provenanceType:"dual_rpc_read_only_receipt_corroboration",
   financialActionAvailable:false,issuanceEnabled:false,
   tradingEnabled:false,claimsEnabled:false,
   caveat:"Matching RPC results do not prove node operator independence, trusted source-code deployment, post ownership, user authorization, security audit, token economics or finality beyond a 12-block observation."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({
   verified:false,executionEnabled:false,
   error:"Dual-RPC testnet receipt could not be corroborated. Investigate the transaction, event source, confirmations and node independence; no acceptance evidence issued."
  },{status:503,headers:HEADERS});
 }
}
