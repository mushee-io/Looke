import {NextResponse} from "next/server";
import {ultraClient} from "@/lib/server/evm";
import {summarizeBetaReadiness} from "@/lib/beta-readiness.mjs";

export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"};

/**
 * Public READ-ONLY M22 beta gate. No operator secrets or environment values
 * are returned. RPC reachability is NOT proof of safety or final settlement.
 * This endpoint has no POST, signing or release-enabling code path.
 */
export async function GET(){
 let probe:null|{chainId:number;head:bigint}=null;
 try{
  const [chainId,head]=await Promise.all([
   ultraClient.getChainId(),
   ultraClient.getBlockNumber()
  ]);
  probe={chainId,head};
 }catch{/* A failed source observation is unavailable, never "ready". */}
 return NextResponse.json(summarizeBetaReadiness(probe),{headers:HEADERS});
}
