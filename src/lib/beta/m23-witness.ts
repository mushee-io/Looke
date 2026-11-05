import {createHash} from "node:crypto";
import {verifyMessage} from "viem";
import {z} from "zod";
import {address} from "../social/validation";
import {witnessChallenge,witnessMessage,createWitnessChallenge} from "./m22-witness";

export const issueSchema=z.object({action:z.literal("issue"),wallet:address}).strict();
export const consumeSchema=z.object({
  action:z.literal("consume"),
  challengeId:z.string().uuid(),
  challenge:witnessChallenge,
  signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export function acceptanceWritesEnabled(){
 return process.env.LOOKE_M23_ACCEPTANCE_WRITES_ENABLED==="true";
}
export function previewIdentity(){
 const origin=process.env.LOOKE_M23_PREVIEW_ORIGIN;
 const sha=process.env.VERCEL_GIT_COMMIT_SHA||process.env.LOOKE_M23_PREVIEW_SHA;
 if(!origin||!sha||!/^https:\/\/[^/?#]+$/.test(origin)||!/^([a-f0-9]{40})$/.test(sha))
  throw Error("Exact HTTPS Preview origin and 40-character git revision must be configured.");
 if(new URL(origin).origin!==origin)throw Error("Canonical HTTPS Preview origin required.");
 return {origin,sha};
}
export const evidencePayload=z.object({
  kind:z.enum(["restore","security","operator"]),
  evidenceHash:z.string().regex(/^[a-f0-9]{64}$/),
  evidenceUrl:z.string().url().max(800).refine(x=>x.startsWith("https://"),"HTTPS artifact reference required."),
  auditor:address,
  signedAt:z.string().datetime({offset:true}),
}).strict();
export const recordEvidenceSchema=evidencePayload.extend({
  action:z.literal("record_evidence"),
  signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export function evidenceMessage(data:z.infer<typeof evidencePayload>,identity:{origin:string;sha:string}){
 return [
  "Looke M23 external evidence countersignature",
  "Origin: "+identity.origin,
  "Preview Commit: "+identity.sha,
  "Kind: "+data.kind,
  "Evidence SHA-256: "+data.evidenceHash,
  "Evidence URL: "+data.evidenceUrl,
  "Auditor Wallet: "+data.auditor,
  "Signed At: "+data.signedAt,
  "Scope: evidence-reference-only; NOT evidence-content validation or beta activation.",
 ].join("\n");
}
export async function verifyAuditorSignature(
 input:z.infer<typeof recordEvidenceSchema>,identity:{origin:string;sha:string},
 recordedBy:string,now=new Date()
){
 const role=input.kind==="operator"?"LOOKE_M23_RELEASE_SIGNERS":"LOOKE_M23_AUDITORS";
 const allowed=(process.env[role]??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(input.auditor.toLowerCase())||
   input.auditor.toLowerCase()===recordedBy.toLowerCase())
  return {valid:false,reason:"Independent allowlisted auditor or signer required."};
 const signedAt=Date.parse(input.signedAt),delta=now.getTime()-signedAt;
 if(!Number.isFinite(signedAt)||!Number.isFinite(delta)||delta<0||delta>300000)
  return {valid:false,reason:"Evidence signature must be fresh (five minutes)."};
 const valid=await verifyMessage({address:input.auditor as `0x${string}`,
   message:evidenceMessage(input,identity),signature:input.signature as `0x${string}`});
 return {valid,reason:valid?"Cryptographic countersignature validated; external evidence CONTENT is not yet independently checked.":"Evidence signature does not match designated auditor."};
}
export function signatureDigest(sig:string){return createHash("sha256").update(sig.toLowerCase()).digest("hex");}
export {witnessMessage,createWitnessChallenge};
