import { getAddress } from "viem";
import { assertAddress, assertHash, assertConfirmations, assertUltraTestnet, createUltraPublicClient, decodeCoinCreatedFromReceipt, verifyCreatedCoinState, verifyFactoryDeployment } from "../verification";
import { getFactory, getNativeTestnetInfo, ownedUniqs } from "../ultra-native-rpc";
import { positiveId, validateNativeAccount } from "../ultra-native";
import { ULTRA_EVM_TESTNET } from "../ultra";
import { verifiedTargetUniq } from "../ops/m10-uniq";

/** Read-only independent checks. These functions never sign or broadcast transactions. */
export async function inspectEvmFactory(address:string,txHash:string) {
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  const proof=await verifyFactoryDeployment(client,address,txHash);
  return {chainId:18881,address:proof.address,transactionHash:proof.transactionHash,
    confirmations:proof.confirmations,coinCount:proof.coinCount.toString()};
}

export async function inspectEvmCoin(factory:string,txHash:string) {
  assertAddress(factory);assertHash(txHash);
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  await assertUltraTestnet(client);
  const receipt=await client.getTransactionReceipt({hash:txHash});
  const latest=await client.getBlockNumber();
  const confirmations=assertConfirmations(receipt.blockNumber,latest);
  const event=decodeCoinCreatedFromReceipt(receipt,getAddress(factory));
  const state=await verifyCreatedCoinState(client,event);
  return {
    chainId:18881,txHash:receipt.transactionHash,confirmations,coin:event.coin,
    creator:event.creator,name:event.name,symbol:event.symbol,
    totalSupply:state.totalSupply.toString(),creatorBalance:state.balance.toString(),
    metadataURI:state.metadataURI,
  };
}

export async function inspectNativeUniq(factoryId:string,owner:string,tokenId:string) {
  const id=positiveId(factoryId);
  const account=validateNativeAccount(owner);
  const token=positiveId(tokenId);
  const info=await getNativeTestnetInfo();
  const [factory,owned]=await Promise.all([getFactory(id),ownedUniqs(account,1,token)]);
  if(!factory.factory)throw new Error("Native Testnet factory was not found.");
  // Primary-index exact lower_bound read: no page-1 assumption for large wallets.
  const uniq=verifiedTargetUniq(owned,token,id);
  return {
    chainId:info.chain_id,
    irreversibleBlock:Math.min(info.last_irreversible_block_num,factory.irreversibleBlock,owned.irreversibleBlock),
    owner:account,factoryId:id,tokenId:token,uniq,
    factoryCreator:factory.factory.asset_creator,factoryManager:factory.factory.asset_manager,
  };
}
