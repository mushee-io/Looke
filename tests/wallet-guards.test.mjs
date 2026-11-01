import test from "node:test";
import assert from "node:assert/strict";
import { checkedEvmSnapshot, checkedNativeConnect, sameEvmAccount,
  ULTRA_EVM_TESTNET_HEX, ULTRA_NATIVE_TESTNET_ID } from "../lib/wallet-guards.mjs";
const ADDRESS = "0xAabbccddeeff0011223344556677889900aAbBcC";
const ACCOUNT = "aa1aa2aa3aa";

test("accepts only a syntactically valid Ultra EVM testnet account", () => {
  assert.equal(checkedEvmSnapshot([ADDRESS],ULTRA_EVM_TESTNET_HEX), ADDRESS.toLowerCase());
  assert.equal(checkedEvmSnapshot([ADDRESS],"0X49C1".toLowerCase()), ADDRESS.toLowerCase());
  assert.throws(()=>checkedEvmSnapshot([ADDRESS],"0x4e17"),/Wrong EVM chain/);
  assert.throws(()=>checkedEvmSnapshot([ADDRESS],"0x00"),/Wrong EVM chain/);
  assert.throws(()=>checkedEvmSnapshot([],"0x49c1"),/No valid EVM/);
  assert.throws(()=>checkedEvmSnapshot(["0x123"],"0x49c1"),/No valid EVM/);
  assert.throws(()=>checkedEvmSnapshot(null,"0x49c1"),/No valid EVM/);
});
test("sameEvmAccount is case-insensitive, but does not accept malformed addresses", () => {
  assert.equal(sameEvmAccount(ADDRESS,ADDRESS.toLowerCase()),true);
  assert.equal(sameEvmAccount(ADDRESS,"0x0000000000000000000000000000000000000001"),false);
  assert.equal(sameEvmAccount("0x123","0x123"),false);
});
test("native testnet chain is checked separately from account name", () => {
  const data={blockchainid:ACCOUNT,publicKey:"EOS123",selectedAccount:{accountName:ACCOUNT},network:{name:"testnet",chainId:ULTRA_NATIVE_TESTNET_ID}};
  assert.equal(checkedNativeConnect(data,ULTRA_NATIVE_TESTNET_ID),ACCOUNT);
  assert.throws(()=>checkedNativeConnect(data,"a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097"),/Wrong native Ultra chain/);
  assert.throws(()=>checkedNativeConnect({...data,network:{chainId:"mainnet"}},ULTRA_NATIVE_TESTNET_ID),/network changed/);
  assert.throws(()=>checkedNativeConnect({...data,selectedAccount:{accountName:"different"}},ULTRA_NATIVE_TESTNET_ID),/Selected native account/);
  assert.throws(()=>checkedNativeConnect({...data,blockchainid:"wallet!"},ULTRA_NATIVE_TESTNET_ID),/No valid native/);
  assert.throws(()=>checkedNativeConnect(null,ULTRA_NATIVE_TESTNET_ID),/No valid native/);
});
