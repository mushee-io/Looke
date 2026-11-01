export const ULTRA_EVM_TESTNET_HEX: string;
export const ULTRA_NATIVE_TESTNET_ID: string;
export function checkedEvmSnapshot(accounts: unknown, chainId: unknown, expectedChain?: string): string;
export function checkedNativeConnect(data: unknown, chainId: unknown, expectedChain?: string): string;
export function sameEvmAccount(a: unknown, b: unknown): boolean;
