import type {DualRpcProof} from "./m10-crosscheck";
import type {StagingProtectionProof} from "./m10-protection";
import type {AcceptancePacket} from "./m9-acceptance";
import type {DbAudit} from "./m8-db-audit";
import type {LiquidityReport} from "./m9-liquidity";
import type {RpcEvidence} from "./m8-probe";

export type M10Review={
  milestone:"M10";createdAt:string;
  publicBetaOpen:false;submittedTransactions:0;
  status:"blocked"|"awaiting-human-review";
  gates:Array<{id:string;state:"verified"|"blocked";details:string}>;
  blocked:string[];
  manualReviewRequired:true;
};
export function createM10Review(params:{
  singleRpc:RpcEvidence;dualRpc:DualRpcProof;
  staging:StagingProtectionProof;liquidity:LiquidityReport;
  socialDatabase:DbAudit|null;priorPacket:AcceptancePacket;
},now=new Date()):M10Review {
  const gate=(id:string,ok:boolean,details:string)=>({
    id,state:ok?"verified" as const:"blocked" as const,details,
  });
  const results=[
    gate("evmSingleSource",params.singleRpc.evm.status==="verified",
      "Current chain ID/head response from one Ultra EVM RPC; does not prove independent agreement."),
    gate("nativeSingleSource",params.singleRpc.native.status==="verified",
      "Current native Ultra chain/head response from one RPC; does not prove independent agreement."),
    gate("evmIndependent",params.dualRpc.evm.status==="verified",
      "Two distinct providers must agree on the same canonical Ultra EVM block hash."),
    gate("nativeIndependent",params.dualRpc.native.status==="verified",
      "Two distinct native providers must agree on the same irreversible block ID."),
    gate("protectedDeployment",params.staging.status==="verified"&&
      params.staging.signedOutChallengeVerified,
      "Vercel all-URL protection, repo, pinned Preview deployment and signed-out challenge."),
    gate("twoSidedLiquidity",params.liquidity.allVerified,
      "Actual bytecode and nonzero V2 pool reserves; security review still separate."),
    gate("socialPostgresTLS",params.socialDatabase?.status==="verified",
      "Read-only PostgreSQL15+, TLS and full social table/index inspection."),
    ...params.priorPacket.items.map(item=>
      gate(item.stage,item.status==="verified",item.reason)),
  ];
  const blocked=results.filter(x=>x.state==="blocked").map(x=>x.id);
  return {
    milestone:"M10",createdAt:now.toISOString(),
    status:blocked.length?"blocked":"awaiting-human-review",
    publicBetaOpen:false,submittedTransactions:0,gates:results,
    blocked,manualReviewRequired:true,
  };
}
