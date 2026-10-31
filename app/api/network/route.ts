import { NextResponse } from "next/server";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
export const dynamic = "force-dynamic";

async function rpc(method: string) {
  const response = await fetch(ULTRA_EVM_TESTNET.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Ultra RPC returned an HTTP error");
  const payload = await response.json() as { result?: string; error?: unknown };
  if (typeof payload.result !== "string" || payload.error) throw new Error("Invalid Ultra RPC response");
  return payload.result;
}
export async function GET() {
  try {
    const chain = await rpc("eth_chainId");
    if (chain.toLowerCase() !== ULTRA_EVM_TESTNET.chainIdHex) {
      return NextResponse.json({ online: false, reason: "chain_id_mismatch" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const block = await rpc("eth_blockNumber");
    return NextResponse.json({ online: true, network: "Ultra EVM Testnet", chainId: ULTRA_EVM_TESTNET.chainId, blockNumber: Number.parseInt(block,16), explorer: ULTRA_EVM_TESTNET.explorer, tradingEnabled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ online: false, reason: "rpc_unavailable", tradingEnabled: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
