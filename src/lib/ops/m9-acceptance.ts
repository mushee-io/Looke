/**
 * M9 acceptance packet is diagnostic only. All external reviews, staging
 * protection and user-authorized transaction evidence must exist separately.
 * Merely submitting a JSON artifact cannot activate public beta.
 */
import type {RpcEvidence} from "./m8-probe";
import type {LiquidityReport} from "./m9-liquidity";
import type {DbAudit} from "./m8-db-audit";
import {releaseControlsFromEnv} from "./policy";

export type AcceptanceStage=
  "protectedStaging"|"evmRpc"|"nativeRpc"|"factoryReceipt"|"coinReceipt"|
  "uniqOwnership"|"reviewedLiquidity"|"socialDatabase"|"walletWitness"|
  "securityApproval"|"operatorApproval"|"rollbackDrill";
export const REQUIRED_M9_STAGES:readonly AcceptanceStage[]=[
  "protectedStaging","evmRpc","nativeRpc","factoryReceipt","coinReceipt",
  "uniqOwnership","reviewedLiquidity","socialDatabase","walletWitness",
  "securityApproval","operatorApproval","rollbackDrill",
] as const;
export type ReadinessEntry={stage:AcceptanceStage;status:"verified"|"blocked";reason:string};
export type AcceptancePacket={
  milestone:"M9";checkedAt:string;status:"ready-for-independent-review"|"blocked";
  publicBetaOpen:false;walletTransactions:0;stagingDeployed:false;
  items:ReadinessEntry[];missing:AcceptanceStage[];
};

export function createAcceptancePacket(params:{
  rpc:RpcEvidence|null;
  liquidity:LiquidityReport|null;
  db:DbAudit|null;
  stagingProtectionVerified:boolean;
  factoryReceiptVerified:boolean;coinReceiptVerified:boolean;uniqOwnershipVerified:boolean;
  walletWitnessVerified:boolean;securityApproved:boolean;operatorApproved:boolean;
  rollbackDrillPassed:boolean;
  flags?:Record<string,string|undefined>;
},now=new Date()):AcceptancePacket {
  const releaseSafe=releaseControlsFromEnv(params.flags??{});
  const checks:Record<AcceptanceStage,[boolean,string,string]>={
    protectedStaging:[params.stagingProtectionVerified,"Vercel Authentication and signed-out access verified on dedicated staging.",
      "No independently verified authenticated staging URL; Vercel project permission is blocked."],
    evmRpc:[params.rpc?.evm.status==="verified","Real Ultra EVM 18881 latest-head evidence recorded.","No fresh verified Ultra EVM RPC evidence."],
    nativeRpc:[params.rpc?.native.status==="verified","Real native Ultra Testnet irreversible ledger verified.","No verified native Testnet RPC evidence."],
    factoryReceipt:[params.factoryReceiptVerified,"Real factory deployment receipt independently checked.","No genuine factory deployment receipt and code proof."],
    coinReceipt:[params.coinReceiptVerified,"Genuine creator-coin deployment receipt checked.","No genuine wallet-authorized creator-coin receipt."],
    uniqOwnership:[params.uniqOwnershipVerified,"Real native Uniq token/factory ownership observed.","No real wallet-owned native Uniq proof."],
    reviewedLiquidity:[params.liquidity?.allVerified===true&&params.securityApproved,
      "Real funded pool(s) verified with independent code/security review.",
      "No fully verified, reviewed and funded Ultra V2 pair."],
    socialDatabase:[params.db?.status==="verified",
      "TLS-backed PostgreSQL 15+ and required social tables/indexes verified.",
      "No operationally audited staging PostgreSQL with TLS and schema."],
    walletWitness:[params.walletWitnessVerified,"Two-wallet read-only witness evidence independently reviewed.",
      "No independently verified real wallet/signature/native-extension acceptance."],
    securityApproval:[params.securityApproved,"Independent security review completed.","Independent security audit/approval missing."],
    operatorApproval:[params.operatorApproved,"Actual authorized operator approval supplied.","Operator release approval missing."],
    rollbackDrill:[params.rollbackDrillPassed&&releaseSafe.safe,
      "Safe local rollback rehearsal completed with all write/release flags disabled.",
      "Rollback rehearsal or closed-by-default flags not confirmed."],
  };
  const items=REQUIRED_M9_STAGES.map(stage=>({
    stage,status:checks[stage][0]?"verified" as const:"blocked" as const,
    reason:checks[stage][0]?checks[stage][1]:checks[stage][2],
  }));
  const missing=items.filter(x=>x.status==="blocked").map(x=>x.stage);
  return {milestone:"M9",checkedAt:now.toISOString(),
    status:missing.length?"blocked":"ready-for-independent-review",
    publicBetaOpen:false,walletTransactions:0,stagingDeployed:false,items,missing};
}
