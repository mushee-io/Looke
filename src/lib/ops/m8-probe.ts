/**
 * Public, READ-ONLY network observations.
 * Each proof is produced from a real RPC reply, never a seeded demo value.
 * RPC unavailability is reported as BLOCKED, never as a fabricated healthy chain.
 */
import { createUltraPublicClient } from "../verification";
import { getNativeTestnetInfo } from "../ultra-native-rpc";
import { ULTRA_EVM_TESTNET } from "../ultra";
import { ULTRA_NATIVE_TESTNET } from "../ultra-native";
import { validateEvmHead, validateNativeHead } from "./policy";

export type EvmObservation = {
  status: "verified"|"blocked";
  reason: string;
  chainId?: number;
  headBlock?: string;
  headHash?: string;
  headTimestamp?: number;
};
export type NativeObservation = {
  status: "verified"|"blocked";
  reason: string;
  chainId?: string;
  headBlock?: number;
  irreversibleBlock?: number;
};
export type RpcEvidence = {
  schemaVersion:1;
  generatedAt:string;
  source:"live-testnet-read-only";
  repositoryRevision:string|null;
  evm:EvmObservation;
  native:NativeObservation;
  betaActivated:false;
  walletTransactions:0;
  allVerified:boolean;
};

export function buildRpcEvidence(
  evm:EvmObservation,native:NativeObservation,
  revision:string|null=null,at=new Date(),
):RpcEvidence {
  const correctHash=typeof evm.headHash==="string"&&/^0x[0-9a-fA-F]{64}$/.test(evm.headHash);
  const evmOk=evm.status==="verified"&&evm.chainId===18881&&correctHash&&
    typeof evm.headBlock==="string"&&/^[0-9]+$/.test(evm.headBlock)&&
    typeof evm.headTimestamp==="number"&&
    validateEvmHead(evm.chainId,evm.headTimestamp,Math.floor(at.getTime()/1000)).ok;
  const nativeOk=native.status==="verified"&&typeof native.chainId==="string"&&
    native.chainId===ULTRA_NATIVE_TESTNET.chainId&&
    typeof native.headBlock==="number"&&typeof native.irreversibleBlock==="number"&&
    validateNativeHead(native.chainId,ULTRA_NATIVE_TESTNET.chainId,native.headBlock,native.irreversibleBlock).ok;
  return {
    schemaVersion:1,generatedAt:at.toISOString(),source:"live-testnet-read-only",
    repositoryRevision:revision&&/^[0-9a-f]{40}$/i.test(revision)?revision:null,
    evm:{...evm,status:evmOk?"verified":"blocked",
      reason:evmOk?evm.reason:(evm.status==="verified"?"Invalid or stale EVM evidence.":evm.reason)},
    native:{...native,status:nativeOk?"verified":"blocked",
      reason:nativeOk?native.reason:(native.status==="verified"?"Invalid native chain evidence.":native.reason)},
    betaActivated:false,walletTransactions:0,allVerified:evmOk&&nativeOk,
  };
}

export async function collectLiveRpcEvidence(now=new Date()):Promise<RpcEvidence> {
  const [evm,native]=await Promise.allSettled([
    (async():Promise<EvmObservation>=>{
      const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL || ULTRA_EVM_TESTNET.rpcUrls[0]);
      const [chainId,head]=await Promise.all([client.getChainId(),client.getBlock({blockTag:"latest"})]);
      const check=validateEvmHead(chainId,Number(head.timestamp),Math.floor(now.getTime()/1000));
      const hash=head.hash;
      if(!check.ok||!hash||!/^0x[0-9a-fA-F]{64}$/.test(hash))
        return {status:"blocked",reason:check.ok?"No valid confirmed block hash.":check.reason,chainId};
      return {status:"verified",reason:check.reason,chainId,
        headBlock:head.number.toString(),headHash:hash,headTimestamp:Number(head.timestamp)};
    })(),
    (async():Promise<NativeObservation>=>{
      const info=await getNativeTestnetInfo();
      const check=validateNativeHead(info.chain_id,ULTRA_NATIVE_TESTNET.chainId,
        info.head_block_num,info.last_irreversible_block_num);
      return {status:check.ok?"verified":"blocked",reason:check.reason,chainId:info.chain_id,
        headBlock:info.head_block_num,irreversibleBlock:info.last_irreversible_block_num};
    })(),
  ]);
  return buildRpcEvidence(
    evm.status==="fulfilled"?evm.value:{status:"blocked",reason:"EVM RPC unavailable; no chain data verified."},
    native.status==="fulfilled"?native.value:{status:"blocked",reason:"Native Ultra RPC unavailable; no chain data verified."},
    process.env.GITHUB_SHA??null,now,
  );
}
