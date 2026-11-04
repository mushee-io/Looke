import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { ULTRA_NATIVE_TESTNET, validateNativeAccount } from "../ultra-native";

export type WalletEvidenceInput = {
  revision:string;
  stagingOrigin:string;
  capturedAt:string;
  evmAddress:string;
  nativeAccount:string;
  observerAddress:string;
  evmSignature:Hex;
  observerSignature:Hex;
  reviewUrl:string;
};
export type WalletEvidenceResult = {
  verified:boolean;
  evmSignatureVerified:boolean;
  observerSignatureVerified:boolean;
  nativeAccountVerified:boolean;
  reviewUrlVerified:boolean;
  statement:string;
  warning:string;
};
const ZERO=/^0x0{40}$/i;
export function walletAcceptanceStatement(v:WalletEvidenceInput):string {
  if(!/^[0-9a-f]{40}$/i.test(v.revision))throw new Error("Immutable 40-character revision required.");
  const u=new URL(v.stagingOrigin);
  if(u.protocol!=="https:"||u.origin!==v.stagingOrigin||u.hostname==="example.invalid")
    throw new Error("Real canonical HTTPS protected staging origin required.");
  const age=Date.now()-Date.parse(v.capturedAt);
  if(!Number.isFinite(age)||age < -60_000||age > 30*60_000)
    throw new Error("Acceptance capture must be within 30 minutes.");
  if(!isAddress(v.evmAddress)||ZERO.test(v.evmAddress)||!isAddress(v.observerAddress)||
    ZERO.test(v.observerAddress)||getAddress(v.evmAddress)===getAddress(v.observerAddress))
    throw new Error("Different nonzero participant and reviewer wallets required.");
  validateNativeAccount(v.nativeAccount);
  if(!/^https:\/\/github\.com\/mushee-io\/looke\/issues\/[1-9][0-9]*(?:#.*)?$/.test(v.reviewUrl))
    throw new Error("Use an actual Looke GitHub acceptance issue URL; presence is not review verification.");
  return [
    "Looke M8 read-only wallet acceptance evidence",
    `Revision: ${v.revision.toLowerCase()}`,
    `Protected origin: ${v.stagingOrigin}`,
    `Captured at: ${new Date(v.capturedAt).toISOString()}`,
    `Ultra EVM Testnet chain: 18881`,
    `EVM wallet: ${getAddress(v.evmAddress)}`,
    `Ultra native Testnet chain: ${ULTRA_NATIVE_TESTNET.chainId}`,
    `Native wallet account observed in browser: ${v.nativeAccount}`,
    `Independent reviewer wallet: ${getAddress(v.observerAddress)}`,
    `Review issue: ${v.reviewUrl}`,
    "Scope: record wallet network/account visibility only; no token approval or financial transaction.",
  ].join("\n");
}
export async function verifyWalletAcceptance(
  v:WalletEvidenceInput,nativeAccountExists:boolean,reviewIssueVerified:boolean,
):Promise<WalletEvidenceResult> {
  const statement=walletAcceptanceStatement(v);
  const [owner,reviewer]=await Promise.all([
    verifyMessage({address:getAddress(v.evmAddress),message:statement,signature:v.evmSignature}),
    verifyMessage({address:getAddress(v.observerAddress),message:statement,signature:v.observerSignature}),
  ]);
  const accepted=owner&&reviewer&&nativeAccountExists&&reviewIssueVerified;
  return {
    verified:accepted,evmSignatureVerified:owner,observerSignatureVerified:reviewer,
    nativeAccountVerified:nativeAccountExists,reviewUrlVerified:reviewIssueVerified,statement,
    warning:"Native account existence and a reviewer attestation do NOT cryptographically prove control of an Ultra native wallet; independent browser witness verification and security review are still required.",
  };
}
