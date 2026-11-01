import {checkedNativeAccount,checkedUniqFactoryId} from "./uniq-creation.mjs";
export const MARKET_PAGE_SIZE=6;
export const MARKET_REVIEW_TTL_MS=15_000;
const UINT64_MAX=18446744073709551615n;

/** Exact Antelope uint64 identity without unsafe Number coercion. */
export function checkedUniqTokenId(raw){
 if(typeof raw==="number"){
  if(!Number.isSafeInteger(raw)||raw<=0)throw new RangeError("Unsafe native Uniq token ID");
  raw=String(raw);
 }
 return checkedUniqFactoryId(raw);
}
export function checkedMarketCursor(raw){
 if(raw===null||raw===undefined||raw==="")return null;
 return checkedUniqTokenId(raw);
}
/** Reads actual eosio::asset strings without rounding prices through floats. */
export function parseNativeSalePrice(raw){
 if(typeof raw!=="string")throw new RangeError("Unrecognized native resale asset");
 const match=/^([0-9]{1,19})(?:\.([0-9]{1,8}))? ([A-Z]{1,7})$/.exec(raw);
 if(!match)throw new RangeError("Invalid native resale asset format");
 const [ ,whole,fraction="",currency]=match;
 const decimals=fraction.length;
 const units=BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction||"0");
 if(units<=0n||units>UINT64_MAX)throw new RangeError("Invalid native resale price amount");
 return {amount:raw,amountRaw:units.toString(),currency,decimals};
}
export function validateResaleRow(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new RangeError("Invalid resale table row");
 const tokenId=checkedUniqTokenId(raw.token_id);
 const owner=checkedNativeAccount(raw.owner);
 const price=parseNativeSalePrice(raw.price);
 const promoter=raw.promoter_basis_point;
 if(typeof promoter!=="number"||!Number.isSafeInteger(promoter)||promoter<0||promoter>10000)
  throw new RangeError("Invalid promoter fee basis points");
 return {tokenId,owner,price,promoterBasisPoints:promoter};
}
export function verifyResaleOwnership(resale,tokenRow){
 const listing=validateResaleRow(resale);
 if(!tokenRow||typeof tokenRow!=="object"||Array.isArray(tokenRow)||
    checkedUniqTokenId(tokenRow.id)!==listing.tokenId)
  throw new RangeError("Resale listing cannot be matched to a current token.b owner record");
 const factoryId=checkedUniqFactoryId(
  typeof tokenRow.token_factory_id==="number" ? checkedUniqTokenId(tokenRow.token_factory_id):tokenRow.token_factory_id
 );
 const serial=tokenRow.serial_number;
 if(!(typeof serial==="number"&&Number.isSafeInteger(serial)&&serial>=0) &&
    !(typeof serial==="string"&&/^(0|[1-9][0-9]{0,9})$/.test(serial)))
   throw new RangeError("Missing valid native Uniq serial");
 return {...listing,factoryId,serialNumber:String(serial),
  nativeOwnerCrosschecked:true,assetPriceVerified:true,
  marketplace:"Ultra native eosio.nft.ft resale.a",transactionEnabled:false};
}
export function validateMarketIntent(intent,account,listing,ownedUnlisted){
 if(!["buy","cancel","list"].includes(intent))throw new RangeError("Unknown market review action");
 const nativeAccount=checkedNativeAccount(account);
 let reasons=[];
 if(intent==="list"){
  if(!ownedUnlisted||ownedUnlisted.owner!==nativeAccount)
   reasons.push("No matching unlisted native Uniq was found in this account's token.b table");
  if(listing)reasons.push("Uniq is already in the resale table");
 }else{
  if(!listing)reasons.push("Token is not in the current native resale table");
  else{
   if(!listing.nativeOwnerCrosschecked)reasons.push("Resale owner has not been matched to token.b");
   if(intent==="buy"&&listing.owner===nativeAccount)
    reasons.push("A seller cannot buy their own Uniq");
   if(intent==="cancel"&&listing.owner!==nativeAccount)
    reasons.push("Only the onchain listed seller can cancel");
  }
 }
 return {intent,account:nativeAccount,conditionsMet:reasons.length===0,
  reasons,walletOwnershipVerified:false,
  contractExecutionSimulationVerified:false,feesFullyVerified:false,
  executionEnabled:false};
}
export function nextMarketCursor(rows,more,nextKey){
 if(more!==true)return null;
 if(nextKey!==null&&nextKey!==undefined&&nextKey!==""){
  const key=checkedUniqTokenId(nextKey);
  if(rows.length && BigInt(key)<=BigInt(checkedUniqTokenId(rows[rows.length-1].token_id)))
   throw new RangeError("Non-progressing resale pagination cursor");
  return key;
 }
 if(!rows.length)throw new RangeError("Missing resale pagination cursor");
 const last=BigInt(checkedUniqTokenId(rows[rows.length-1].token_id));
 if(last>=UINT64_MAX)return null;
 return (last+1n).toString();
}
