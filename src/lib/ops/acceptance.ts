import { getAddress, isAddress } from "viem";

export type ProofManifest = {
  evmFactory: {address:`0x${string}`;deploymentTx:`0x${string}`};
  creatorCoin: {creationTx:`0x${string}`};
  nativeUniq: {factoryId:string;tokenId:string;owner:string};
};
function object(value:unknown,label:string):Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(label+" must be an object.");
  return value as Record<string,unknown>;
}
function address(value:unknown):`0x${string}` {
  if(typeof value!=="string"||!isAddress(value)||/^0x0{40}$/i.test(value))
    throw new Error("A nonzero Ultra EVM contract address is required.");
  return getAddress(value);
}
function txHash(value:unknown):`0x${string}` {
  if(typeof value!=="string"||!/^0x[0-9a-fA-F]{64}$/.test(value)||/^0x0{64}$/i.test(value))
    throw new Error("A real-shaped, nonzero transaction hash is required.");
  return value as `0x${string}`;
}
function id(value:unknown):string {
  if(typeof value!=="string"||!/^[1-9][0-9]{0,15}$/.test(value)||
     !Number.isSafeInteger(Number(value)))throw new Error("Native factory/token IDs must be positive decimal strings.");
  return value;
}
function account(value:unknown):string {
  if(typeof value!=="string"||!/^[a-z1-5.]{1,12}$/.test(value)||
     value.startsWith(".")||value.endsWith("."))throw new Error("Native Ultra account name invalid.");
  return value;
}
export function parseProofManifest(raw:unknown):ProofManifest {
  const m=object(raw,"Proof manifest");
  const factory=object(m.evmFactory,"evmFactory");
  const coin=object(m.creatorCoin,"creatorCoin");
  const uniq=object(m.nativeUniq,"nativeUniq");
  return {
    evmFactory:{address:address(factory.address),deploymentTx:txHash(factory.deploymentTx)},
    creatorCoin:{creationTx:txHash(coin.creationTx)},
    nativeUniq:{factoryId:id(uniq.factoryId),tokenId:id(uniq.tokenId),owner:account(uniq.owner)},
  };
}
export type AcceptanceResult = {
  testedAt:string;
  readOnly:true;
  betaActivated:false;
  results:Array<{id:"factory"|"creatorCoin"|"nativeUniq";status:"verified"|"blocked";reason:string}>;
};
export function summarizeProofs(results:AcceptanceResult["results"],now=new Date()):AcceptanceResult {
  const ids=new Set(results.map(x=>x.id));
  if(results.length!==3||ids.size!==3||!["factory","creatorCoin","nativeUniq"].every(id=>ids.has(id as AcceptanceResult["results"][number]["id"])))
    throw new Error("All three independent proof checks must be reported.");
  return {testedAt:now.toISOString(),readOnly:true,betaActivated:false,results};
}
