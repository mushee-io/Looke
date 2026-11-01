import {NextResponse} from "next/server";
import {database} from "@/lib/server/database";
import {configuredPools} from "@/lib/server/trade-pool";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";

export const dynamic="force-dynamic";
/** Lists operator-configured sources and their bounded ingestion checkpoint. */
export async function GET() {
 try{
  const pools=configuredPools();
  const sql=database();
  const cursorKeys=pools.map(address=>"ultra-evm-testnet:pool:"+address);
  const rows=await sql`
   SELECT network,last_block::text AS last_block,last_block_hash,updated_at
   FROM looke_indexer_cursors
   WHERE network='ultra-evm-testnet' OR network=ANY(${cursorKeys})
  `;
  const cursor=new Map(rows.map(x=>[String(x.network),x]));
  let rpcStatus="unavailable",head:string|null=null,confirmedThrough:string|null=null;
  try{
   if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)rpcStatus="wrong_network";
   else{
    const h=await ultraClient.getBlockNumber();
    head=h.toString();confirmedThrough=(h>=12n?h-12n:0n).toString();
    rpcStatus="connected";
   }
  }catch{/* Do not invent live blocks on an RPC failure. */}
  const factory=cursor.get("ultra-evm-testnet");
  return NextResponse.json({
   network:"Ultra EVM Testnet",chainId:18881,confirmations:12,
   rpcStatus,head,confirmedThrough,
   factory:{
    configured:!!process.env.LOOKE_FACTORY_TESTNET_ADDRESS,
    indexedThrough:factory?.last_block??null,
    hasCheckpoint:!!factory?.last_block_hash,
    updatedAt:factory?.updated_at??null,
   },
   pools:pools.map(address=>{
    const row=cursor.get("ultra-evm-testnet:pool:"+address);
    return {address,indexedThrough:row?.last_block??null,
      hasCheckpoint:!!row?.last_block_hash,
      updatedAt:row?.updated_at??null};
   }),
   warnings:[
    "Operator configuration and indexed events are not independent audits of pool safety or token price.",
    "Source data is Ultra EVM testnet only, delayed by at least 12 blocks.",
   ],
   tradingEnabled:false,
  },{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Market-data index is unavailable",pools:[],
    tradingEnabled:false},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
