import { NextResponse } from "next/server";
import { ULTRA_NATIVE_TESTNET } from "@/lib/ultra";

export const dynamic = "force-dynamic";

/** Read-only chain identity check, no private credentials or wallet requests. */
export async function GET() {
  try {
    const response = await fetch(ULTRA_NATIVE_TESTNET.rpc + "/v1/chain/get_info", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Native RPC returned an error");
    const info = await response.json() as { chain_id?: unknown; head_block_num?: unknown };
    if (info.chain_id !== ULTRA_NATIVE_TESTNET.chainId) {
      return NextResponse.json({online:false,error:"Unexpected native chain identity"},{status:502,headers:{"Cache-Control":"no-store"}});
    }
    if (typeof info.head_block_num !== "number" || !Number.isSafeInteger(info.head_block_num) || info.head_block_num < 0)
      return NextResponse.json({online:false,error:"Native RPC returned invalid block data"},{status:502,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({
      online:true, network:"Ultra Native Testnet",
      chainId:ULTRA_NATIVE_TESTNET.chainId,
      headBlock:info.head_block_num,
      checkedAt:new Date().toISOString(),
    }, {headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({online:false,error:"Native testnet RPC unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
