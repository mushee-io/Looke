import {verifyMessage,isAddress,getAddress} from "viem";
import {z} from "zod";

/**
 * M16 offline only: wallet-bound encryption key assertion for a future,
 * separately audited messenger. No registration or message routes are enabled.
 */
const payload=z.object({
  address:z.string().refine(x=>isAddress(x)),
  origin:z.string().url().max(160),
  publicKey:z.string().regex(/^[A-Za-z0-9+/]{42}[A-Za-z0-9+/=]{2}$/),
  version:z.number().int().min(1).max(10000),
  nonce:z.string().regex(/^[0-9a-f]{32}$/),
  issuedAt:z.string().datetime({offset:true}),
  expiresAt:z.string().datetime({offset:true}),
}).strict();
export type KeyBinding=z.infer<typeof payload>;
export function keyRegistrationStatement(value:KeyBinding):string{
 const binding=payload.parse(value);
 const origin=new URL(binding.origin);
 if(origin.protocol!=="https:"||origin.origin!==binding.origin||origin.username||origin.password)
   throw new Error("Encryption key registration requires an exact HTTPS origin.");
 const pub=Buffer.from(binding.publicKey,"base64");
 if(pub.length!==32||pub.toString("base64")!==binding.publicKey)
   throw new Error("Canonical X25519 public key must be exactly 32 bytes.");
 const issued=Date.parse(binding.issuedAt),expires=Date.parse(binding.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||
   expires-issued>15*60*1000)throw new Error("Key registration challenge must expire within 15 minutes.");
 return [
   "Looke encrypted-messaging key registration — NOT a transaction",
   "Origin: "+binding.origin,
   "Ultra EVM Testnet chain: 18881",
   "Wallet: "+getAddress(binding.address),
   "Key algorithm: X25519",
   "Public key (base64): "+binding.publicKey,
   "Key version: "+binding.version,
   "Nonce: "+binding.nonce,
   "Issued at: "+binding.issuedAt,
   "Expires at: "+binding.expiresAt,
   "No token transfer or wallet spending is authorized by this signature.",
 ].join("\n");
}
export async function verifyKeyRegistrationSignature(
 value:KeyBinding,signature:`0x${string}`,at:number,expectedOrigin:string
):Promise<boolean>{
 const message=keyRegistrationStatement(value);
 if(value.origin!==expectedOrigin||
   at<Date.parse(value.issuedAt)-60_000||at>=Date.parse(value.expiresAt)||
   !/^0x[0-9a-fA-F]{130}$/.test(signature))return false;
 return await verifyMessage({
   address:getAddress(value.address),message,signature,
 });
}
export const KEY_REGISTRATION_ACCEPTANCE={
  registrationApiEnabled:false,
  x25519KeyRecoveryReviewed:false,
  messageTransportEnabled:false,
  securityAuditPassed:false,
} as const;
