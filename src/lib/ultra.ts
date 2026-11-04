export const ULTRA_EVM_TESTNET = {
  chainId: 18881,
  chainIdHex: "0x49c1",
  chainName: "Ultra EVM Testnet",
  rpcUrls: ["https://evm.test.ultra.eosusa.io"],
  nativeCurrency: { name: "Ultra", symbol: "UOS", decimals: 18 },
} as const;

export const LOOKE_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_LOOKE_FACTORY_ADDRESS ?? "";

export function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
