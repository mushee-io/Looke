import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, parseAbiItem } from "viem";
import { database } from "@/lib/server/database";
import { ultraClient } from "@/lib/server/evm";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
export const dynamic="force-dynamic";
const event=parseAbiItem("event CoinCreated(address indexed coin,address indexed creator,uint8 indexed kind,bytes32 contentRef,uint256 supply,string metadataURI)");
// Authorized, bounded ingestion of *confirmed* testnet creation logs. No private keys, swaps or order execution.
export async function POST(request:NextRequest){
  const secret=process.env.LOOKE_INDEXER_SECRET;
  if(!secret || secret.length<24 || request.headers.get("authorization")!=="Bearer "+secret)
    return NextResponse.json({error:"Unauthorized"},{status:401});
  const factory=process.env.LOOKE_FACTORY_TESTNET_ADDRESS ?? "";
  const deployedFrom=process.env.LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK ?? "";
  if(!isAddress(factory) || !/^\d+$/.test(deployedFrom))
    return NextResponse.json({error:"Factory deployment not configured"},{status:503});
  try{
    if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
      return NextResponse.json({error:"Wrong RPC network"},{status:503});
    const sql=database();
    const cursor=await sql`SELECT last_block FROM looke_indexer_cursors WHERE network='ultra-evm-testnet'`;
    const first=cursor.length ? BigInt(cursor[0].last_block)+1n : BigInt(deployedFrom);
    const latest=await ultraClient.getBlockNumber();
    const finalized=latest>12n?latest-12n:0n;
    if(first>finalized) return NextResponse.json({indexed:0,fromBlock:first.toString(),toBlock:finalized.toString()});
    const toBlock=first+499n<finalized?first+499n:finalized;
    const logs=await ultraClient.getLogs({
      address:getAddress(factory),event,fromBlock:first,toBlock
    });
    for(const log of logs){
      if(!log.transactionHash || log.logIndex===null || !log.args.coin || !log.args.creator || log.args.kind===undefined || log.args.contentRef===undefined || log.args.supply===undefined || !log.args.metadataURI)continue;
      await sql`INSERT INTO looke_coin_events(
        tx_hash,log_index,coin_address,creator_address,kind,content_ref,supply_raw,metadata_uri,block_number
      ) VALUES(
        ${log.transactionHash},${log.logIndex},${log.args.coin.toLowerCase()},
        ${log.args.creator.toLowerCase()},${Number(log.args.kind)},${log.args.contentRef},
        ${log.args.supply.toString()},${log.args.metadataURI},${log.blockNumber.toString()}
      ) ON CONFLICT(tx_hash,log_index) DO NOTHING`;
    }
    await sql`INSERT INTO looke_indexer_cursors(network,last_block) VALUES('ultra-evm-testnet',${toBlock.toString()})
      ON CONFLICT(network) DO UPDATE SET last_block=greatest(looke_indexer_cursors.last_block,excluded.last_block),updated_at=now()`;
    return NextResponse.json({indexed:logs.length,fromBlock:first.toString(),toBlock:toBlock.toString(),confirmedThrough:finalized.toString()});
  }catch{return NextResponse.json({error:"Indexer failed; no cursor advanced after a failed batch"},{status:503});}
}
