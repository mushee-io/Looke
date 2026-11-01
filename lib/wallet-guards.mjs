/**
 * Validate untrusted injected wallet responses before allowing Looke to display
 * a testnet connection. These are public-identity checks, NOT signatures.
 */
export const ULTRA_EVM_TESTNET_HEX = "0x49c1";
export const ULTRA_NATIVE_TESTNET_ID = "7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9";

export function checkedEvmSnapshot(accounts, chainId, expectedChain = ULTRA_EVM_TESTNET_HEX) {
  if (typeof chainId !== "string" || chainId.toLowerCase() !== expectedChain.toLowerCase())
    throw new Error("Wrong EVM chain: Ultra EVM testnet required.");
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" ||
      !/^0x[a-fA-F0-9]{40}$/.test(accounts[0]))
    throw new Error("No valid EVM wallet account is connected.");
  return accounts[0].toLowerCase();
}

export function checkedNativeConnect(data, chainId, expectedChain = ULTRA_NATIVE_TESTNET_ID) {
  // Ultra SDK blockchainid is an ACCOUNT NAME, not a blockchain chain ID.
  if (typeof chainId !== "string" || chainId !== expectedChain)
    throw new Error("Wrong native Ultra chain: testnet required.");
  if (!data || typeof data.blockchainid !== "string" ||
      !/^[a-z1-5.]{1,12}$/.test(data.blockchainid))
    throw new Error("No valid native Ultra account was returned.");
  if (data.selectedAccount?.accountName &&
      data.selectedAccount.accountName !== data.blockchainid)
    throw new Error("Selected native account differs from the returned account.");
  if (data.network?.chainId && data.network.chainId !== expectedChain)
    throw new Error("Native Ultra wallet network changed during connection.");
  return data.blockchainid;
}

export function sameEvmAccount(a, b) {
  return typeof a === "string" && typeof b === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(a) && a.toLowerCase() === b.toLowerCase();
}
