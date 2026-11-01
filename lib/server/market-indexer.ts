import "server-only";
import {getAddress,isAddress,parseAbiItem} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {configuredPools} from "@/lib/server/trade-pool";
import {checkedBlockHash,checkedSwapAmounts,checkCursorContinuity,
 planConfirmedWindow} from "@/lib/market/indexer-guards.mjs";

const creation=parseAbiItem(
 "event CoinCreated(address indexed coin,address indexed creator,uint8 indexed kind,bytes32 contentRef,uint256 supply,string metadataURI)"
);
const swap=parseAbiItem(
 "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"
);
export class IndexingHalt extends Error {
 constructor(message:string,public status:number=503){super(message);}
}
type Stream={kind:"factory"|"swaps";address:`0x${string}`;startBlock:bigint;key:string};
function requiredStart(raw:string|undefined,label:string):bigint {
 if(!raw||!/^(0|[1-9][0-9]{0,17})$/.test(raw))
   throw new IndexingHalt(label+" start block is not configured");
 return BigInt(raw);
}
export function requestedStream(kind:string,requestedPool:string|null):Stream {
 if(kind==="coins"){
  const raw=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  if(!isAddress(raw))throw new IndexingHalt("Testnet factory not configured");
  return {kind:"factory",address:getAddress(raw),
   startBlock:requiredStart(process.env.LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK,"Factory"),
   key:"ultra-evm-testnet"};
 }
 if(kind==="swaps"){
  if(!requestedPool||!isAddress(requestedPool))
   throw new IndexingHalt("Provide an explicitly approved testnet pool",400);
  const allowed=configuredPools();
  if(!allowed.includes(requestedPool.toLowerCase()))
   throw new IndexingHalt("Pool not on the operator allowlist",403);
  return {kind:"swaps",address:getAddress(requestedPool),
   startBlock:requiredStart(process.env.LOOKE_MARKET_POOL_START_BLOCK,"Pool"),
   key:"ultra-evm-testnet:pool:"+requestedPool.toLowerCase()};
 }
 throw new IndexingHalt("Unsupported indexer stream",400);
}

/**
 * Single-stream, sequential, resumable 12-confirmation log ingestion.
 * - All event rows and the corresponding cursor checkpoint commit atomically.
 * - The previous cursor's block hash must still match the current RPC chain.
 * - Any mismatch/legacy cursor stops immediately for operator-led reconciliation.
 * - No wallet keys or trading commands are used.
 */
export async function syncConfirmedStream(stream:Stream) {
 const sql=database();
 const chain=await ultraClient.getChainId();
 if(chain!==ULTRA_EVM_TESTNET.chainId)throw new IndexingHalt("Wrong Ultra EVM chain");
 const head=await ultraClient.getBlockNumber();
 const finalized=head>=12n?head-12n:null;
 if(finalized===null || finalized<stream.startBlock)
  return {stream:stream.kind,processed:0,confirmedThrough:finalized?.toString()??null,status:"awaiting_confirmations"};

 const code=await ultraClient.getCode({address:stream.address,blockNumber:finalized});
 if(!code||code==="0x")throw new IndexingHalt("No contract code at confirmed block");

 const stored=await sql`
  SELECT last_block,last_block_hash FROM looke_indexer_cursors
  WHERE network=${stream.key} LIMIT 1
 `;
 const previous=stored[0]??null;
 const cursor=previous?BigInt(previous.last_block):null;
 if(cursor!==null){
  if(cursor<stream.startBlock-1n || cursor>finalized)
   throw new IndexingHalt("Cursor outside the configured confirmed stream; manual reconciliation required",409);
  if(!previous.last_block_hash)
   throw new IndexingHalt("Legacy indexer cursor has no block hash; reconcile historic events before resuming",409);
  const canonical=await ultraClient.getBlock({blockNumber:cursor});
  if(!checkCursorContinuity(previous.last_block_hash,canonical.hash))
   throw new IndexingHalt("Chain reorganization detected: ingestion paused for manual rollback/replay",409);
 }
 const window=planConfirmedWindow({lastBlock:cursor,startBlock:stream.startBlock,head});
 if(!window.ready||window.toBlock===null)
  return {stream:stream.kind,processed:0,confirmedThrough:window.confirmedThrough?.toString()??null,status:"caught_up"};
 const from=window.fromBlock,to=window.toBlock;
 const [rawLogs,checkpoint]=await Promise.all([
  stream.kind==="factory"
   ?ultraClient.getLogs({address:stream.address,event:creation,fromBlock:from,toBlock:to})
   :ultraClient.getLogs({address:stream.address,event:swap,fromBlock:from,toBlock:to}),
  ultraClient.getBlock({blockNumber:to})
 ]);
 if(!checkpoint.hash)throw new IndexingHalt("Missing canonical block hash");
 const checkpointHash=checkedBlockHash(checkpoint.hash);

 // Fail the entire batch on malformed records, rather than silently skipping logs.
 const factoryRecords: {
  txHash:string;logIndex:number;coin:string;creator:string;kind:number;
  reference:string;supply:string;metadata:string;block:string;hash:string;
 }[]=[];
 const swapRecords: {
  txHash:string;logIndex:number;block:string;hash:string;
  amount0In:string;amount1In:string;amount0Out:string;amount1Out:string;
 }[]=[];
 if(stream.kind==="factory"){
  for(const log of rawLogs as Awaited<ReturnType<typeof ultraClient.getLogs>>){
   // Parse and validate separately because malformed RPC payloads must never
   // be committed as supposedly confirmed records.
   const x=log as typeof log & {args?:Record<string,unknown>};
   const a=x.args??{};
   if(!x.transactionHash||x.logIndex==null||!x.blockHash||x.blockNumber==null||
      !isAddress(a.coin)||!isAddress(a.creator)||
      typeof a.kind!=="number"||!Number.isInteger(a.kind)||a.kind<0||a.kind>2||
      typeof a.contentRef!=="string"||!/^0x[0-9a-f]{64}$/i.test(a.contentRef)||
      typeof a.supply!=="bigint"||a.supply<=0n||
      typeof a.metadataURI!=="string"||!a.metadataURI.startsWith("ipfs://")||
      a.metadataURI.length>256)throw new IndexingHalt("Malformed factory event; batch not committed");
   factoryRecords.push({
    txHash:x.transactionHash,logIndex:x.logIndex,coin:getAddress(a.coin).toLowerCase(),
    creator:getAddress(a.creator).toLowerCase(),kind:a.kind,reference:a.contentRef,
    supply:a.supply.toString(),metadata:a.metadataURI,block:x.blockNumber.toString(),
    hash:checkedBlockHash(x.blockHash)
   });
  }
 }else{
  for(const log of rawLogs as Awaited<ReturnType<typeof ultraClient.getLogs>>){
   const x=log as typeof log & {args?:Record<string,unknown>};
   const a=x.args??{};
   if(!x.transactionHash||x.logIndex==null||!x.blockHash||x.blockNumber==null)
    throw new IndexingHalt("Malformed swap log; batch not committed");
   let amounts:string[];
   try{amounts=checkedSwapAmounts(a);}catch{
    throw new IndexingHalt("Malformed swap amounts; batch not committed");
   }
   swapRecords.push({txHash:x.transactionHash,logIndex:x.logIndex,block:x.blockNumber.toString(),
    hash:checkedBlockHash(x.blockHash),amount0In:amounts[0],amount1In:amounts[1],
    amount0Out:amounts[2],amount1Out:amounts[3]});
  }
 }
 // Ensure the chain tip for this batch did not change while events were read.
 const confirmedAgain=await ultraClient.getBlock({blockNumber:to});
 if(!checkCursorContinuity(checkpointHash,confirmedAgain.hash))
  throw new IndexingHalt("Batch block changed during RPC reads; no rows committed",409);

 const outcome=await sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(hashtext(${stream.key}))`;
  const current=await tx`SELECT last_block,last_block_hash FROM looke_indexer_cursors
    WHERE network=${stream.key} FOR UPDATE`;
  const cur=current[0]??null;
  // Compare-and-swap on cursor protects against overlapping cron runs.
  if(Boolean(cur)!==Boolean(previous) ||
     (cur&&previous&&(String(cur.last_block)!==String(previous.last_block)||
       cur.last_block_hash!==previous.last_block_hash)))
    return {status:"cursor_advanced_by_other_worker",processed:0};
  if(stream.kind==="factory"){
   for(const log of factoryRecords){
    await tx`INSERT INTO looke_coin_events(
      tx_hash,log_index,coin_address,creator_address,kind,content_ref,
      supply_raw,metadata_uri,block_number,block_hash
    ) VALUES(${log.txHash},${log.logIndex},${log.coin},${log.creator},${log.kind},
      ${log.reference},${log.supply},${log.metadata},${log.block},${log.hash})
    ON CONFLICT(tx_hash,log_index) DO NOTHING`;
   }
  }else{
   for(const log of swapRecords){
    await tx`INSERT INTO looke_market_swaps(
      pool_address,tx_hash,log_index,block_number,block_hash,
      amount0_in,amount1_in,amount0_out,amount1_out
    ) VALUES(${stream.address.toLowerCase()},${log.txHash},${log.logIndex},
      ${log.block},${log.hash},${log.amount0In},${log.amount1In},
      ${log.amount0Out},${log.amount1Out}) ON CONFLICT DO NOTHING`;
   }
  }
  await tx`INSERT INTO looke_indexer_cursors(network,last_block,last_block_hash)
    VALUES(${stream.key},${to.toString()},${checkpointHash})
    ON CONFLICT(network) DO UPDATE SET last_block=excluded.last_block,
      last_block_hash=excluded.last_block_hash,updated_at=now()`;
  return {status:"indexed",processed:stream.kind==="factory"?factoryRecords.length:swapRecords.length};
 });
 return {stream:stream.kind,pool:stream.kind==="swaps"?stream.address:undefined,
  fromBlock:from.toString(),toBlock:to.toString(),
  confirmedThrough:window.confirmedThrough?.toString()??null,
  indexed:outcome.processed,status:outcome.status};
}
