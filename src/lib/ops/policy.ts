/**
 * M7 operator safety checks. Pure functions so CI can assert that
 * wrong-chain, stale, incomplete or simulated evidence never counts as healthy.
 */
export const EXPECTED_EVM_CHAIN = 18881;
export const MAX_EVM_BLOCK_AGE_SECONDS = 1200;
export const MAX_NATIVE_IRREVERSIBLE_LAG = 1200;

export type CheckState = "pass" | "fail";
export type OperatorCheck = {
  id:"evm"|"native"|"database"|"release";
  status:CheckState;
  reason:string;
  checkedAt:string;
};
export type OperatorHealth = {
  service:"looke-m7";
  status:"healthy"|"degraded";
  beta:"closed"|"gated";
  checkedAt:string;
  checks:OperatorCheck[];
};
export function validateEvmHead(
  chainId:number,blockTimestamp:number,nowSeconds:number,
):{ok:boolean;reason:string} {
  if(chainId!==EXPECTED_EVM_CHAIN)return {ok:false,reason:"EVM RPC is not Ultra EVM Testnet 18881."};
  if(!Number.isFinite(blockTimestamp)||!Number.isFinite(nowSeconds) ||
     !Number.isSafeInteger(blockTimestamp)||blockTimestamp<=0) {
    return {ok:false,reason:"EVM block timestamp is invalid."};
  }
  const age=nowSeconds-blockTimestamp;
  if(age< -120 || age>MAX_EVM_BLOCK_AGE_SECONDS){
    return {ok:false,reason:"EVM block is stale or has an invalid future timestamp."};
  }
  return {ok:true,reason:"EVM chain 18881 and a recent canonical head block verified."};
}

export function validateNativeHead(
  chainId:string,expectedChainId:string,head:number,irreversible:number,
):{ok:boolean;reason:string} {
  if(chainId!==expectedChainId)return {ok:false,reason:"Native Ultra chain ID mismatch."};
  if(!Number.isSafeInteger(head)||!Number.isSafeInteger(irreversible) ||
     irreversible<=0||head<irreversible ||
     head-irreversible>MAX_NATIVE_IRREVERSIBLE_LAG) {
    return {ok:false,reason:"Native chain head or last irreversible block is invalid or lagging."};
  }
  return {ok:true,reason:"Native Ultra Testnet chain ID and irreversible head confirmed."};
}

export function releaseControlsFromEnv(env:Record<string,string|undefined>):{
  safe:boolean;violations:string[];
} {
  const restricted=[
    "LOOKE_PUBLIC_BETA_ENABLED",
    "LOOKE_M4_TRADING_ENABLED",
    "LOOKE_SOCIAL_WRITES_ENABLED",
    "LOOKE_M6_EVIDENCE_ENABLED",
  ] as const;
  const violations=restricted.filter(name=>env[name]==="true");
  return {safe:violations.length===0,violations:[...violations]};
}

export function makeHealth(checks:OperatorCheck[],publicFlag:boolean,now=new Date()):OperatorHealth {
  const ids=["evm","native","database","release"] as const;
  const present=new Set(checks.map(x=>x.id));
  const duplicates=present.size!==checks.length;
  const healthy=!duplicates&&ids.every(id=>checks.some(x=>x.id===id&&x.status==="pass"));
  return {
    service:"looke-m7",
    status:healthy?"healthy":"degraded",
    beta:publicFlag?"gated":"closed",
    checkedAt:now.toISOString(),
    checks,
  };
}
export function rollbackEnvironment(){
  return {
    LOOKE_PUBLIC_BETA_ENABLED:"false",
    LOOKE_M4_TRADING_ENABLED:"false",
    LOOKE_SOCIAL_WRITES_ENABLED:"false",
    LOOKE_M6_EVIDENCE_ENABLED:"false",
  } as const;
}
