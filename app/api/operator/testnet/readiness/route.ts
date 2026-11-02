import {NextRequest,NextResponse} from "next/server";
import {operatorAuthorized} from "@/lib/server/indexer-operations";
import {acceptanceGate,checkedIndependentRpc} from "@/lib/testnet-evidence.mjs";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store"};
/** Immutable no-go until an independently audited, explicitly approved release process exists. */
export async function GET(request:NextRequest){
 if(!operatorAuthorized(request,"LOOKE_INDEXER_MONITOR_SECRET"))
  return NextResponse.json({error:"Unauthorized"},{status:401,headers:HEADERS});
 let secondaryConfigured=false;
 try{
  checkedIndependentRpc(process.env.LOOKE_INDEPENDENT_EVM_TESTNET_RPC,
   ULTRA_EVM_TESTNET.rpc);
  secondaryConfigured=true;
 }catch{/* missing distinct node must never be marked ready */}
 const gate=acceptanceGate();
 return NextResponse.json({
  network:"Ultra EVM Testnet",chainId:18881,
  ...gate,secondaryEvidenceRpcConfigured:secondaryConfigured,
  stagingDeploymentVerified:false,
  signedTestnetFactoryReceiptsRecorded:false,
  signedTestnetSwapReceiptsRecorded:false,
  nativeUniqTestnetReceiptsRecorded:false,
  knownFactoryAuthorizationIssue:"Old permissionless factory code allowed copied references. New source includes attested issuance, but no verified upgraded deployment, trusted attestor operations, independent audit or onchain proof of post authorship exists.",
  evidenceRoute:"/api/operator/testnet/evidence",
  warning:"No API response or RPC configuration can enable token issuance, signed swaps, NFT sales, reward distribution or mainnet release."
 },{status:503,headers:HEADERS});
}
