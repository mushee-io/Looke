import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress, parseAbi } from "viem";
import { ultraClient } from "@/lib/server/evm";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
import { quoteExactIn, minOutput } from "@/lib/market/quote.mjs";
export const dynamic="force-dynamic";
const POOL_ABI=parseAbi([
 "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
 "function token0() view returns (address)",
 "function token1() view returns (address)"
]);

/** Read-only quote for a separately verified, configured V2-compatible testnet pool. */
export async function GET(request:NextRequest) {
  const pool=request.nextUrl.searchParams.get("pool")??"";
  const inputToken=request.nextUrl.searchParams.get("tokenIn")??"";
  const amountRaw=request.nextUrl.searchParams.get("amountIn")??"";
  const slipRaw=request.nextUrl.searchParams.get("slippageBps")??"50";
  const feeRaw=process.env.LOOKE_POOL_FEE_BPS??"30";
  const listed=(process.env.LOOKE_ALLOWED_TESTNET_POOLS??"")
    .split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!listed.length) return NextResponse.json({error:"No independently verified trading pools configured; trading is disabled"},{status:503});
  if(!isAddress(pool)||!isAddress(inputToken)||!listed.includes(pool.toLowerCase())||!/^[1-9]\d{0,75}$/.test(amountRaw))
    return NextResponse.json({error:"Invalid or unapproved quote request"},{status:400});
  const slippageBps=Number(slipRaw),feeBps=Number(feeRaw);
  if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>2000||!Number.isInteger(feeBps)||feeBps<0||feeBps>1000)
    return NextResponse.json({error:"Fee or slippage outside allowed limits"},{status:400});
  try{
    if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
      return NextResponse.json({error:"Wrong chain"},{status:503});
    const address=getAddress(pool);
    const code=await ultraClient.getCode({address});
    if(!code||code==="0x")return NextResponse.json({error:"Pool has no deployed code"},{status:422});
    const blockNumber=await ultraClient.getBlockNumber();
    const [token0,token1,reserves]=await Promise.all([
      ultraClient.readContract({address,abi:POOL_ABI,functionName:"token0",blockNumber}),
      ultraClient.readContract({address,abi:POOL_ABI,functionName:"token1",blockNumber}),
      ultraClient.readContract({address,abi:POOL_ABI,functionName:"getReserves",blockNumber})
    ]);
    const inAddress=getAddress(inputToken);
    if(inAddress.toLowerCase()!==token0.toLowerCase()&&inAddress.toLowerCase()!==token1.toLowerCase())
      return NextResponse.json({error:"Input token is not a member of this pool"},{status:400});
    const is0=inAddress.toLowerCase()===token0.toLowerCase();
    const reserveIn=is0?reserves[0]:reserves[1];
    const reserveOut=is0?reserves[1]:reserves[0];
    const amount=BigInt(amountRaw);
    if(reserveIn<=0n||reserveOut<=0n)return NextResponse.json({error:"Pool is empty"},{status:422});
    // Share the test-covered preflight with other callers; fail closed on zero minimum output.
    const expected=quoteExactIn(amount,reserveIn,reserveOut,feeBps);
    const minOut=minOutput(expected,slippageBps);
    return NextResponse.json({
      network:"Ultra EVM Testnet",chainId:18881,pool:address,tokenIn:inAddress,
      tokenOut:is0?token1:token0,amountIn:amount.toString(),
      expectedOut:expected.toString(),minOut:minOut.toString(),
      feeBps,slippageBps,observedBlock:blockNumber.toString(),
      expiresAt:new Date(Date.now()+15000).toISOString(),
      executable:false,tradeEnabled:false,warning:"Read-only indicative quote. No swap or settlement available."
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(error instanceof RangeError)
      return NextResponse.json({error:"Quote too small or non-executable"},{status:422});
    return NextResponse.json({error:"Pool preflight failed; quote unavailable"},{status:503});
  }
}
