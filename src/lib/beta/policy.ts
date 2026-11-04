import { getAddress, isAddress, verifyMessage, type Hex } from "viem";

export const BETA_GATES = [
  "evmRpc", "nativeRpc", "factory", "creatorCoin", "uniqHolding",
  "liquidity", "socialDatabase", "walletAcceptance", "securityReview",
  "operationsApproval", "stagingProtection", "releaseSignature",
] as const;
export type GateId = typeof BETA_GATES[number];
export type GateStatus = "passed" | "blocked";
export type Gate = {id:GateId;status:GateStatus;detail:string};
export type EvidenceKind = "walletAcceptance"|"securityReview"|"operationsApproval";
export type AcceptanceEvidence = {url:string;reviewer:string;reviewedAt:string};
export type ReleaseConfig = {
  signer: string; revision: string; expiresAt: string; signature: Hex;
};
const sha = /^[0-9a-fA-F]{40}$/;
const hash = /^0x[0-9a-fA-F]{64}$/;
export function validHash(value:string|undefined):boolean {
  return typeof value==="string" && hash.test(value);
}
export function validEvmAddress(value:string|undefined):boolean {
  return typeof value==="string" && isAddress(value) && !/^0x0{40}$/i.test(value);
}
export function requiredRevision(value:string|undefined):string {
  if (!value || !sha.test(value)) throw new Error("Deployment revision must be an actual 40-character Git commit hash.");
  return value.toLowerCase();
}
export function acceptanceEvidence(value:unknown,now=new Date()):AcceptanceEvidence {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Missing independent evidence.");
  const v=value as Record<string,unknown>;
  if(typeof v.url!=="string"||v.url.length>320)throw new Error("Evidence URL missing.");
  const url=new URL(v.url);
  const knownGitHub=/^https:\/\/github\.com\/mushee-io\/looke\/(issues|pull)\/[1-9][0-9]*(?:#.*)?$/.test(v.url);
  const explorer=/^https:\/\/(evmexplorer\.testnet\.ultra\.io|explorer\.testnet\.ultra\.io)\/(tx|transaction)\/[0-9a-fA-Fx]{64,66}$/.test(v.url);
  if(url.protocol!=="https:"||(!knownGitHub&&!explorer))throw new Error("Evidence must be a Looke GitHub review or genuine Ultra Testnet explorer transaction URL.");
  if(typeof v.reviewer!=="string"||!validEvmAddress(v.reviewer))throw new Error("Evidence must name a valid reviewer wallet.");
  if(typeof v.reviewedAt!=="string")throw new Error("Evidence timestamp missing.");
  const timestamp=Date.parse(v.reviewedAt);
  if(!Number.isFinite(timestamp)||timestamp>now.getTime()+60_000||timestamp<now.getTime()-30*86400_000) {
    throw new Error("Evidence review must be dated within the past 30 days.");
  }
  return {url:v.url,reviewer:getAddress(v.reviewer),reviewedAt:new Date(timestamp).toISOString()};
}
export function parseAcceptance(raw:string|undefined,now=new Date()):Record<EvidenceKind,AcceptanceEvidence> {
  if(!raw)throw new Error("Operator review evidence has not been configured.");
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid operator evidence manifest.");
  const obj=value as Record<string,unknown>;
  return {
    walletAcceptance:acceptanceEvidence(obj.walletAcceptance,now),
    securityReview:acceptanceEvidence(obj.securityReview,now),
    operationsApproval:acceptanceEvidence(obj.operationsApproval,now),
  };
}

export function releaseText(revision:string,expiresAt:string):string {
  const validRevision=requiredRevision(revision);
  const millis=Date.parse(expiresAt);
  if(!Number.isFinite(millis))throw new Error("Release expiry is invalid.");
  return [
    "Looke M6 Ultra Testnet public beta authorization",
    "Network: Ultra EVM Testnet (18881) + Ultra native Testnet",
    `Git revision: ${validRevision}`,
    `Expires at: ${new Date(millis).toISOString()}`,
    "Purpose: authorize the explicitly reviewed PUBLIC TESTNET BETA release only.",
    "This message cannot transfer tokens or approve smart-contract transactions.",
  ].join("\n");
}
export async function validReleaseSignature(config:ReleaseConfig,now=new Date()):Promise<boolean> {
  try{
    if(!validEvmAddress(config.signer) || !/^0x[0-9a-fA-F]{130}$/.test(config.signature))return false;
    const expires=Date.parse(config.expiresAt);
    if(!Number.isFinite(expires)||expires<=now.getTime()||expires>now.getTime()+24*3600_000)return false;
    return verifyMessage({
      address:getAddress(config.signer),
      message:releaseText(config.revision,config.expiresAt),
      signature:config.signature,
    });
  }catch{return false;}
}

export function completeGates(gates:Gate[],publicFlag:boolean):boolean {
  const ids=new Set<GateId>();
  for(const gate of gates){
    if(ids.has(gate.id))return false;
    ids.add(gate.id);
  }
  return publicFlag && BETA_GATES.every(id=>gates.some(gate=>gate.id===id && gate.status==="passed"));
}

export function gate(id:GateId,ok:boolean,pass:string,blocked:string):Gate {
  return {id,status:ok?"passed":"blocked",detail:ok?pass:blocked};
}
