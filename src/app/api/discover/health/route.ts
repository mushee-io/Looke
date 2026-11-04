import {NextResponse} from "next/server";
import {collectLiveRpcEvidence} from "../../../../lib/ops/m8-probe";
import {indexCreatorLaunches,parseFactoryConfig} from "../../../../lib/ops/m13-index";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  const [rpc,index]=await Promise.all([
    collectLiveRpcEvidence(),indexCreatorLaunches(),
  ]);
  const status=index.status==="verified"&&rpc.evm.status==="verified"?"healthy":"degraded";
  return NextResponse.json({
    milestone:"M13",status,publicBetaOpen:false,transactionsSent:0,
    chainId:18881,observedAt:new Date().toISOString(),
    evmRpc:rpc.evm.status,
    factoryIndexer:{status:index.status,fromBlock:index.fromBlock,
      throughBlock:index.throughBlock,complete:index.complete,
      indexedLaunchesInCurrentPage:index.launches.length,
      nextCursor:index.nextCursor,errors:index.errors},
    note:"Read-only bounded finalized-chain evidence. Unconfigured factory is degraded, not success.",
  },{status:status==="healthy"?200:503,
    headers:{"cache-control":"no-store"}});
}
