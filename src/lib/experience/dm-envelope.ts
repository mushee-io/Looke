/**
 * Future encrypted envelope format requirements. Validation only.
 * No key registration, encryption implementation, send/decrypt or storage route.
 */
export type SealedEnvelope={
 version:1;algorithm:"x25519-xsalsa20-poly1305";senderKeyVersion:number;
 recipientKeyVersion:number;nonce:string;ciphertext:string;
};
const BASE64=/^[A-Za-z0-9+/]+={0,2}$/;
function byteLength(value:string):number{
 if(!BASE64.test(value)||value.length%4!==0)return -1;
 return Buffer.from(value,"base64").length;
}
export function validateEnvelope(value:unknown):SealedEnvelope{
 if(!value||typeof value!=="object"||Array.isArray(value))
   throw new Error("Encrypted envelope object required.");
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(",")!==
  ["algorithm","ciphertext","nonce","recipientKeyVersion","senderKeyVersion","version"].sort().join(","))
   throw new Error("Only canonical sealed-envelope fields are allowed. No plaintext.");
 if(v.version!==1||v.algorithm!=="x25519-xsalsa20-poly1305"||
   !Number.isSafeInteger(v.senderKeyVersion)||Number(v.senderKeyVersion)<1||
   !Number.isSafeInteger(v.recipientKeyVersion)||Number(v.recipientKeyVersion)<1||
   typeof v.nonce!=="string"||byteLength(v.nonce)!==24||
   typeof v.ciphertext!=="string"||
   byteLength(v.ciphertext)<48||byteLength(v.ciphertext)>8192)
   throw new Error("Invalid encryption envelope metadata, nonce or ciphertext length.");
 return v as unknown as SealedEnvelope;
}
export const DM_SECURITY_GATES={
 encryptionAudited:false,
 clientKeyRegistration:false,
 deviceRecoveryAudited:false,
 consentAndBlockingEnforced:false,
 liveMessagingEnabled:false,
} as const;
