import "server-only";
import { createPublicClient, defineChain, http } from "viem";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
export const ultraTestChain=defineChain({
  id: ULTRA_EVM_TESTNET.chainId,
  name: "Ultra EVM Testnet",
  nativeCurrency:{name:"Ultra",symbol:"UOS",decimals:18},
  rpcUrls:{default:{http:[ULTRA_EVM_TESTNET.rpc]}},
  blockExplorers:{default:{name:"Ultra EVM Explorer",url:ULTRA_EVM_TESTNET.explorer}},
  testnet:true
});
export const ultraClient=createPublicClient({chain:ultraTestChain,transport:http(ULTRA_EVM_TESTNET.rpc,{timeout:8000})});
