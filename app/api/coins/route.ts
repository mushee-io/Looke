import { NextResponse } from "next/server";
import { database } from "@/lib/server/database";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
export const dynamic="force-dynamic";
export async function GET(){
  try {
    const coins=await database()`
      SELECT coin_address,creator_address,kind,metadata_uri,content_ref,supply_raw::text,
        tx_hash,block_number FROM looke_coin_events ORDER BY block_number DESC,log_index DESC LIMIT 40
    `;
    return NextResponse.json({network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,coins}, {headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Coin indexer database not configured",coins:[]},{status:503});}
}
