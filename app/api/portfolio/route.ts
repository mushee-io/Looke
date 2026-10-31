import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, formatEther } from "viem";
import { ultraClient } from "@/lib/server/evm";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
export const dynamic="force-dynamic";
/** Public wallet balance lookup. Read-only, no signing, no PnL or fictitious token values. */
export async function GET(request:NextRequest) {
 const address=request.nextUrl.searchParams.get("address")??"";
 if(!isAddress(address))return NextResponse.json({error:"Invalid EVM address"},{status:400});
 try {
   if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId) return NextResponse.json({error:"Wrong chain"},{status:503});
   const balance=await ultraClient.getBalance({address:getAddress(address)});
   const block=await ultraClient.getBlockNumber();
   return NextResponse.json({network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,address:getAddress(address),
     uosBalance:formatEther(balance),wei:balance.toString(),observedBlock:block.toString(),tokenPositions:[],nftHoldings:[],tradingEnabled:false},
     {headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Ultra EVM balance RPC unavailable"},{status:503});}
}
