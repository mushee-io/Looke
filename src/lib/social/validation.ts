import { getAddress, isAddress } from "viem";
import { z } from "zod";

export const address = z.string().refine(x => isAddress(x) && !/^0x0{40}$/i.test(x), "Valid nonzero EVM wallet required")
  .transform(x => getAddress(x).toLowerCase());

export const handle = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,23}$/, "Handle must be 3–24 lowercase letters, digits or underscores.");
export const profile = z.object({
  handle,
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(240).default(""),
  avatarUrl: z.union([z.literal(""), z.string().url().max(500).refine(x => x.startsWith("https://"), "Avatar URL must be HTTPS")]).default(""),
}).strict();
export const assetReference = z.discriminatedUnion("assetType",[
  z.object({assetType:z.literal("token"),assetChain:z.literal("ultra-evm"),assetId:address}),
  z.object({assetType:z.literal("uniq"),assetChain:z.literal("ultra-native"),assetId:z.string().regex(/^[1-9][0-9]{0,15}$/)}),
]);
export const post = z.object({
  body:z.string().trim().min(1).max(1000),
  asset:z.union([assetReference,z.null()]).default(null),
}).strict();
export const comment = z.object({postId:z.string().uuid(),body:z.string().trim().min(1).max(500)}).strict();
export const report = z.object({
  targetType:z.enum(["post","comment"]),
  targetId:z.string().uuid(),
  reason:z.enum(["spam","scam","harassment","impersonation","other"]),
  details:z.string().trim().max(500).default(""),
}).strict();
export const follow = z.object({target:address}).strict();
export const challenge = z.object({address}).strict();
export const signature = z.object({
  challengeId:z.string().uuid(),
  signature:z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export const uuid = z.string().uuid();

export function signInMessage(params:{origin:string;address:string;nonce:string;issued:string;expires:string}) {
  const url = new URL(params.origin);
  if(url.origin!==params.origin)throw new Error("Application origin must be canonical.");
  return [
    "Looke social sign-in",
    `Origin: ${url.origin}`,
    `Wallet: ${params.address}`,
    "Network: Ultra EVM Testnet (18881)",
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issued}`,
    `Expires At: ${params.expires}`,
    "Purpose: Authenticate to Looke social. This message cannot move funds or authorize transactions.",
  ].join("\n");
}
export function normalizeBody(x:string) {
  // Rendered as plain text; React escapes HTML rather than treating it as markup.
  return x.trim().replace(/\r\n?/g,"\n");
}
export function assetLabel(type:string|null,chain:string|null,id:string|null):string|null {
  if(!type||!chain||!id)return null;
  return type==="token" ? `Ultra EVM creator token ${id}` : `Ultra native Uniq #${id}`;
}
