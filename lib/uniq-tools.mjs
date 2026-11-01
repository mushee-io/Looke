import {createHash} from "node:crypto";
import {checkedUniqDraftId,normalizeUniqCollection,normalizeUniqItem,
 buildUniqManifest,MAX_UNIQ_ITEMS_PER_COLLECTION} from "./uniq-creation.mjs";

export const MAX_DRAFT_REVISION=2147483646;
export function checkedDraftRevision(value){
 if(typeof value!=="number"||!Number.isInteger(value)||
   value<1||value>MAX_DRAFT_REVISION)
   throw new RangeError("Invalid Uniq draft revision");
 return value;
}
export function normalizeCollectionEdit(input){
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new RangeError("Invalid collection edit");
 const {expectedRevision,...changes}=input;
 return {...normalizeUniqCollection(changes),
   expectedRevision:checkedDraftRevision(expectedRevision)};
}
export function normalizeUniqItemEdit(input){
 if(!input||typeof input!=="object"||Array.isArray(input))
  throw new RangeError("Invalid item edit");
 const {expectedRevision,...changes}=input;
 return {...normalizeUniqItem(changes),
  expectedRevision:checkedDraftRevision(expectedRevision)};
}
export function checksumBytes(input){
 if(typeof input!=="string")throw new RangeError("Invalid bytes");
 return createHash("sha256").update(Buffer.from(input,"utf8")).digest("hex");
}
function cleanCollection(value){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new RangeError("Invalid collection");
 const id=checkedUniqDraftId(value.id);
 const revision=checkedDraftRevision(value.revision);
 const input=normalizeUniqCollection({
   name:value.name,description:value.description,
   imageURI:value.imageURI,nativeAccount:value.nativeAccount??null,
   factoryId:value.factoryId??null
 });
 return {id,revision,...input};
}
function cleanItem(value,collectionId){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new RangeError("Invalid Uniq item");
 const id=checkedUniqDraftId(value.id),revision=checkedDraftRevision(value.revision);
 const input=normalizeUniqItem({collectionId:value.collectionId,
   name:value.name,description:value.description,imageURI:value.imageURI,
   editionLimit:String(value.editionLimit)});
 if(input.collectionId!==collectionId)throw new RangeError("Item belongs to a different collection");
 return {id,revision,...input};
}
/**
 * Portable deterministic creator export. SHA-256 proves bytes, NOT IPFS
 * pinning, native-authorized ownership, provenance or minted editions.
 */
export function buildCreatorExport(collection,items){
 const c=cleanCollection(collection);
 if(!Array.isArray(items)||items.length>MAX_UNIQ_ITEMS_PER_COLLECTION)
  throw new RangeError("Invalid number of Uniq edition drafts");
 const seen=new Set();
 const sorted=items.map(item=>cleanItem(item,c.id)).sort((a,b)=>a.id.localeCompare(b.id));
 let total=0n;
 const editions=sorted.map(item=>{
  if(seen.has(item.id))throw new RangeError("Duplicate Uniq draft ID");
  seen.add(item.id);total+=BigInt(item.editionLimit);
  const metadata=buildUniqManifest("uniq",item);
  return {
    id:item.id,revision:item.revision,
    plannedEditions:item.editionLimit,
    metadata:JSON.parse(metadata),sha256:checksumBytes(metadata)
  };
 });
 const metadata=buildUniqManifest("collection",c);
 const result={
  schema:"looke.uniq.creator-bundle.v1",
  network:"Ultra Native Testnet",
  status:"offchain_drafts_unverified",
  collection:{id:c.id,revision:c.revision,metadata:JSON.parse(metadata),
    sha256:checksumBytes(metadata)},
  items:editions,itemCount:editions.length,totalPlannedEditions:total.toString(),
  pinningVerified:false,nativeAccountVerified:false,issuedTokens:0,
  warning:"This package is offchain metadata planning, not a native NFT issuance or an IPFS pin."
 };
 const json=JSON.stringify(result);
 return {json,sha256:checksumBytes(json),itemCount:editions.length,
  totalPlannedEditions:total.toString()};
}
