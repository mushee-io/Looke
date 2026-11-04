/**
 * Verify supplied public signatures and reviewer attestation. NEVER generate signatures.
 * Externally check the linked issue and native-wallet browser presence before treating as accepted.
 */
import {readFile} from "node:fs/promises";
import {verifyWalletAcceptance,type WalletEvidenceInput} from "../src/lib/ops/m8-wallet-evidence";
import {ULTRA_NATIVE_TESTNET,validateNativeAccount} from "../src/lib/ultra-native";
import {getNativeTestnetInfo} from "../src/lib/ultra-native-rpc";

async function nativeExists(account:string):Promise<boolean>{
  const name=validateNativeAccount(account);
  await getNativeTestnetInfo();
  const res=await fetch(`${process.env.ULTRA_NATIVE_TESTNET_RPC_URL||ULTRA_NATIVE_TESTNET.rpc}/v1/chain/get_account`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({account_name:name}),cache:"no-store",signal:AbortSignal.timeout(12_000),
  });
  if(!res.ok)return false;
  const data=await res.json() as {account_name?:string};
  return data.account_name===name;
}
async function main(){
  const file=process.argv[2];
  if(!file)throw new Error("Usage: npm run m8:wallet-acceptance -- ./public-wallet-evidence.json");
  const v=JSON.parse(await readFile(file,"utf8")) as WalletEvidenceInput;
  const exists=await nativeExists(v.nativeAccount);
  // The URL regex alone cannot prove the issue exists or has been reviewed.
  // An independent human must inspect this linked record; do not count it as verified automatically.
  const result=await verifyWalletAcceptance(v,exists,false);
  console.log(JSON.stringify({
    verified:result.verified,evmSignatureVerified:result.evmSignatureVerified,
    observerSignatureVerified:result.observerSignatureVerified,
    nativeAccountExists:result.nativeAccountVerified,
    independentIssueReviewed:false,
    note:result.warning,
  },null,2));
  if(!result.verified)process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=2;});
