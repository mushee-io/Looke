import {checkedNativeAccount,checkedUniqFactoryId} from "./uniq-creation.mjs";
import {checkedUniqTokenId} from "./uniq-market.mjs";

const ADDRESS=/^0x[0-9a-f]{40}$/i;
const HASH=/^0x[0-9a-f]{64}$/i;
export const MAX_PORTFOLIO_TOKENS=8;
export const NATIVE_PAGE_SIZE=20;
export const ACTIVITY_BLOCK_WINDOW=250n;

export function checkedEvmWallet(raw){
 if(typeof raw!=="string"||!ADDRESS.test(raw))throw new RangeError("Invalid Ultra EVM wallet address");
 return raw.toLowerCase();
}
export function configuredPortfolioTokens(raw){
 if(typeof raw!=="string")throw new RangeError("Invalid portfolio token config");
 if(!raw.trim())return [];
 const parts=raw.split(",").map(s=>s.trim());
 if(parts.length>MAX_PORTFOLIO_TOKENS||
   parts.some(p=>!ADDRESS.test(p)||/^0x0{40}$/i.test(p)))
   throw new RangeError("Only 1–8 valid explicitly configured EVM token addresses are supported");
 const lower=parts.map(p=>p.toLowerCase());
 if(new Set(lower).size!==lower.length)throw new RangeError("Duplicate asset allowlist entries");
 return lower;
}
export function checkedAssetRaw(value){
 if(typeof value!=="bigint"||value<0n||value>=2n**256n)
  throw new RangeError("Invalid raw balance");
 return value.toString();
}
export function checkedNativePortfolioRow(value){
 if(!value||typeof value!=="object"||Array.isArray(value))
  throw new RangeError("Malformed owner-scoped native token.b record");
 const tokenId=checkedUniqTokenId(value.id);
 const factoryId=checkedUniqFactoryId(typeof value.token_factory_id==="number"
  ?checkedUniqTokenId(value.token_factory_id):value.token_factory_id);
 const serial=value.serial_number;
 if(!(typeof serial==="number"&&Number.isSafeInteger(serial)&&serial>=0) &&
    !(typeof serial==="string"&&/^(0|[1-9][0-9]{0,19})$/.test(serial)))
   throw new RangeError("Invalid native Uniq serial");
 return {tokenId,factoryId,serialNumber:String(serial)};
}
export function checkedNativePortfolioCursor(raw){
 if(raw===null||raw===undefined||raw==="")return null;
 return checkedUniqTokenId(raw);
}
export function nativePortfolioNextCursor(rows,more,nextKey){
 if(more!==true)return null;
 if(nextKey!==null&&nextKey!==undefined&&nextKey!==""){
  const next=checkedUniqTokenId(nextKey);
  if(rows.length && BigInt(next)<=BigInt(checkedUniqTokenId(rows[rows.length-1].id)))
   throw new RangeError("Non-advancing native token.b cursor");
  return next;
 }
 if(!rows.length)throw new RangeError("Native API did not provide a usable cursor");
 const last=BigInt(checkedUniqTokenId(rows[rows.length-1].id));
 return last<(2n**64n-1n)?(last+1n).toString():null;
}
export function confirmedActivityWindow(head,confirmations=12n){
 if(typeof head!=="bigint"||head<0n||typeof confirmations!=="bigint"||confirmations<1n)
  throw new RangeError("Invalid EVM finality window");
 if(head<confirmations)return null;
 const end=head-confirmations;
 return {fromBlock:end>=ACTIVITY_BLOCK_WINDOW-1n?end-(ACTIVITY_BLOCK_WINDOW-1n):0n,
   toBlock:end,confirmationDepth:confirmations};
}
export function normalizePortfolioTransfer(event,wallet){
 const address=checkedEvmWallet(wallet);
 if(!event||typeof event!=="object"||Array.isArray(event)||
    !ADDRESS.test(event.token??"")||!ADDRESS.test(event.from??"")||
    !ADDRESS.test(event.to??"")||!HASH.test(event.txHash??"")||
    typeof event.blockNumber!=="bigint"||event.blockNumber<0n||
    !Number.isSafeInteger(event.logIndex)||event.logIndex<0)
    throw new RangeError("Malformed ERC-20 transfer log");
 const from=event.from.toLowerCase(),to=event.to.toLowerCase();
 if(from!==address&&to!==address)throw new RangeError("Transfer unrelated to wallet");
 const value=checkedAssetRaw(event.value);
 return {token:event.token.toLowerCase(),from,to,txHash:event.txHash.toLowerCase(),
  blockNumber:event.blockNumber.toString(),logIndex:event.logIndex,valueRaw:value,
  direction:from===address&&to===address?"self":to===address?"in":"out"};
}
export function orderedUniqueTransfers(events,max=40){
 if(!Array.isArray(events)||!Number.isInteger(max)||max<1||max>100)
  throw new RangeError("Invalid portfolio activity page");
 const seen=new Set();
 return events.filter(e=>{
  const key=e.token+":"+e.txHash+":"+e.logIndex;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).sort((a,b)=>{
  const block=BigInt(b.blockNumber)-BigInt(a.blockNumber);
  return block>0n?1:block<0n?-1:b.logIndex-a.logIndex;
 }).slice(0,max);
}
export function nativeAccountPortfolioLabel(account){
 return checkedNativeAccount(account);
}
