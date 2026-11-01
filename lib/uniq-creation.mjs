import { checkedIpfsMetadataUri } from "./creator-coin.mjs";

export const MAX_UNIQ_COLLECTIONS=8;
export const MAX_UNIQ_ITEMS_PER_COLLECTION=50;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const NATIVE=/^[a-z1-5.]{1,12}$/;
const UINT64_MAX=18446744073709551615n;

function cleanText(value,label,minBytes,maxBytes){
 if(typeof value!=="string")throw new RangeError(label+" must be text");
 const text=value.trim();
 const bytes=new TextEncoder().encode(text).length;
 if(bytes<minBytes||bytes>maxBytes||/[\u0000-\u001f\u007f]/.test(text))
  throw new RangeError(label+" must be "+minBytes+"–"+maxBytes+" UTF-8 bytes, without control characters");
 return text;
}
function exactShape(value,keys){
 if(!value||typeof value!=="object"||Array.isArray(value)||
   Object.keys(value).some(k=>!keys.includes(k)))
  throw new RangeError("Unsupported Uniq draft fields");
}
export function checkedUniqDraftId(value){
 if(typeof value!=="string"||!UUID.test(value))throw new RangeError("Invalid draft ID");
 return value.toLowerCase();
}
export function checkedNativeAccount(value) {
 if(typeof value!=="string"||!NATIVE.test(value)||value.startsWith(".")||
   value.endsWith(".")||value.includes(".."))
  throw new RangeError("Invalid Ultra native account name");
 return value;
}
export function checkedUniqFactoryId(value){
 if(typeof value!=="string"||!/^[1-9][0-9]{0,19}$/.test(value)||
   BigInt(value)>UINT64_MAX)throw new RangeError("Invalid uint64 native Uniq factory ID");
 return value;
}
export function normalizeUniqCollection(input) {
 exactShape(input,["name","description","imageURI","nativeAccount","factoryId"]);
 const name=cleanText(input.name,"Collection name",2,80);
 const description=cleanText(input.description,"Collection description",1,1000);
 const imageURI=checkedIpfsMetadataUri(input.imageURI);
 const nativeAccount=input.nativeAccount===""||input.nativeAccount==null?
   null:checkedNativeAccount(input.nativeAccount);
 const factoryId=input.factoryId===""||input.factoryId==null?
   null:checkedUniqFactoryId(input.factoryId);
 return {name,description,imageURI,nativeAccount,factoryId};
}
export function normalizeUniqItem(input) {
 exactShape(input,["collectionId","name","description","imageURI","editionLimit"]);
 const collectionId=checkedUniqDraftId(input.collectionId);
 const name=cleanText(input.name,"Uniq name",2,80);
 const description=cleanText(input.description,"Uniq description",1,1000);
 const imageURI=checkedIpfsMetadataUri(input.imageURI);
 if(typeof input.editionLimit!=="string"||!/^[1-9][0-9]{0,5}$/.test(input.editionLimit)||
   BigInt(input.editionLimit)>100000n)
  throw new RangeError("Edition limit must be a whole number from 1 to 100,000");
 return {collectionId,name,description,imageURI,editionLimit:Number(input.editionLimit)};
}
/** Stable UTF-8 JSON manifest for IPFS pinning by the creator. Not a factory tx. */
export function buildUniqManifest(kind,input){
 if(kind!=="collection"&&kind!=="uniq")throw new RangeError("Unsupported Uniq manifest kind");
 const common={schema:"looke.uniq.metadata.v1",kind,
   name:input.name,description:input.description,image:input.imageURI};
 if(kind==="collection")return JSON.stringify({
   ...common,nativeNetwork:"Ultra Native Testnet",
   plannedNativeAccount:input.nativeAccount??null,
   plannedFactoryId:input.factoryId??null,
 });
 return JSON.stringify({...common,editionLimit:input.editionLimit});
}
export function reviewNativeUniqFactory(row,account,nowSeconds){
 const reasons=[];
 let nativeAccount;
 try{nativeAccount=checkedNativeAccount(account);}
 catch{return {eligible:false,reasons:["A valid native testnet wallet account is required"],role:"unverified"};}
 if(!row||typeof row!=="object"||Array.isArray(row))
  return {eligible:false,reasons:["No factory.b table row found"],role:"unverified"};
 const manager=typeof row.asset_manager==="string"?row.asset_manager:null;
 const creator=typeof row.asset_creator==="string"?row.asset_creator:null;
 const role=nativeAccount===manager?"manager":nativeAccount===creator?"creator_not_manager":"not_manager";
 if(role!=="manager")reasons.push("Connected account is not the factory asset manager; authorized-minter status must be verified separately");
 if(Number(row.stat)!==0)reasons.push("Uniq factory is not active");
 for(const [field,label,isStart] of [
   ["mintable_window_start","Minting window not yet open",true],
   ["mintable_window_end","Minting window closed",false]
 ]) {
  const raw=row[field];
  if(raw!==null&&raw!==undefined&&raw!==""){
   const time=Number(raw);
   if(!Number.isSafeInteger(time)||time<0)reasons.push("Invalid factory minting window");
   else if((isStart&&nowSeconds<time)||(!isStart&&nowSeconds>time))
    reasons.push(label);
  }
 }
 const maximum=row.max_mintable_tokens;
 if(maximum!==null&&maximum!==undefined){
  const max=Number(maximum), minted=Number(row.minted_tokens_no);
  if(!Number.isSafeInteger(max)||!Number.isSafeInteger(minted)||minted>=max)
   reasons.push("Mintable supply limit reached or invalid");
 }
 return {eligible:reasons.length===0,reasons,role,assetManager:manager,
   assetCreator:creator,maximumMintable:maximum??null,mintedTokens:row.minted_tokens_no??null};
}
