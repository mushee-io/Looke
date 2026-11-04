export const M11_CHECKS=[
  "protectedVercelStaging",
  "ultraEvmReadOnlyRpc",
  "ultraNativeReadOnlyRpc",
  "creatorFactoryReceipt",
  "creatorCoinReceipt",
  "nativeUniqIssueReceipt",
  "nativeUniqOwnerLedger",
  "realBuySwapReceipt",
  "realSellSwapReceipt",
  "fundedReviewedV2Pool",
  "socialDatabaseTLSAndRole",
  "independentWalletWitness",
  "independentSecurityReview",
  "backupAndRestoreDrill",
  "operatorReleaseAuthorization",
  "rollbackSafety",
] as const;
export type M11CheckId=typeof M11_CHECKS[number];
export type M11Finding={id:M11CheckId;status:"verified"|"blocked";reason:string;source?:string};
export type M11Report={
  milestone:"M11";generatedAt:string;status:"blocked"|"awaiting-independent-review";
  publicBetaOpen:false;broadcastTransactions:0;
  required:number;verified:number;blocked:M11CheckId[];
  checks:M11Finding[];
  note:string;
};
export function m11Finding(id:M11CheckId,passed:boolean,pass:string,blocked:string,source?:string):M11Finding{
  return {id,status:passed?"verified":"blocked",reason:passed?pass:blocked,
    ...(source?{source}:{})};
}
export function createM11Report(findings:M11Finding[],now=new Date()):M11Report {
  const names=new Set(findings.map(x=>x.id));
  if(names.size!==findings.length||findings.length!==M11_CHECKS.length||
    M11_CHECKS.some(x=>!names.has(x))){
    throw new Error("M11 report must contain every unique independent release check.");
  }
  const blocked=findings.filter(x=>x.status!=="verified").map(x=>x.id);
  return {
    milestone:"M11",generatedAt:now.toISOString(),
    status:blocked.length?"blocked":"awaiting-independent-review",
    publicBetaOpen:false,broadcastTransactions:0,
    required:M11_CHECKS.length,verified:findings.length-blocked.length,
    blocked,checks:findings,
    note:"A verified technical check does not approve beta: human security/ops approvals, signed wallet acceptance and Vercel staging protection remain separate.",
  };
}
