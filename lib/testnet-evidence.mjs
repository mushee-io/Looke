/**
 * M21 fail-closed testnet transaction corroboration. This is a receipt check,
 * not an independent contract audit, governance approval or wallet consent.
 */
const HASH=/^0x[0-9a-f]{64}$/i;
const ADDRESS=/^0x[0-9a-f]{40}$/i;
export const TESTNET_EVIDENCE_CHAIN_ID=18881;
export const TESTNET_EVIDENCE_DEPTH=12;
export const MAX_RECEIPT_LOGS=128;

export function checkedEvidenceHash(value){
 if(typeof value!=="string"||!HASH.test(value))
  throw new RangeError("Expected a 32-byte EVM transaction hash");
 return value.toLowerCase();
}
export function checkedEvidenceAddress(value){
 if(typeof value!=="string"||!ADDRESS.test(value)||
    /^0x0{40}$/i.test(value))
  throw new RangeError("Expected a non-zero EVM address");
 return value.toLowerCase();
}
export function checkedIndependentRpc(value,primary){
 if(typeof value!=="string"||!value)throw new RangeError("Secondary testnet RPC is not configured");
 let url,p;
 try{url=new URL(value);p=new URL(primary);}catch{throw new RangeError("Invalid RPC URL");}
 if(url.protocol!=="https:"||url.username||url.password||url.hash||
    !url.hostname||url.port||!url.pathname.startsWith("/")||
    /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(url.hostname)||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||url.hostname.includes(":")||
    url.hostname===p.hostname)
  throw new RangeError("Independent RPC requires a different public HTTPS hostname");
 if(url.href.length>512)throw new RangeError("RPC URL too long");
 return url.toString();
}
function safeNumber(value,name){
 if(typeof value!=="bigint"&&
    !(typeof value==="number"&&Number.isSafeInteger(value)))
  throw new RangeError("Invalid "+name);
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw new RangeError("Invalid "+name);
 return n;
}
function checkedLog(log,hash,blockHash,source,eventSelector){
 if(!log||typeof log!=="object"||Array.isArray(log))
  throw new RangeError("Malformed receipt event");
 if(checkedEvidenceHash(log.transactionHash)!==hash||
    checkedEvidenceHash(log.blockHash)!==blockHash)
  throw new RangeError("Event is not in the submitted transaction and block");
 if(!Array.isArray(log.topics)||log.topics.length<1||log.topics.length>4||
    log.topics.some(t=>typeof t!=="string"||!HASH.test(t))||
    typeof log.data!=="string"||!/^0x(?:[0-9a-f]{2})*$/i.test(log.data))
  throw new RangeError("Malformed event encoding");
 const index=safeNumber(log.logIndex,"log index");
 return {
  address:checkedEvidenceAddress(log.address),
  transactionHash:hash,blockHash,index,
  topics:log.topics.map(t=>t.toLowerCase()),data:log.data.toLowerCase(),
  isTarget:checkedEvidenceAddress(log.address)===source&&
    log.topics[0].toLowerCase()===eventSelector
 };
}
function extract(snapshot,args){
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot)||
    snapshot.chainId!==TESTNET_EVIDENCE_CHAIN_ID)
  throw new RangeError("Wrong testnet chain");
 const {transaction:tx,receipt,block,head,code}=snapshot;
 const hash=checkedEvidenceHash(args.txHash);
 const source=checkedEvidenceAddress(args.source);
 const expectedFrom=args.expectedFrom?checkedEvidenceAddress(args.expectedFrom):null;
 if(!tx||!receipt||!block)throw new RangeError("Missing transaction, receipt or canonical block");
 const signer=checkedEvidenceAddress(tx.from);
 if(expectedFrom&&signer!==expectedFrom)throw new RangeError("Unexpected transaction signer");
 if(checkedEvidenceHash(tx.hash)!==hash||
    checkedEvidenceHash(receipt.transactionHash)!==hash)
  throw new RangeError("Transaction and receipt hash mismatch");
 if(receipt.status!=="success")throw new RangeError("Transaction reverted or failed");
 const height=safeNumber(receipt.blockNumber,"receipt block");
 if(safeNumber(tx.blockNumber,"transaction block")!==height||
    safeNumber(block.number,"canonical block")!==height)
  throw new RangeError("Receipt is not in the claimed chain height");
 const blockHash=checkedEvidenceHash(receipt.blockHash);
 if(checkedEvidenceHash(tx.blockHash)!==blockHash||
    checkedEvidenceHash(block.hash)!==blockHash)
  throw new RangeError("Reorganization or mismatched canonical block");
 const headNumber=safeNumber(head,"observed chain head");
 if(headNumber<height||headNumber-height<TESTNET_EVIDENCE_DEPTH)
  throw new RangeError("Receipt does not have twelve confirmations");
 if(typeof code!=="string"||!/^0x[0-9a-f]+$/i.test(code)||
    code==="0x"||code.length%2!==0||code.length>100_000)
  throw new RangeError("Configured contract bytecode missing or malformed");
 if(!Array.isArray(receipt.logs)||receipt.logs.length>MAX_RECEIPT_LOGS)
  throw new RangeError("Receipt logs unavailable or too large");
 const events=receipt.logs.map(l=>checkedLog(l,hash,blockHash,source,args.eventSelector));
 const matching=events.filter(x=>x.isTarget);
 if(!matching.length)throw new RangeError("Target event absent from actual receipt");
 if(args.kind==="factory"&&checkedEvidenceAddress(tx.to)!==source)
  throw new RangeError("Factory launch transaction was not addressed to configured factory");
 return {hash,signer,height,blockHash,code:code.toLowerCase(),
  transactionTo:tx.to===null?null:checkedEvidenceAddress(tx.to),
  events,matching:matching.map(e=>({index:e.index,topics:e.topics,data:e.data}))};
}
/** Both explicitly configured nodes must independently agree on chain, block,
 * signer, successful receipt, target event, complete log contents and code.
 */
export function corroborateTestnetReceipt(primary,secondary,args){
 if(!args||!["factory","swaps"].includes(args.kind))
  throw new RangeError("Unsupported evidence stream");
 const expected={...args,txHash:checkedEvidenceHash(args.txHash),
  source:checkedEvidenceAddress(args.source),
  eventSelector:checkedEvidenceHash(args.eventSelector)};
 const a=extract(primary,expected),b=extract(secondary,expected);
 if(a.hash!==b.hash||a.blockHash!==b.blockHash||a.height!==b.height||
    a.signer!==b.signer||a.transactionTo!==b.transactionTo||
    a.code!==b.code||JSON.stringify(a.events)!==JSON.stringify(b.events))
  throw new RangeError("RPC sources disagree on a transaction, event, or source code");
 return {
  chainId:TESTNET_EVIDENCE_CHAIN_ID,txHash:a.hash,source:expected.source,
  kind:expected.kind,transactionSigner:a.signer,
  blockNumber:String(a.height),blockHash:a.blockHash,
  eventLogIndexes:a.matching.map(x=>x.index),
  confirmationDepthAtLeast:TESTNET_EVIDENCE_DEPTH,
  independentRpcsAgreed:true,
  codeMatchAtObservedBlock:true,
  transactionStatus:"success",
  contentAuthorizationVerified:false,marketOriginAudited:false,
  userWalletConsentProved:false,safeForMainnet:false,
  warning:"Two configured RPC endpoints agree on a 12-confirmed event; not proof of authorized content, contract audit, economic safety, or final settlement."
 };
}
export function acceptanceGate({
 stagingDeployed=false,independentSecurityAudit=false,
 creatorAuthorizationFixed=false,nativeWalletIdentityTested=false,
 realTradingReceiptsReviewed=false,incidentRunbookApproved=false
}={}){
 const conditions={stagingDeployed,independentSecurityAudit,
  creatorAuthorizationFixed,nativeWalletIdentityTested,
  realTradingReceiptsReviewed,incidentRunbookApproved};
 const pending=Object.entries(conditions).filter(([,ok])=>ok!==true).map(([k])=>k);
 return {approved:false,mainnetReady:false,tradingEnabled:false,
  pending,reason:"Manual independent approvals and separately enforced trading authorization are required. This evidence utility has no enabling path."};
}
