/**
 * Read-only native Ultra Testnet history trace and current ownership proof.
 * get_transaction availability depends on the configured history-enabled node:
 * no trace => BLOCKED; ownership alone is not proof of a mint transaction.
 */
import {getNativeTestnetInfo} from "../ultra-native-rpc";
import {inspectNativeUniq} from "../beta/acceptance";
import {ULTRA_NATIVE_TESTNET,positiveId,validateNativeAccount} from "../ultra-native";

export type NativeMintManifest={txHash:string;owner:string;factoryId:string;tokenId:string};
type NativeTrace={
  id?:string;
  block_num?:number;
  trx?:{receipt?:{status?:string}};
  traces?:Array<{act?:{account?:string;name?:string;data?:unknown}}>;
};
export function validateNativeMintManifest(raw:unknown):NativeMintManifest{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Expected a native mint receipt manifest.");
  const r=raw as Record<string,unknown>;
  if(typeof r.txHash!=="string"||!/^[0-9a-fA-F]{64}$/.test(r.txHash)||/^0{64}$/.test(r.txHash))
    throw new Error("An actual native transaction ID is required.");
  return {
    txHash:r.txHash.toLowerCase(),owner:validateNativeAccount(String(r.owner||"")),
    factoryId:positiveId(String(r.factoryId||"")),tokenId:positiveId(String(r.tokenId||"")),
  };
}
export function verifyNativeMintTrace(
  trace:NativeTrace,manifest:NativeMintManifest,irreversibleBlock:number,
):{blockNumber:number;source:"native-history-trace"}{
  if(trace.id?.toLowerCase()!==manifest.txHash||
     !Number.isSafeInteger(trace.block_num)||!trace.block_num||trace.block_num>irreversibleBlock||
     trace.trx?.receipt?.status!=="executed")
    throw new Error("Native mint transaction is missing, unconfirmed or not executed.");
  const actions=trace.traces??[];
  const matching=actions.some(t=>{
    if(t.act?.account!==ULTRA_NATIVE_TESTNET.contract||t.act.name!=="issue.b")return false;
    const d=t.act.data;
    if(!d||typeof d!=="object"||Array.isArray(d))return false;
    const raw=d as Record<string,unknown>;
    const issue=raw.issue&&typeof raw.issue==="object" ? raw.issue as Record<string,unknown> : raw;
    const configs=issue.token_configs;
    return issue.to===manifest.owner &&
      Array.isArray(configs)&&configs.some(c=>{
        if(!c||typeof c!=="object")return false;
        const item=c as Record<string,unknown>;
        return String(item.token_factory_id)===manifest.factoryId &&
          (item.amount===1||item.amount==="1");
      });
  });
  if(!matching)throw new Error("No executed eosio.nft.ft issue.b action matches the claimed owner and factory.");
  return {blockNumber:trace.block_num,source:"native-history-trace"};
}
export async function verifyNativeMint(manifest:NativeMintManifest){
  const info=await getNativeTestnetInfo();
  const rpc=process.env.ULTRA_NATIVE_TESTNET_RPC_URL||ULTRA_NATIVE_TESTNET.rpc;
  const response=await fetch(`${rpc}/v1/history/get_transaction`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({id:manifest.txHash}),cache:"no-store",
    signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error("Native Ultra Testnet history node did not return this transaction. Cannot verify mint.");
  const trace=await response.json() as NativeTrace;
  const result=verifyNativeMintTrace(trace,manifest,info.last_irreversible_block_num);
  const ownership=await inspectNativeUniq(manifest.factoryId,manifest.owner,manifest.tokenId);
  if(ownership.irreversibleBlock<result.blockNumber)throw new Error("Current owner proof is not irreversible after the mint block.");
  return {
    status:"verified" as const,txHash:manifest.txHash,owner:ownership.owner,
    factoryId:ownership.factoryId,tokenId:ownership.tokenId,
    blockNumber:result.blockNumber,irreversibleBlock:ownership.irreversibleBlock,
    note:"Transaction proves issue.b for this owner/factory and targeted token.b proves current ownership; the action may issue more than one token. ID attribution needs independently reviewed trace/indexer.",
    betaActivated:false,
  };
}
