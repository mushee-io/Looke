/** M29 offline evidence packet: real local file bytes + two separate
 * public-key review acknowledgements. This cannot certify audit contents,
 * user identities, actual recovery provenance or release authorization.
 */
import {createHash} from "node:crypto";
import {constants} from "node:fs";
import {open} from "node:fs/promises";
import {join} from "node:path";
import {verifyMessage} from "viem";
import {z} from "zod";
import {address} from "../social/validation";

const digest=z.string().regex(/^[a-f0-9]{64}$/);
const categories=[
 "wallet_sessions","hosted_media","creator_coin","native_uniq",
 "postgres_restore19","points_anti_sybil","security_audit","incident_rollback",
] as const;
export const m29Category=z.enum(categories);
export const m29Artifact=z.object({
 category:m29Category,
 filename:z.string().min(1).max(121).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
   .refine(x=>!x.includes(".."),"Unsafe file name."),
 sha256:digest,
}).strict();
export const m29Finding=z.object({
 id:z.string().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/),
 severity:z.enum(["critical","high","medium","low","informational"]),
 status:z.enum(["open","remediation_claimed","independent_retest_claimed"]),
 description:z.string().trim().min(12).max(600),
}).strict();
export const m29Reviewer=z.object({
 role:z.enum(["security","operator"]),
 wallet:address,
 decision:z.enum(["hold","reference_acknowledged_unverified"]),
 signedAt:z.string().datetime({offset:true}),
 signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export const m29Manifest=z.object({
 milestone:z.literal("M29"),
 origin:z.string().url().refine(x=>x.startsWith("https://")&&new URL(x).origin===x),
 commit:z.string().regex(/^[a-f0-9]{40}$/),
 recordedAt:z.string().datetime({offset:true}),
 artifacts:z.array(m29Artifact).length(8),
 securityFindings:z.array(m29Finding).max(100),
 reviewers:z.tuple([m29Reviewer,m29Reviewer]),
}).strict();
export type M29Manifest=z.infer<typeof m29Manifest>;
export function canonicalManifestDigest(packet:Pick<M29Manifest,
 "milestone"|"origin"|"commit"|"recordedAt"|"artifacts"|"securityFindings">){
 const cats=new Set(packet.artifacts.map(x=>x.category));
 const filenames=new Set(packet.artifacts.map(x=>x.filename));
 if(cats.size!==categories.length||filenames.size!==categories.length||
    categories.some(x=>!cats.has(x)))
  throw Error("All eight uniquely named real evidence categories are required.");
 if(new Set(packet.securityFindings.map(x=>x.id)).size!==packet.securityFindings.length)
  throw Error("Duplicate security-audit finding IDs.");
 const relevant={milestone:packet.milestone,origin:packet.origin,commit:packet.commit,
  recordedAt:packet.recordedAt,artifacts:[...packet.artifacts].sort((a,b)=>
   a.category.localeCompare(b.category)),
  securityFindings:[...packet.securityFindings].sort((a,b)=>a.id.localeCompare(b.id))};
 return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}
export function m29ReviewMessage(params:{origin:string;commit:string;root:string;role:string;
 wallet:string;decision:string;signedAt:string}){
 return [
 "Looke M29 independent reviewer PUBLIC EVIDENCE REFERENCE acknowledgement",
 "Protected Preview: "+params.origin,
 "Immutable commit: "+params.commit,
 "Eight real file digest manifest SHA-256: "+params.root,
 "Reviewer role: "+params.role,
 "Reviewer wallet: "+params.wallet,
 "Decision: "+params.decision,
 "Signed at: "+params.signedAt,
 "This acknowledges the exact file hash manifest, NOT the true identity of the signer or safety of its contents.",
 "NO public beta, no token claims, no social/media/Points writes, no financial authorization or production deployment.",
 ].join("\n");
}
function reviewerAllowed(role:"security"|"operator",wallet:string){
 const env=role==="security"?"LOOKE_M29_SECURITY_REVIEWERS":"LOOKE_M29_OPERATOR_REVIEWERS";
 return (process.env[env]||"").split(",").map(x=>x.trim().toLowerCase())
  .includes(wallet.toLowerCase());
}
export async function verifyM29Packet(raw:unknown,rootDirectory:string,now=new Date()){
 const packet=m29Manifest.parse(raw);
 const root=canonicalManifestDigest(packet);
 const sourceAt=Date.parse(packet.recordedAt);
 if(!Number.isFinite(sourceAt)||sourceAt>now.getTime()||now.getTime()-sourceAt>60*60_000)
  throw Error("Actual evidence packet creation must be within one hour.");
 const result:{category:string;sha256:string;bytes:number}[]=[];
 for(const f of packet.artifacts){
  // O_NOFOLLOW prevents a symlink-swap between lstat and read.
  const handle=await open(join(rootDirectory,f.filename),constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
   const stat=await handle.stat();
   if(!stat.isFile()||stat.size<1||stat.size>30_000_000)
    throw Error("Actual evidence must be a nonempty bounded regular file: "+f.filename);
   const bytes=await handle.readFile();
   if(bytes.length!==stat.size)throw Error("Evidence changed during read: "+f.filename);
   const got=createHash("sha256").update(bytes).digest("hex");
   if(got!==f.sha256)throw Error("Original real artifact bytes differ from signed manifest: "+f.category);
   result.push({category:f.category,sha256:got,bytes:bytes.length});
  }finally{await handle.close();}
 }
 const roles=new Set(packet.reviewers.map(x=>x.role));
 const wallets=new Set(packet.reviewers.map(x=>x.wallet.toLowerCase()));
 if(roles.size!==2||wallets.size!==2)
  throw Error("Separate security and operator reviewer keys are required.");
 for(const reviewer of packet.reviewers){
  if(!reviewerAllowed(reviewer.role,reviewer.wallet))
   throw Error("Independent reviewer is not in the role's externally configured allowlist.");
  const signed=Date.parse(reviewer.signedAt),elapsed=now.getTime()-signed;
  if(!Number.isFinite(signed)||elapsed<0||elapsed>10*60_000||signed<sourceAt)
   throw Error("Independent file-reference acknowledgment must be signed within ten minutes.");
  const message=m29ReviewMessage({origin:packet.origin,commit:packet.commit,root,
   role:reviewer.role,wallet:reviewer.wallet,
   decision:reviewer.decision,signedAt:reviewer.signedAt});
  const valid=await verifyMessage({address:reviewer.wallet as `0x${string}`,
   signature:reviewer.signature as `0x${string}`,message});
  if(!valid)throw Error("External reviewer did not sign the exact real-file digest manifest.");
 }
 return {milestone:"M29" as const,manifestSha256:root,
  eightActualFileHashesMatched:true as const,bytesConfirmed:result,
  twoDistinctAllowlistedReviewerPublicKeys:true as const,
  originalAuditReportContentsReviewedByThisVerifier:false as const,
  findingRemediationIndependentlyRetested:false as const,
  independentHumanIdentityEstablished:false as const,
  realRestorationProven:false as const,
  productionRollbackWitnessAccepted:false as const,
  launchDecision:"NO_GO" as const,publicBetaOpen:false as const,
  transactionsSent:0 as const,
  note:"Exact bytes and public signatures verified. Authentic provider API responses, source backup provenance, external audit scope, findings remediation and signer identities need separately corroborated human evidence.",
 };
}
