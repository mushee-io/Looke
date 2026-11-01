import {NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {database} from "@/lib/server/database";
import {ultraClient} from "@/lib/server/evm";
import {checkCursorContinuity} from "@/lib/market/indexer-guards.mjs";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";

export const dynamic="force-dynamic";
/** Show only event-derived coins behind a checked confirmed block checkpoint. */
export async function GET() {
 const base={network:"Ultra EVM Testnet",chainId:18881,coins:[] as unknown[],
   priceDataAvailable:false,independentContractAuditVerified:false,tradingEnabled:false};
 const factory=process.env.LOOKE_FACTORY_TESTNET_ADDRESS??"";
 if(!isAddress(factory))return NextResponse.json({...base,indexStatus:"factory_not_configured"},
   {headers:{"Cache-Control":"no-store"}});
 try{
  if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
   return NextResponse.json({...base,indexStatus:"wrong_rpc_chain"},{status:503});
  const sql=database();
  const rows=await sql`SELECT last_block,last_block_hash FROM looke_indexer_cursors
    WHERE network='ultra-evm-testnet' LIMIT 1`;
  const cursor=rows[0]??null;
  if(!cursor||!cursor.last_block_hash)
   return NextResponse.json({...base,indexStatus:cursor?"legacy_cursor_unverified":"awaiting_indexer"},
     {headers:{"Cache-Control":"no-store"}});
  const head=await ultraClient.getBlockNumber();
  const last=BigInt(cursor.last_block);
  if(head<12n||last>head-12n)
   return NextResponse.json({...base,indexStatus:"checkpoint_not_confirmed"},{status:503});
  const block=await ultraClient.getBlock({blockNumber:last});
  if(!checkCursorContinuity(cursor.last_block_hash,block.hash))
   return NextResponse.json({...base,indexStatus:"reorg_suspected_halted"},{status:503});
  const code=await ultraClient.getCode({address:getAddress(factory),blockNumber:last});
  if(!code||code==="0x")
   return NextResponse.json({...base,indexStatus:"configured_factory_not_deployed"},{status:503});
  const coins=await sql`
    SELECT coin_address,creator_address,kind,metadata_uri,content_ref,
      supply_raw::text,tx_hash,block_number::text,block_hash
    FROM looke_coin_events
    WHERE block_hash IS NOT NULL AND block_number<=${last.toString()}
    ORDER BY block_number DESC,log_index DESC LIMIT 40
  `;
  return NextResponse.json({...base,coins,indexStatus:"canonical_checkpoint_checked",
    indexedThrough:last.toString(),configuredFactory:getAddress(factory),
    note:"Event provenance at a confirmed testnet block does not prove factory audit or token safety."},
    {headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({...base,error:"Coin indexer database or RPC unavailable",
    indexStatus:"source_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
