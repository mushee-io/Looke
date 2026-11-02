import {NextRequest,NextResponse} from "next/server";
import {isAddress} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {configuredPools} from "@/lib/server/trade-pool";
import {operatorAuthorized} from "@/lib/server/indexer-operations";
import {checkCursorContinuity} from "@/lib/market/indexer-guards.mjs";
import {inspectIndexerStream} from "@/lib/indexer-operations.mjs";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
/**
 * Private operator health. No secrets, SQL data, wallet records or raw error
 * traces returned. A status 503 is an alert, NOT a reorg recovery instruction.
 */
export async function GET(request:NextRequest){
 if(!operatorAuthorized(request,"LOOKE_INDEXER_MONITOR_SECRET"))
  return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 try{
  const pools=configuredPools();
  const factory=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
  const sources=[
   {key:"ultra-evm-testnet",name:"factory",address:factory,
    start:process.env.LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK},
   ...pools.map(address=>({key:"ultra-evm-testnet:pool:"+address,
    name:"pool",address,start:process.env.LOOKE_MARKET_POOL_START_BLOCK}))
  ];
  const sql=database();
  const names=sources.map(s=>s.key);
  const [cursors,heartbeats]=await Promise.all([
   sql`SELECT network,last_block::text AS last_block,last_block_hash,updated_at
     FROM looke_indexer_cursors WHERE network=ANY(${names})`,
   sql`SELECT stream_key,last_status,last_error_code,last_attempt_at,
     last_success_at,consecutive_failures,last_indexed_count,
     last_confirmed_block::text AS last_confirmed_block
     FROM looke_indexer_operations WHERE stream_key=ANY(${names})`
  ]);
  const byKey=new Map(cursors.map(x=>[String(x.network),x]));
  const byHeartbeat=new Map(heartbeats.map(x=>[String(x.stream_key),x]));
  let chainStatus="unavailable",head:bigint|null=null;
  try{
   if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
    chainStatus="wrong_chain";
   else{
    head=await ultraClient.getBlockNumber();
    chainStatus="connected";
   }
  }catch{/* No fabricated head or status */}
  const now=new Date();
  const results=await Promise.all(sources.map(async source=>{
   const row=byKey.get(source.key),beat=byHeartbeat.get(source.key);
   let canonicalMatch:boolean|null=null;
   if(row?.last_block_hash && head!==null && BigInt(row.last_block)<=head){
    try{
     const block=await ultraClient.getBlock({blockNumber:BigInt(row.last_block)});
     canonicalMatch=checkCursorContinuity(row.last_block_hash,block.hash);
    }catch{/* RPC unavailable: unknown canonicality != verified mismatch */}
   }
   const start=source.start && /^(0|[1-9]\d{0,17})$/.test(source.start)?
    source.start:null;
   const checked=inspectIndexerStream({
    configured:isAddress(source.address),startBlock:start,head,
    cursor:row?{lastBlock:row.last_block,lastBlockHash:row.last_block_hash}:null,
    heartbeat:beat?{
     lastStatus:beat.last_status,lastErrorCode:beat.last_error_code,
     lastAttemptAt:beat.last_attempt_at
    }:null,
    canonicalMatch,now
   });
   return {
    kind:source.name,addressConfigured:isAddress(source.address),
    indexedThrough:row?.last_block??null,checkpointPresent:!!row?.last_block_hash,
    updatedAt:row?.updated_at??null,workerLastAttempt:beat?.last_attempt_at??null,
    workerLastSuccess:beat?.last_success_at??null,
    consecutiveFailures:beat?.consecutive_failures??null,
    lastIndexedCount:beat?.last_indexed_count??null,
    ...checked
   };
  }));
  const ready=chainStatus==="connected"&&sources.length>0&&
   results.every(s=>s.ready);
  return NextResponse.json({
   network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,
   rpcStatus:chainStatus,head:head?.toString()??null,
   confirmedFrontier:head!==null&&head>=12n?(head-12n).toString():null,
   ready,streams:results,tradeEnabled:false,
   note:"Private operational diagnostics, not an independent contract audit or an instruction to rewrite halted indexer cursors."
  },{status:ready?200:503,headers});
 }catch{
  return NextResponse.json({error:"Indexer operational diagnostics unavailable",
   ready:false,tradeEnabled:false},{status:503,headers});
 }
}
