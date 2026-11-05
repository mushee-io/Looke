/** M29 independently cross-checks actual previously CONSUMED M23 nonces and
 * signatures against source PostgreSQL, plus two separately signed observer
 * statements. Public keys are NOT a guarantee of separate humans or attendance.
 */
import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import {verifyMessage} from "viem";
import {z} from "zod";
import {address,uuid} from "../social/validation";

const signature=z.string().regex(/^0x[0-9a-fA-F]{130}$/);
const sha=z.string().regex(/^[a-f0-9]{40}$/);
export const observedWallet=z.object({
 challengeId:uuid,
 walletSignature:signature,
 observer:address,
 observerSignature:signature,
 observedAt:z.string().datetime({offset:true}),
}).strict();
export const m29WalletPacket=z.object({
 origin:z.string().url().refine(s=>s.startsWith("https://")&&new URL(s).origin===s),
 commit:sha,
 sessions:z.tuple([observedWallet,observedWallet]),
}).strict();
export type M29WalletPacket=z.infer<typeof m29WalletPacket>;
export type OneTimeWalletRow={
 id:string;wallet:string;reviewer:string;nonce:string;preview_origin:string;
 preview_sha:string;challenge_message:string;consumed_at:Date;
 expires_at:Date;verified_at:Date;accepted_wallet:string;signature_sha256:string;
};
export function observerBinding(packet:Pick<M29WalletPacket,"origin"|"commit">,row:Pick<
 OneTimeWalletRow,"id"|"wallet"|"nonce"|"signature_sha256">,
 session:Pick<z.infer<typeof observedWallet>,"observer"|"observedAt">){
 return [
 "Looke M29 source-backed independent Testnet witness REFERENCE",
 "Exact protected Preview origin: "+packet.origin,
 "Exact immutable commit: "+packet.commit,
 "One-use challenge ID: "+row.id,
 "Original wallet: "+row.wallet,
 "Original server nonce: "+row.nonce,
 "Original wallet signature SHA-256: "+row.signature_sha256,
 "Observer key: "+session.observer,
 "Observed at: "+session.observedAt,
 "I acknowledge this public-key reference only; identity, attendance and human independence need separate direct verification.",
 "No public beta, wallet spending, token claims, social posts or production authorization.",
 ].join("\n");
}
const sigDigest=(s:string)=>createHash("sha256").update(s.toLowerCase()).digest("hex");
export async function verifyConsumedWalletPair(
 conn:Pick<PoolClient,"query">,raw:unknown,now=new Date()
){
 const packet=m29WalletPacket.parse(raw);
 const ids=packet.sessions.map(x=>x.challengeId);
 if(new Set(ids).size!==2)throw Error("Two distinct previously consumed challenge IDs required.");
 const rows=await conn.query<OneTimeWalletRow>(`
  SELECT c.id,c.wallet,c.reviewer,c.nonce,c.preview_origin,c.preview_sha,
   c.challenge_message,c.consumed_at,c.expires_at,a.verified_at,
   a.wallet AS accepted_wallet,a.signature_sha256
  FROM social_beta_wallet_challenges c
  JOIN social_beta_wallet_acceptances a ON a.challenge_id=c.id
  JOIN social_profiles p ON p.address=a.wallet AND p.suspended=false
  WHERE c.id=ANY($1::uuid[]) AND c.preview_sha=$2 AND c.preview_origin=$3
    AND c.consumed_at IS NOT NULL
  ORDER BY c.id ASC`,[ids,packet.commit,packet.origin]);
 if(rows.rowCount!==2)throw Error("Two genuine account-scoped and consumed one-time database records are required.");
 const wallets:string[]=[],observers:string[]=[],nonces:string[]=[];
 for(const session of packet.sessions){
  const row=rows.rows.find(x=>x.id===session.challengeId);
  if(!row)throw Error("The authenticated wallet evidence ID is not in the exact Preview.");
  if(row.wallet!==row.accepted_wallet||!row.consumed_at||!row.verified_at||
     row.consumed_at.getTime()>row.verified_at.getTime()+30_000||
     row.consumed_at.getTime()>row.expires_at.getTime())
    throw Error("Original one-use nonce was not atomically consumed into a matching acceptance.");
  if(sigDigest(session.walletSignature)!==row.signature_sha256)
   throw Error("Original acceptance signature hash does not match genuine PostgreSQL evidence.");
  const valid=await verifyMessage({address:row.wallet as `0x${string}`,
   message:row.challenge_message,signature:session.walletSignature as `0x${string}`});
  if(!valid)throw Error("Wallet failed original server-issued signature verification.");
  const observedAt=Date.parse(session.observedAt),delta=now.getTime()-observedAt;
  if(!Number.isFinite(delta)||delta<0||delta>300000)
   throw Error("Independent observer reference must be newly signed within five minutes.");
  const observerOk=await verifyMessage({address:session.observer as `0x${string}`,
   message:observerBinding(packet,row,session),
   signature:session.observerSignature as `0x${string}`});
  if(!observerOk)throw Error("Observer signature does not bind the actual consumed nonce and original wallet signature.");
  wallets.push(row.wallet.toLowerCase());observers.push(session.observer.toLowerCase());
  nonces.push(row.nonce);
 }
 if(new Set([...wallets,...observers]).size!==4||new Set(nonces).size!==2)
  throw Error("Two wallets and two observer keys must be four distinct keys with different issued nonces.");
 return {
  status:"original_consumed_challenges_and_four_public_signatures_verified" as const,
  walletKeysVerified:2 as const,observerKeysVerified:2 as const,
  consumedNonceEvidenceVerified:true as const,
  rawOriginalSignaturesMatchedStoredDigests:true as const,
  distinctKeyCount:4 as const,
  exactPreviewCommit:packet.commit,exactPreviewOrigin:packet.origin,
  originalConsumptionReplayProtected:true as const,
  offlineAuditReportItselfReplayProtected:false as const,
  independentlyVerifiedHumanWitnesses:false as const,
  personallyConfirmedRealHumanIdentities:false as const,
  publicBetaAuthorized:false as const,transactionsSent:0 as const,
  note:"M23 original issuance and atomic consumption prevented a second acceptance using these nonces. Re-reading an offline report is not one-use and does not prove genuine observer attendance or human uniqueness.",
 };
}
