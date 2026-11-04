import {getAddress,isAddress} from "viem";
import {positiveId,validateNativeAccount} from "../ultra-native";
export type AssetLookup=
  |{kind:"token";id:`0x${string}`;account:null}
  |{kind:"uniq";id:string;account:string};
/** Testnet-only read-only lookup. EVM address != Ultra native account. */
export function parseAssetLookup(params:URLSearchParams):AssetLookup{
 const kind=params.get("kind"),id=params.get("id")??"";
 if(kind==="token"){
   if(!isAddress(id)||/^0x0{40}$/i.test(id))throw new Error("Invalid Ultra EVM token address.");
   return {kind,id:getAddress(id),account:null};
 }
 if(kind==="uniq")return {
   kind,id:positiveId(id),account:validateNativeAccount(params.get("account")??""),
 };
 throw new Error("Asset kind must be token or uniq.");
}
export type AssetProof={
 kind:"token"|"uniq";id:string;network:"Ultra EVM Testnet"|"Ultra native Testnet";
 verified:boolean;status:"verified"|"unconfigured"|"unindexed"|"unavailable";
 proof:string;block:string|null;source:string|null;
 /** Not proof of EVM user identity or authorization to transfer assets. */
 owner:string|null;transactionsSent:0;
};
