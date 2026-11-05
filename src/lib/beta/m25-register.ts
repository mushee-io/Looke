import {z} from "zod";
import {verifyMessage} from "viem";
import {createHash} from "node:crypto";
import {requiredReleaseProofs} from "./m24-review";
import {address,uuid} from "../social/validation";

export const m25Gate=z.enum(requiredReleaseProofs);
export const m25ReviewBody=z.object({
 action:z.literal("record_review"),
 gate:m25Gate,
 evidenceId:uuid,
 externalReviewer:address,
 decision:z.enum(["reviewed_reference_only","needs_more_evidence"]),
 observedAt:z.string().datetime({offset:true}),
 signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export type M25ReviewInput=z.infer<typeof m25ReviewBody>;
export function m25WritesEnabled(){
 return process.env.LOOKE_M25_REVIEW_WRITES_ENABLED==="true";
}
export function m25ReviewMessage(data:Pick<M25ReviewInput,
  "gate"|"evidenceId"|"externalReviewer"|"decision"|"observedAt">,
  identity:{origin:string;sha:string},artifactHash:string){
 if(!/^[a-f0-9]{64}$/.test(artifactHash))throw Error("Real signed evidence digest required.");
 return [
  "Looke M25 external evidence review acknowledgement",
  "Exact Preview Origin: "+identity.origin,
  "Exact Preview Commit: "+identity.sha,
  "Release Gate: "+data.gate,
  "Existing Signed Evidence ID: "+data.evidenceId,
  "Referenced Artifact SHA-256: "+artifactHash,
  "External Reviewer Wallet: "+data.externalReviewer,
  "Decision: "+data.decision,
  "Observed At: "+data.observedAt,
  "This signs only an evidence reference. The reviewer MUST inspect source contents independently.",
  "No public beta, finance, token claims, social writes or production deployment is authorized.",
 ].join("\n");
}
export function m25AuditorAllowed(wallet:string,gate:string,operator:string){
 if(wallet.toLowerCase()===operator.toLowerCase())return false;
 const key=gate==="explicit_operator_public_beta_go_live_authorization"?
  "LOOKE_M25_RELEASE_REVIEWERS":"LOOKE_M25_EXTERNAL_REVIEWERS";
 const allowed=(process.env[key]||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 return allowed.includes(wallet.toLowerCase());
}
export async function verifyM25Review(input:M25ReviewInput,params:{
 identity:{origin:string;sha:string};artifactHash:string;operator:string;now?:Date;
}){
 if(!m25AuditorAllowed(input.externalReviewer,input.gate,params.operator))
  return {valid:false,reason:"Separately allowlisted reviewer distinct from operator required."};
 const at=Date.parse(input.observedAt),now=(params.now??new Date()).getTime();
 if(!Number.isFinite(at)||!Number.isFinite(now)||at>now||now-at>300000)
  return {valid:false,reason:"Independent review signature must be less than five minutes old."};
 const message=m25ReviewMessage(input,params.identity,params.artifactHash);
 const valid=await verifyMessage({address:input.externalReviewer as `0x${string}`,
  message,signature:input.signature as `0x${string}`});
 return {valid,reason:valid?"Review reference signature valid. Artifact contents and operational approval remain separate.":"Incorrect reviewer signature."};
}
export function signatureHash(input:string){
 return createHash("sha256").update(input.toLowerCase()).digest("hex");
}
export function finalOperatorReviewGate(params:{
 m24Decision:string;flagsClosed:boolean;
 reviews:{gate:string;decision:string}[];
 humanWitnessAccepted:boolean;restoreWitnessAccepted:boolean;
 auditContentsVerified:boolean;providerVerified:boolean;
}){
 const gates=requiredReleaseProofs.map(gate=>({
  gate,
  reviewReferences:params.reviews.filter(r=>r.gate===gate).length,
  missingIndependentProof:true as const,
 }));
 return {
  milestone:"M25" as const,
  decision:"NO_GO" as const,
  publicBetaOpen:false as const,
  canActivate:false as const,
  productionPromotionApproved:false as const,
  financialTransactionsEnabled:false as const,
  pointsAccountingEnabled:false as const,
  tokenClaimsEnabled:false as const,
  privateMessagingEnabled:false as const,
  observedM24Decision:params.m24Decision,
  releaseFlagsClosed:params.flagsClosed,
  reviewGates:gates,unresolvedReleaseGates:gates.length,
  independentHumanWitnessAccepted:false as const,
  independentRestoreWitnessAccepted:false as const,
  independentSecurityApprovalAccepted:false as const,
  transactionsSent:0 as const,
  note:"Evidence review signatures prove only key-control acknowledgements, never content approval or release. Independent human decisions are intentionally not inferred from submitted booleans or a matching technical digest.",
 };
}
