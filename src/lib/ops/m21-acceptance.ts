/** Looke M21 acceptance evidence: fail closed on missing independent proofs.
 * This module never signs, sends, mints, claims or promotes a release.
 */
export const M21_GATES=[
 "previewDeploymentIdentity","signedOutProtection",
 "walletSessionWitness","walletIsolation",
 "mediaProviderInspection","mediaModerationAudit",
 "creatorEngagementModeration","pointsEvidenceReconciliation",
 "antiSybilIndependentReview","indexRecoveryWitness",
 "databaseTLSLeastPrivilege","databaseRestoreWitness",
 "ultraEvmReadOnlyHead","ultraNativeReadOnlyHead",
 "creatorCoinReceiptProof","nativeUniqOwnershipProof",
 "independentSecurityAudit","operatorReleaseAuthorization",
] as const;
export type M21GateId=typeof M21_GATES[number];
export type GateStatus="verified"|"blocked"|"not_checked";
export type M21Gate={id:M21GateId;status:GateStatus;reason:string;source?:string};
const doc=new Set<string>(M21_GATES);
export function gate(id:M21GateId,status:GateStatus,reason:string,source?:string):M21Gate{
 if(!doc.has(id)||!reason.trim())throw Error("Invalid acceptance gate evidence.");
 if(status==="verified" && (!source||source.trim().length<8))
  throw Error("Passing an acceptance gate requires independently identified evidence.");
 return {id,status,reason,...(source?{source}:{})};
}
export type M21Report={
 milestone:"M21";status:"blocked"|"awaiting-independent-security-review";
 generatedAt:string;required:number;verified:number;blocked:string[];
 checks:M21Gate[];publicBetaOpen:false;financialBroadcastEnabled:false;
 tokenClaimsEnabled:false;privateMessagingEnabled:false;transactionsSent:0;
 note:string;
};
export function assembleM21Report(checks:M21Gate[],now=new Date()):M21Report{
 if(!Number.isFinite(now.getTime()))throw Error("Invalid evidence observation timestamp.");
 const map=new Map(checks.map(c=>[c.id,c]));
 if(map.size!==M21_GATES.length||checks.length!==M21_GATES.length||
   M21_GATES.some(x=>!map.has(x)))throw Error("Every required gate must have one explicit status.");
 for(const c of checks)if(c.status==="verified" && (!c.source||c.source.trim().length<8))
  throw Error("Unproven verified gate rejected.");
 const blocked=checks.filter(c=>c.status!=="verified").map(c=>c.id);
 return {milestone:"M21",generatedAt:now.toISOString(),
   status:blocked.length?"blocked":"awaiting-independent-security-review",
   required:checks.length,verified:checks.length-blocked.length,blocked,checks,
   publicBetaOpen:false,financialBroadcastEnabled:false,tokenClaimsEnabled:false,
   privateMessagingEnabled:false,transactionsSent:0,
   note:"Passing isolated CI tests, an RPC head probe or database reachability is NOT a wallet witness, chain receipt, independent audit or beta authorization.",
 };
}
export function defaultM21Gates():M21Gate[]{
 return M21_GATES.map(id=>gate(id,"blocked","No independently verified operational acceptance evidence for this gate."));
}
export function replaceM21Gate(gates:M21Gate[],candidate:M21Gate):M21Gate[]{
 return gates.map(x=>x.id===candidate.id?candidate:x);
}
export function releaseFlagsClosed(flags:Record<string,string|undefined>):boolean{
 return [
  "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_M4_TRADING_ENABLED",
  "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
  "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED",
 ].every(name=>flags[name]!=="true");
}
