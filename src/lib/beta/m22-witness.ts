/** M22: public-key-only EIP-191 wallet control evidence.
 * Signed messages are NEVER token approvals, authentication cookies or release authorization.
 * This verifier is intentionally stateless and therefore cannot certify replay-safe sessions.
 */
import {randomBytes} from "node:crypto";
import {verifyMessage} from "viem";
import {z} from "zod";
import {address} from "../social/validation";

export const witnessChallenge=z.object({
  purpose:z.literal("Looke M22 read-only wallet acceptance"),
  address,
  origin:z.string().url().max(220),
  network:z.literal("Ultra EVM Testnet (18881)"),
  nonce:z.string().regex(/^[0-9a-f]{32}$/),
  issuedAt:z.string().datetime({offset:true}),
  expiresAt:z.string().datetime({offset:true}),
  previewCommit:z.string().regex(/^[0-9a-f]{40}$/),
  scope:z.literal("wallet-control-only-no-transactions"),
}).strict();
export const signedWitness=z.object({
  challenge:witnessChallenge,
  signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();

export type WitnessChallenge=z.infer<typeof witnessChallenge>;
export function witnessMessage(input:WitnessChallenge){
 const c=witnessChallenge.parse(input);
 if(new URL(c.origin).origin!==c.origin||!c.origin.startsWith("https://"))
  throw Error("Witness origin must be the canonical HTTPS protected Preview origin.");
 return [
  c.purpose,
  "Origin: "+c.origin,
  "Network: "+c.network,
  "Wallet: "+c.address,
  "Nonce: "+c.nonce,
  "Issued At: "+c.issuedAt,
  "Expires At: "+c.expiresAt,
  "Preview Commit: "+c.previewCommit,
  "Scope: "+c.scope,
  "No token transfer, financial approval, wallet spending, authentication session, reward allocation or beta activation.",
 ].join("\n");
}
export function createWitnessChallenge(params:{
  address:string;origin:string;previewCommit:string;now?:Date;
}):WitnessChallenge{
 const at=params.now??new Date();
 if(!Number.isFinite(at.getTime()))throw Error("Invalid issuance timestamp.");
 const next=witnessChallenge.parse({
  purpose:"Looke M22 read-only wallet acceptance",
  address:params.address,origin:params.origin,
  network:"Ultra EVM Testnet (18881)",
  nonce:randomBytes(16).toString("hex"),
  issuedAt:at.toISOString(),expiresAt:new Date(at.getTime()+5*60_000).toISOString(),
  previewCommit:params.previewCommit,scope:"wallet-control-only-no-transactions",
 });
 witnessMessage(next);
 return next;
}
export async function verifyWitness(input:unknown,params:{
  expectedOrigin:string;expectedRevision:string;now?:Date;
}){
 const data=signedWitness.parse(input);
 const c=data.challenge;
 const issued=new Date(c.issuedAt).getTime();
 const expiry=new Date(c.expiresAt).getTime();
 const now=(params.now??new Date()).getTime();
 const originGood=c.origin===params.expectedOrigin&&c.origin.startsWith("https://")&&
  new URL(c.origin).origin===c.origin;
 const revisionGood=c.previewCommit===params.expectedRevision&&/^[0-9a-f]{40}$/.test(params.expectedRevision);
 const fresh=Number.isFinite(now)&&issued<=now+30_000&&expiry>now&&
  expiry>issued&&expiry-issued<=5*60_000;
 const message=witnessMessage(c);
 const signatureValid=await verifyMessage({
   address:c.address as `0x${string}`,message,
   signature:data.signature as `0x${string}`,
 });
 return {
  status:signatureValid&&originGood&&revisionGood&&fresh?"cryptographic-proof-only":"blocked",
  signatureValid,correctPreviewOrigin:originGood,correctPreviewCommit:revisionGood,
  withinFiveMinuteWindow:fresh,
  wallet:c.address,network:"Ultra EVM Testnet (18881)" as const,
  proofClass:"signed-public-message-not-onchain-transaction" as const,
  walletSessionWitnessAccepted:false as const,operatorReviewed:false as const,
  replayProtectionProven:false as const,transactionsSent:0 as const,
  note:"An EIP-191 signature proves key control only. Without an independently issued and consumed nonce and a human witness, it is NOT proof of completed session, unique human, genuine user acceptance, or authorization.",
 };
}
