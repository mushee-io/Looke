import {z} from "zod";
import {verifyMessage} from "viem";
import {createHash} from "node:crypto";
import {address,uuid} from "../social/validation";
import {tables,compareFullDatabase,digestFullDatabase,type FullTableDigest} from "./m24-full-restore";
import type {PoolClient} from "pg";

export const completeTables=[...tables,["social_beta_release_reviews","id"]] as const;
export const m26Decision=z.object({
 action:z.literal("record_witness"),
 reviewId:uuid,
 role:z.enum(["independent_security","independent_operator"]),
 witnessWallet:address,
 decision:z.enum(["hold","reference_acknowledged_unverified"]),
 observedAt:z.string().datetime({offset:true}),
 signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export type M26Decision=z.infer<typeof m26Decision>;
export function witnessWritesEnabled(){return process.env.LOOKE_M26_WITNESS_WRITES_ENABLED==="true";}
export function witnessMessage(x:Pick<M26Decision,"reviewId"|"role"|"witnessWallet"|"decision"|"observedAt">,
  context:{origin:string;sha:string;evidenceSha:string;gate:string}){
 if(!/^[a-f0-9]{40}$/.test(context.sha)||!/^[a-f0-9]{64}$/.test(context.evidenceSha))
  throw Error("Immutable commit and existing artifact SHA-256 required.");
 return [
 "Looke M26 independent release evidence-reference acknowledgment",
 "Protected Preview Origin: "+context.origin,
 "Protected Preview Commit: "+context.sha,
 "Existing M25 Review: "+x.reviewId,
 "Existing Source Evidence SHA-256: "+context.evidenceSha,
 "Release Gate: "+context.gate,
 "Witness Role: "+x.role,
 "Witness Wallet: "+x.witnessWallet,
 "Decision: "+x.decision,
 "Observed At: "+x.observedAt,
 "Signature confirms a public reference ACKNOWLEDGEMENT ONLY, not review of its contents or independent human identity.",
 "NO beta launch, user postings, Points issuance, token claims, financial broadcasting or production deployment.",
 ].join("\n");
}
export function allowedWitness(x:M26Decision,operator:string,originalReviewer:string,evidenceSigner:string){
 const env=x.role==="independent_security"?"LOOKE_M26_SECURITY_WITNESSES":"LOOKE_M26_OPERATOR_WITNESSES";
 const allow=(process.env[env]||"").split(",").map(z=>z.trim().toLowerCase()).filter(Boolean);
 const w=x.witnessWallet.toLowerCase();
 return allow.includes(w)&&w!==operator.toLowerCase()&&w!==originalReviewer.toLowerCase()&&w!==evidenceSigner.toLowerCase();
}
export async function verifyWitness(x:M26Decision,context:{
 origin:string;sha:string;evidenceSha:string;gate:string;now?:Date;
 operator:string;originalReviewer:string;evidenceSigner:string;
}){
 if(!allowedWitness(x,context.operator,context.originalReviewer,context.evidenceSigner))
  return {valid:false,reason:"Different externally allowlisted role and witness required."};
 const now=(context.now??new Date()).getTime(),ts=Date.parse(x.observedAt);
 if(!Number.isFinite(ts)||ts>now||now-ts>300000)
  return {valid:false,reason:"Witness reference must have fresh five-minute signature."};
 const valid=await verifyMessage({address:x.witnessWallet as `0x${string}`,
  signature:x.signature as `0x${string}`,message:witnessMessage(x,context)});
 return {valid,reason:valid?"Public reference signature checked only; operational acceptance unverified.":"Forged or mismatched signed reference."};
}
export function signatureHash(signature:string){return createHash("sha256").update(signature.toLowerCase()).digest("hex");}
export async function digestAllM26Tables(c:Pick<PoolClient,"query">,enforceTLS=false){
 return digestFullDatabase(c,{tableSpec:completeTables,pageSize:100,maxRowsPerTable:100000,enforceTLS});
}
export function compareAllM26Tables(a:FullTableDigest[],b:FullTableDigest[]){
 return compareFullDatabase(a,b,completeTables);
}
export function strictFinalDecision(input:{m25Decision:string;flagsClosed:boolean;
 witnesses:{role:string;witness_wallet:string}[];
 digestMatched:boolean;sourceEvidenceVerified:boolean;operatorAuthorized:boolean;
 twoIndependentHumansObserved:boolean;providerAuthenticated:boolean}){
 const distinct=new Set(input.witnesses.map(w=>w.witness_wallet.toLowerCase())).size;
 return {milestone:"M26" as const,decision:"NO_GO" as const,publicBetaOpen:false as const,
  transactionsSent:0 as const,productionPromotionAllowed:false as const,
  financialActionsAllowed:false as const,privateMessagesAllowed:false as const,
  pointsClaimsAllowed:false as const,socialMediaWritesAllowed:false as const,
  sourceM25Decision:input.m25Decision,flagsClosed:input.flagsClosed,
  distinctPublicSignerKeys:distinct,
  dualRoleReferenceSignaturesPresent:new Set(input.witnesses.map(w=>w.role)).size===2&&distinct>=2,
  independentlyVerifiedHumanApproval:false as const,
  independentRestoreAcceptance:false as const,
  verifiedAuditApproval:false as const,
  note:"Even two distinct role signatures and a full technical digest never prove independent humans, security findings, or authorize public beta.",
 };
}
