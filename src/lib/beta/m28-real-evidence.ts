/** M28: check genuine public signatures and authenticated hosted asset records.
 * These proofs have no state transition and DO NOT establish human identity.
 */
import {createHash} from "node:crypto";
import {verifyMessage} from "viem";
import {z} from "zod";
import {address,uuid} from "../social/validation";
import {fetchProviderAsset,uploadConfig,uploadDraft,verifyProviderAsset} from "../social/upload-provider";
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const ethSig=z.string().regex(/^0x[0-9a-fA-F]{130}$/);
const observed=z.string().datetime({offset:true});
export const sessionProof=z.object({
 wallet:address,walletSignature:ethSig,
 observer:address,observerSignature:ethSig,
 nonce:uuid,observedAt:observed,sessionId:uuid,
}).strict();
export const dualSessionPacket=z.object({
 origin:z.string().url().refine(x=>x.startsWith("https://")&&new URL(x).origin===x),
 commit:sha,chainId:z.literal(18881),
 sessions:z.tuple([sessionProof,sessionProof]),
}).strict();
export type DualSessionPacket=z.infer<typeof dualSessionPacket>;
export function walletSessionMessage(packet:Pick<DualSessionPacket,"origin"|"commit"|"chainId">,
 session:Pick<z.infer<typeof sessionProof>,"wallet"|"nonce"|"observedAt"|"sessionId">){
 return [
 "Looke M28 REAL wallet key-control evidence (no financial authorization)",
 "Protected Preview: "+packet.origin,
 "Immutable Commit: "+packet.commit,
 "Testnet Chain ID: "+packet.chainId,
 "Session ID: "+session.sessionId,
 "One-use Nonce: "+session.nonce,
 "Wallet: "+session.wallet,
 "Observed At: "+session.observedAt,
 "Signing proves key control, NOT personal identity or human independence.",
 "No beta launch, token minting, social writes or transaction authorization.",
 ].join("\n");
}
export function observerMessage(packet:Pick<DualSessionPacket,"origin"|"commit"|"chainId">,
 session:z.infer<typeof sessionProof>){
 return [
 "Looke M28 separate observer acknowledgment of a wallet signature reference",
 "Protected Preview: "+packet.origin,
 "Immutable Commit: "+packet.commit,
 "Testnet Chain ID: "+packet.chainId,
 "Wallet: "+session.wallet,
 "Observer: "+session.observer,
 "Session ID: "+session.sessionId,
 "One-use Nonce: "+session.nonce,
 "Wallet Signature SHA-256: "+createHash("sha256").update(session.walletSignature.toLowerCase()).digest("hex"),
 "Observed At: "+session.observedAt,
 "A signed observer key is NOT proof the observer actually attended or is a unique human.",
 "No beta release, social writes, token claims or financial permission.",
 ].join("\n");
}
export async function verifyDualSessionPacket(raw:unknown,now=new Date()){
 const packet=dualSessionPacket.parse(raw);
 const identities=packet.sessions.flatMap(x=>[x.wallet.toLowerCase(),x.observer.toLowerCase()]);
 if(new Set(identities).size!==4)throw Error("Two different wallets and two distinct independent public observer keys required.");
 if(packet.sessions[0].nonce===packet.sessions[1].nonce||
    packet.sessions[0].sessionId===packet.sessions[1].sessionId)
  throw Error("Each signed wallet challenge needs a distinct nonce and session ID.");
 for(const session of packet.sessions){
  const delta=now.getTime()-Date.parse(session.observedAt);
  if(!Number.isFinite(delta)||delta<0||delta>300000)
   throw Error("Actual signatures must be fresh within five minutes.");
  const walletOk=await verifyMessage({address:session.wallet as `0x${string}`,
   signature:session.walletSignature as `0x${string}`,
   message:walletSessionMessage(packet,session)});
  if(!walletOk)throw Error("Wallet does not control the claimed session address.");
  const observerOk=await verifyMessage({address:session.observer as `0x${string}`,
   signature:session.observerSignature as `0x${string}`,
   message:observerMessage(packet,session)});
  if(!observerOk)throw Error("Observer did not sign the exact referenced wallet proof.");
 }
 return {cryptographicWalletProofs:2,observerKeys:2,
  exactOrigin:packet.origin,exactCommit:packet.commit,
  independentlyWitnessedRealHumans:false as const,
  personallyVerifiedHumanIdentity:false as const,releaseAuthorized:false as const,
  message:"Four real EIP-191 signatures verified; observer presence, personal identity and independence still require actual external human evidence.",
 };
}
export type ApprovedMediaRow={post_id:string;owner:string;public_id:string;
 kind:"image"|"video";mime:"image/png"|"image/jpeg"|"image/webp"|"image/gif"|"video/mp4"|"video/webm";
 declared_bytes:number;media_url:string;moderation_count:number};
export async function inspectProviderRows(rows:ApprovedMediaRow[]){
 if(rows.length>3)throw Error("Bounded live provider inspection must not exceed three items.");
 if(!rows.length)return {status:"blocked" as const,inspected:0,verified:0,
  blocked:0,reason:"No actual source-backed approved media and moderator receipt exists.",
  realProviderInspected:false as const,independentHumanModeratorAccepted:false as const};
 const config=uploadConfig();
 const results=await Promise.all(rows.map(async(row)=>{
  if(!row.moderation_count||row.moderation_count<1)return {postId:row.post_id,status:"blocked" as const,
   reason:"Missing real moderator approval audit row."};
  try{
   const draft=uploadDraft.parse({kind:row.kind,mime:row.mime,bytes:row.declared_bytes});
   const remote=await fetchProviderAsset(config,row.kind,row.public_id);
   const verified=verifyProviderAsset({config,asset:remote,publicId:row.public_id,
    draft,expectedOwner:row.owner});
   if(verified.url!==row.media_url)throw Error("Live provider URL not equal to approved source record.");
   return {postId:row.post_id,status:"verified" as const,reason:"Actual authenticated provider metadata matched wallet-scoped upload and moderated post."};
  }catch{return {postId:row.post_id,status:"blocked" as const,
   reason:"Live hosted asset, authorization, MIME, bytes or source URL was not confirmed."};}
 }));
 const count=results.filter(x=>x.status==="verified").length;
 return {status:count===rows.length?"verified" as const:"blocked" as const,
  inspected:rows.length,verified:count,blocked:rows.length-count,
  reason:"Live authenticated provider API compared with real moderated PostgreSQL records. Human content-safety inspection is separately required.",
  realProviderInspected:true as const,independentHumanModeratorAccepted:false as const,
  results};
}
export function finalM28Decision(input:{walletProofs:number;providerVerified:boolean;
 chainToken:boolean;chainUniq:boolean;pointsComplete:boolean;pointsDrift:number;
 restore19Matched:boolean;realHumanApproval:boolean;securityAuditorContentsVerified:boolean;
 rollbackWitnessVerified:boolean}){
 const blocked=[
  ...(!input.walletProofs?["wallet_key_control_missing"]:[]),
  ...(!input.providerVerified?["real_hosted_media_missing"]:[]),
  ...(!input.chainToken?["canonical_ultra_evm_coin_receipt_missing"]:[]),
  ...(!input.chainUniq?["native_uniq_owner_missing"]:[]),
  ...(!input.pointsComplete||input.pointsDrift?["full_points_and_anti_sybil_review_missing"]:[]),
  ...(!input.restore19Matched?["actual_restored_database_19_table_integrity_missing"]:[]),
  ...(!input.realHumanApproval?["independent_two_human_witness_missing"]:[]),
  ...(!input.securityAuditorContentsVerified?["independent_audit_original_file_and_findings_missing"]:[]),
  ...(!input.rollbackWitnessVerified?["witnessed_incident_recovery_missing"]:[]),
 ];
 return {milestone:"M28" as const,decision:"NO_GO" as const,publicBetaOpen:false as const,
  launchAuthorized:false as const,productionChangeAllowed:false as const,
  financialBroadcastAllowed:false as const,socialMediaWritesAllowed:false as const,
  tokenClaimsAllowed:false as const,privateMessagingAllowed:false as const,
  transactionsSent:0 as const,blockers:blocked,
  genuineHumanIndependentApprovalAccepted:false as const,
  note:"Cryptography and external API observation cannot autonomously authorize beta; separate genuine human review is mandatory.",
 };
}
