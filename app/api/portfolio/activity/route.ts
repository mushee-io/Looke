import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress,parseAbiItem} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {checkCursorContinuity} from "@/lib/market/indexer-guards.mjs";
import {checkedEvmWallet,configuredPortfolioTokens,confirmedActivityWindow,
 normalizePortfolioTransfer,orderedUniqueTransfers} from "@/lib/portfolio-guards.mjs";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store"};
const transfer=parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 value)");

/** Recent confirmed allowlisted ERC20 Transfers and independent factory launch events.
 * This is NOT complete wallet transaction history or a profit/loss report.
 */
export async function GET(request:NextRequest){
 let address:string,tokens:string[];
 try{
  address=checkedEvmWallet(request.nextUrl.searchParams.get("address"));
  tokens=configuredPortfolioTokens(process.env.LOOKE_PORTFOLIO_TOKEN_ALLOWLIST??"");
 }catch(e){return NextResponse.json({
  error:e instanceof Error?e.message:"Invalid portfolio activity request"
 },{status:400,headers:HEADERS});}
 try{
  if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
   return NextResponse.json({error:"Wrong Ultra EVM network"},{status:503,headers:HEADERS});
  const head=await ultraClient.getBlockNumber();
  const window=confirmedActivityWindow(head);
  if(!window)return NextResponse.json({
   network:"Ultra EVM Testnet",address,transfers:[],creatorEvents:[],
   activityStatus:"awaiting_confirmations",pnlAvailable:false,
   completeHistory:false,transferEnabled:false
  },{headers:HEADERS});
  const block=await ultraClient.getBlock({blockNumber:window.toBlock});
  if(!block.hash)throw Error("Missing confirmed block hash");
  const account=getAddress(address);
  // Every log is read from a configured token contract, bounded to 250 blocks.
  const queried=await Promise.all(tokens.map(async token=>{
   const source=getAddress(token);
   const code=await ultraClient.getCode({address:source,blockNumber:window.toBlock});
   if(!code||code==="0x")throw Error("Configured transfer source contract missing");
   const [incoming,outgoing]=await Promise.all([
    ultraClient.getLogs({address:source,event:transfer,args:{to:account},
     fromBlock:window.fromBlock,toBlock:window.toBlock}),
    ultraClient.getLogs({address:source,event:transfer,args:{from:account},
     fromBlock:window.fromBlock,toBlock:window.toBlock})
   ]);
   return [...incoming,...outgoing].map(e=>normalizePortfolioTransfer({
    token:source,from:e.args.from,to:e.args.to,value:e.args.value,
    txHash:e.transactionHash,blockNumber:e.blockNumber,logIndex:e.logIndex
   },address));
  }));
  const transfers=orderedUniqueTransfers(queried.flat(),40);

  // Creation events are separately indexed confirmation-delayed source events;
  // recording a creation does NOT establish current token balance/ownership.
  let creatorEvents:{
   txHash:string;blockNumber:string;coinAddress:string;kind:number;
  }[]=[];
  let creatorEventStatus="factory_not_configured";
  const configuredFactory=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  if(isAddress(configuredFactory)){
   try{
    const sql=database();
    const cursor=await sql`SELECT last_block,last_block_hash
      FROM looke_indexer_cursors WHERE network='ultra-evm-testnet' LIMIT 1`;
    const record=cursor[0];
    if(!record||!record.last_block_hash)
     creatorEventStatus="indexer_checkpoint_unavailable";
    else if(BigInt(record.last_block)>window.toBlock)
     creatorEventStatus="checkpoint_ahead_of_confirmed_chain";
    else{
     const at=await ultraClient.getBlock({blockNumber:BigInt(record.last_block)});
     const code=await ultraClient.getCode({
       address:getAddress(configuredFactory),blockNumber:BigInt(record.last_block)});
     if(!checkCursorContinuity(record.last_block_hash,at.hash)||!code||code==="0x")
      creatorEventStatus="checkpoint_or_factory_unverified";
     else{
      const launches=await sql`
        SELECT tx_hash,block_number::text AS block_number,coin_address,kind
        FROM looke_coin_events
        WHERE creator_address=${address} AND block_hash IS NOT NULL
          AND block_number<=${record.last_block}
        ORDER BY block_number DESC,log_index DESC LIMIT 20
      `;
      creatorEvents=launches.map(x=>({
       txHash:x.tx_hash,blockNumber:x.block_number,
       coinAddress:x.coin_address,kind:x.kind
      }));
      creatorEventStatus="confirmed_indexer_checkpoint_checked";
     }
    }
   }catch{
    creatorEventStatus="indexer_unavailable";
   }
  }
  const again=await ultraClient.getBlock({blockNumber:window.toBlock});
  if(again.hash!==block.hash)throw Error("Confirmed EVM block changed during history lookup");
  return NextResponse.json({
   network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,address:account,
   fromBlock:window.fromBlock.toString(),toBlock:window.toBlock.toString(),
   observedBlockHash:block.hash,confirmationDepth:12,
   scannedTokenContracts:tokens.length,
   transfers,creatorEvents,creatorEventStatus,
   transferHistoryStatus:tokens.length?"confirmed_logs_250_block_window":"no_erc20_sources_configured",
   completeHistory:false,nativeUosTransactionHistoryAvailable:false,
   realizedPnl:null,tokenPriceAvailable:false,transferEnabled:false,
   note:"Only curated ERC20 Transfer logs over the latest 250 confirmed blocks and checkpoint-checked factory creation events are shown. Not a full wallet history, USD PnL, UOS transfer list, verified current creator-coin holdings, or native Uniq sale history."
  },{headers:HEADERS});
 }catch{
  return NextResponse.json({error:"Confirmed Ultra EVM portfolio history is unavailable; no partial logs presented as complete",
    transfers:[],creatorEvents:[]},{status:503,headers:HEADERS});
 }
}
