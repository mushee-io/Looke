/**
 * M10 independently sourced Ultra Testnet state comparison.
 * One RPC response proves availability, never independent agreement.
 * Missing secondary endpoints and source disagreements are BLOCKED.
 * Every method is READ ONLY; no account, signature or transaction requests.
 */
import {createPublicClient,http} from "viem";
import {ULTRA_EVM_TESTNET} from "../ultra";
import {ULTRA_NATIVE_TESTNET} from "../ultra-native";
import {validateEvmHead,validateNativeHead} from "./policy";

export type EvmComparison = {
  chainId:number;head:bigint;commonBlockHash:string;commonBlock:bigint;
  timestamp:number;hostname:string;
};
export type NativeComparison = {
  chainId:string;head:number;irreversible:number;
  commonBlockId:string;commonBlock:number;hostname:string;
};
export type SourceCheck = {status:"verified"|"blocked";reason:string;
  commonBlock?:string;blockHash?:string;primaryHost?:string;secondaryHost?:string};
export type DualRpcProof = {
  source:"two-independent-ultra-testnet-rpcs";observedAt:string;
  evm:SourceCheck;native:SourceCheck;allVerified:boolean;
  readOnly:true;transactions:0;betaActivated:false;
};

export function safeUltraRpcUrl(value:string):URL {
  const url=new URL(value);
  const host=url.hostname.toLowerCase();
  const permitted=host==="eosphere.io"||host.endsWith(".eosphere.io")||
    host==="eosusa.io"||host.endsWith(".eosusa.io")||
    host==="ultra.io"||host.endsWith(".ultra.io");
  if(url.protocol!=="https:" || !permitted || url.username||url.password ||
     url.port||url.search||url.hash||url.pathname!=="/"){
    throw new Error("Independent RPC must be an HTTPS origin of a recognized Ultra Testnet provider.");
  }
  return url;
}
export function distinctSources(a:string,b:string){
  const primary=safeUltraRpcUrl(a),secondary=safeUltraRpcUrl(b);
  if(primary.hostname===secondary.hostname)
    throw new Error("Two endpoints on the same hostname are not independent RPC sources.");
  return [primary,secondary] as const;
}
export function compareEvmProofs(
  a:EvmComparison,b:EvmComparison,nowSeconds=Math.floor(Date.now()/1000),
):SourceCheck {
  if(a.hostname===b.hostname)return {status:"blocked",reason:"EVM evidence came from the same RPC host."};
  if(a.chainId!==18881||b.chainId!==18881)return {status:"blocked",reason:"EVM chain ID mismatch."};
  if(a.head<a.commonBlock||b.head<b.commonBlock ||
     a.commonBlock!==b.commonBlock || a.head-b.head>1200n || b.head-a.head>1200n)
     return {status:"blocked",reason:"EVM heads or common comparison height diverge."};
  if(!/^0x[0-9a-f]{64}$/i.test(a.commonBlockHash)||
     a.commonBlockHash.toLowerCase()!==b.commonBlockHash.toLowerCase())
     return {status:"blocked",reason:"Independent EVM block hashes do not agree."};
  if(!validateEvmHead(18881,a.timestamp,nowSeconds).ok||
     !validateEvmHead(18881,b.timestamp,nowSeconds).ok)
     return {status:"blocked",reason:"Independent EVM block timestamps are stale or invalid."};
  return {status:"verified",reason:"Two independent EVM RPC hosts agree on an actual recent canonical block hash.",
    commonBlock:a.commonBlock.toString(),blockHash:a.commonBlockHash,
    primaryHost:a.hostname,secondaryHost:b.hostname};
}
export function compareNativeProofs(a:NativeComparison,b:NativeComparison):SourceCheck {
  if(a.hostname===b.hostname)return {status:"blocked",reason:"Native evidence came from the same RPC host."};
  const expected=ULTRA_NATIVE_TESTNET.chainId;
  if(!validateNativeHead(a.chainId,expected,a.head,a.irreversible).ok||
     !validateNativeHead(b.chainId,expected,b.head,b.irreversible).ok)
     return {status:"blocked",reason:"Native chain ID or irreversible-ledger state is invalid."};
  if(a.commonBlock!==b.commonBlock || a.commonBlock>a.irreversible ||
     a.commonBlock>b.irreversible || Math.abs(a.head-b.head)>1200)
     return {status:"blocked",reason:"Native irreversible comparison heights or heads diverge."};
  if(!/^[0-9a-f]{64}$/i.test(a.commonBlockId)||
     a.commonBlockId.toLowerCase()!==b.commonBlockId.toLowerCase())
     return {status:"blocked",reason:"Native irreversible block IDs do not match."};
  return {status:"verified",reason:"Two independent native RPC hosts agree on the same irreversible Ultra Testnet block.",
    commonBlock:String(a.commonBlock),blockHash:a.commonBlockId,
    primaryHost:a.hostname,secondaryHost:b.hostname};
}
function blocked(reason:string):SourceCheck{return {status:"blocked",reason};}
async function nativePost<T>(endpoint:string,method:"get_info"|"get_block",data:object):Promise<T>{
  const res=await fetch(`${endpoint}/v1/chain/${method}`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(data),cache:"no-store",signal:AbortSignal.timeout(10000),
  });
  if(!res.ok)throw new Error("Independent native RPC unavailable.");
  return res.json() as Promise<T>;
}
export async function collectDualRpcProof(now=new Date()):Promise<DualRpcProof>{
  let evm:SourceCheck=blocked("Secondary independent EVM RPC not configured.");
  let native:SourceCheck=blocked("Secondary independent native Ultra RPC not configured.");

  const e1=process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0];
  const e2=process.env.LOOKE_M10_SECONDARY_EVM_RPC_URL||"";
  if(e2){
    try{
      const [u1,u2]=distinctSources(e1,e2);
      const first=createPublicClient({transport:http(u1.origin,{timeout:10000})});
      const second=createPublicClient({transport:http(u2.origin,{timeout:10000})});
      const [[id1,head1],[id2,head2]]=await Promise.all([
        Promise.all([first.getChainId(),first.getBlockNumber()]),
        Promise.all([second.getChainId(),second.getBlockNumber()]),
      ]);
      const height=(head1<head2?head1:head2)-2n;
      if(height<=0n)throw new Error("EVM head is too young for a common confirmed block.");
      const [block1,block2]=await Promise.all([
        first.getBlock({blockNumber:height}),second.getBlock({blockNumber:height}),
      ]);
      evm=compareEvmProofs(
        {chainId:id1,head:head1,commonBlockHash:block1.hash??"",commonBlock:height,
          timestamp:Number(block1.timestamp),hostname:u1.hostname},
        {chainId:id2,head:head2,commonBlockHash:block2.hash??"",commonBlock:height,
          timestamp:Number(block2.timestamp),hostname:u2.hostname},
        Math.floor(now.getTime()/1000),
      );
    }catch{evm=blocked("Independent EVM comparison could not validate two distinct Testnet RPC sources.");}
  }

  const n1=process.env.ULTRA_NATIVE_TESTNET_RPC_URL||ULTRA_NATIVE_TESTNET.rpc;
  const n2=process.env.LOOKE_M10_SECONDARY_NATIVE_RPC_URL||"";
  if(n2){
    try{
      const [u1,u2]=distinctSources(n1,n2);
      type Info={chain_id:string;head_block_num:number;last_irreversible_block_num:number};
      const [i1,i2]=await Promise.all([
        nativePost<Info>(u1.origin,"get_info",{}),
        nativePost<Info>(u2.origin,"get_info",{}),
      ]);
      const height=Math.min(i1.last_irreversible_block_num,i2.last_irreversible_block_num);
      if(!Number.isSafeInteger(height)||height<=0)throw new Error("No irreversible comparison block.");
      const [b1,b2]=await Promise.all([
        nativePost<{id:string}>(u1.origin,"get_block",{block_num_or_id:height}),
        nativePost<{id:string}>(u2.origin,"get_block",{block_num_or_id:height}),
      ]);
      native=compareNativeProofs(
        {chainId:i1.chain_id,head:i1.head_block_num,irreversible:i1.last_irreversible_block_num,
          commonBlockId:b1.id,commonBlock:height,hostname:u1.hostname},
        {chainId:i2.chain_id,head:i2.head_block_num,irreversible:i2.last_irreversible_block_num,
          commonBlockId:b2.id,commonBlock:height,hostname:u2.hostname},
      );
    }catch{native=blocked("Independent native comparison could not validate two distinct Testnet RPC sources.");}
  }
  return {source:"two-independent-ultra-testnet-rpcs",observedAt:now.toISOString(),
    evm,native,allVerified:evm.status==="verified"&&native.status==="verified",
    readOnly:true,transactions:0,betaActivated:false};
}
