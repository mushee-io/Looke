import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress,parseAbi,zeroAddress} from "viem";
import {database} from "@/lib/server/database";
import {configuredPools} from "@/lib/server/trade-pool";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {checkCursorContinuity,swapDirection} from "@/lib/market/indexer-guards.mjs";

export const dynamic="force-dynamic";
const POOL=parseAbi([
 "function getReserves() view returns (uint112 reserve0,uint112 reserve1,uint32 blockTimestampLast)",
 "function token0() view returns (address)",
 "function token1() view returns (address)"
]);
const TOKEN=parseAbi([
 "function symbol() view returns (string)",
 "function decimals() view returns (uint8)"
]);
/**
 * Read-only pair snapshot and previously ingested real Swap events.
 * Never computes fiat values/TVL/market cap from a raw AMM reserve ratio.
 */
export async function GET(request:NextRequest){
 const raw=request.nextUrl.searchParams.get("pool")??"";
 try{
  const allowed=configuredPools();
  if(!allowed.length)return NextResponse.json({error:"No approved testnet market sources configured"},{status:503});
  if(!isAddress(raw)||!allowed.includes(raw.toLowerCase()))
   return NextResponse.json({error:"Pool not on the operator allowlist"},{status:400});
  const pool=getAddress(raw);
  if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
   return NextResponse.json({error:"Wrong Ultra EVM chain"},{status:503});
  const blockNumber=await ultraClient.getBlockNumber();
  const [code,block,token0,token1,reserves]=await Promise.all([
   ultraClient.getCode({address:pool,blockNumber}),
   ultraClient.getBlock({blockNumber}),
   ultraClient.readContract({address:pool,abi:POOL,functionName:"token0",blockNumber}),
   ultraClient.readContract({address:pool,abi:POOL,functionName:"token1",blockNumber}),
   ultraClient.readContract({address:pool,abi:POOL,functionName:"getReserves",blockNumber})
  ]);
  if(!code||code==="0x"||token0===zeroAddress||token1===zeroAddress||
    token0.toLowerCase()===token1.toLowerCase())
    return NextResponse.json({error:"Configured pool has no valid V2-compatible contract"},{status:422});
  const [symbol0,symbol1,decimals0,decimals1]=await Promise.all([
   ultraClient.readContract({address:token0,abi:TOKEN,functionName:"symbol",blockNumber}),
   ultraClient.readContract({address:token1,abi:TOKEN,functionName:"symbol",blockNumber}),
   ultraClient.readContract({address:token0,abi:TOKEN,functionName:"decimals",blockNumber}),
   ultraClient.readContract({address:token1,abi:TOKEN,functionName:"decimals",blockNumber})
  ]);
  if(symbol0.length>32||symbol1.length>32||decimals0>36||decimals1>36)
   return NextResponse.json({error:"Unsupported token metadata"},{status:422});
  const MOD=2n**32n;
  const reserveAge=Number(((block.timestamp%MOD)-BigInt(reserves[2])+MOD)%MOD);
  const sql=database();
  const index=await sql`
    SELECT last_block,last_block_hash,updated_at FROM looke_indexer_cursors
    WHERE network=${"ultra-evm-testnet:pool:"+pool.toLowerCase()} LIMIT 1
  `;
  const cursor=index[0]??null;
  let historyStatus="not_indexed";
  let history:{tx_hash:string;block_number:string;log_index:number;block_hash:string;
      amount0_in:string;amount1_in:string;amount0_out:string;amount1_out:string;
      direction:string}[]=[];
  if(cursor){
   if(!cursor.last_block_hash)historyStatus="legacy_checkpoint_unverified";
   else if(BigInt(cursor.last_block)>blockNumber)historyStatus="checkpoint_ahead_of_chain";
   else{
    const at=await ultraClient.getBlock({blockNumber:BigInt(cursor.last_block)});
    if(!checkCursorContinuity(cursor.last_block_hash,at.hash))
      historyStatus="reorg_suspected_halted";
    else{
     historyStatus="confirmed_indexed_events";
     const logs=await sql`
       SELECT tx_hash,block_number::text AS block_number,log_index,block_hash,
         amount0_in::text AS amount0_in,amount1_in::text AS amount1_in,
         amount0_out::text AS amount0_out,amount1_out::text AS amount1_out
       FROM looke_market_swaps WHERE pool_address=${pool.toLowerCase()}
         AND block_number<=${cursor.last_block}
       ORDER BY block_number DESC,log_index DESC LIMIT 30
     `;
     history=logs.map(log=>({
       tx_hash:log.tx_hash,block_number:log.block_number,
       log_index:log.log_index,block_hash:log.block_hash,
       amount0_in:log.amount0_in,amount1_in:log.amount1_in,
       amount0_out:log.amount0_out,amount1_out:log.amount1_out,
       direction:swapDirection({
        amount0In:log.amount0_in,amount1In:log.amount1_in,
        amount0Out:log.amount0_out,amount1Out:log.amount1_out
       })
     }));
    }
   }
  }
  return NextResponse.json({
   network:"Ultra EVM Testnet",chainId:18881,observedBlock:blockNumber.toString(),
   observedBlockHash:block.hash,pool,
   token0:{address:token0,symbol:symbol0,decimals:decimals0,reserveRaw:reserves[0].toString()},
   token1:{address:token1,symbol:symbol1,decimals:decimals1,reserveRaw:reserves[1].toString()},
   reserveAgeSeconds:reserveAge,reservesFresh:reserveAge<=3600,
   lastIndexedBlock:cursor?String(cursor.last_block):null,
   historyStatus,swaps:history,historyLimitedTo:30,
   warning:"Unverified operator-configured V2-shaped Ultra testnet market. Reserves are not fiat liquidity, USD TVL, pricing accuracy, token safety, or executable offers.",
   tradingEnabled:false,
  },{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Current market read or canonical history verification unavailable",
   tradingEnabled:false},{status:503,headers:{"Cache-Control":"no-store"}});}
}
