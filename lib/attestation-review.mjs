import { getAddress, hashTypedData, isAddress, keccak256, toBytes, zeroAddress } from "viem";
import { contentSnapshot } from "./content-coin.mjs";
import { normalizeCreatorCoinDraft } from "./creator-coin.mjs";

/**
 * M21 operator-only UNSIGNED evidence preparation. No credential, wallet,
 * signing, approval, execution, or issuance code belongs in this module.
 */
export const ATTESTATION_CHAIN_ID=18881;
export const ATTESTATION_CONFIRMATIONS=12n;
export const ATTESTATION_TTL_SECONDS=300n;
export const AUTH_TYPES=Object.freeze({CoinAuthorization:[
  {name:"creator",type:"address"},
  {name:"kind",type:"uint8"},
  {name:"contentRef",type:"bytes32"},
  {name:"nameHash",type:"bytes32"},
  {name:"symbolHash",type:"bytes32"},
  {name:"initialSupplyTokens",type:"uint256"},
  {name:"metadataHash",type:"bytes32"},
  {name:"nonce",type:"uint256"},
  {name:"deadline",type:"uint256"}
]});
const HASH=/^0x[0-9a-f]{64}$/i;
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const checkedAddress=(v,label)=>{
 if(typeof v!=="string"||!isAddress(v,{strict:false})||v.toLowerCase()===zeroAddress)
  throw new RangeError("Invalid "+label);
 return getAddress(v);
};
const checkedHash=(v,label)=>{
 if(typeof v!=="string"||!HASH.test(v)||/^0x0{64}$/i.test(v))
  throw new RangeError("Invalid "+label);
 return v.toLowerCase();
};
const decimal=(v,label)=>{
 if(typeof v!=="bigint" && (typeof v!=="string"|| !/^(0|[1-9][0-9]{0,39})$/.test(v)))
  throw new RangeError("Invalid "+label);
 const n=BigInt(v);
 if(n<0n||n>2n**256n-1n)throw new RangeError("Invalid "+label);
 return n;
};
function sameTime(a,b){
 const parse=v=>v==null?null:new Date(v).toISOString();
 return parse(a)===parse(b);
}

/** Check the actual JOINed post/draft snapshot; user-supplied owner claims
 * and unchecked or hidden posts are never acceptable source evidence.
 */
export function reviewedContentSource(row){
 if(!row || typeof row!=="object" || !UUID.test(row.post_id??"") ||
    !row.profile_id || row.profile_id!==row.post_profile_id ||
    row.profile_id!==row.draft_profile_id ||
    row.moderation_status!=="visible" ||
    row.ref_version!=="looke.content.v1" ||
    typeof row.post_text!=="string" || row.post_text.trim()==="" ||
    !Number.isSafeInteger(Number(row.report_count)) ||
    Number(row.report_count)!==0)
  throw new RangeError("Post source not eligible for operator review");
 const wallet=checkedAddress(row.profile_evm_address,"profile wallet");
 if(checkedAddress(row.creator_address,"draft wallet")!==wallet)
  throw new RangeError("Draft wallet ownership mismatch");
 if(!sameTime(row.source_edited_at,row.current_edited_at))
  throw new RangeError("Draft revision is stale");
 const snapshot=contentSnapshot(row.post_id,wallet,row.post_text,row.current_edited_at);
 if(checkedHash(row.content_ref,"content reference")!==snapshot.contentRef ||
    checkedHash(row.source_text_hash,"source text hash")!==snapshot.textHash)
  throw new RangeError("Draft post snapshot is stale or tampered");
 const draft=normalizeCreatorCoinDraft({
  name:row.name,symbol:row.symbol,
  supplyTokens:String(row.supply_tokens),metadataURI:row.metadata_uri
 });
 return {postId:row.post_id.toLowerCase(),creator:wallet,kind:1,
  contentRef:snapshot.contentRef,sourceTextHash:snapshot.textHash,
  name:draft.name,symbol:draft.symbol,initialSupplyTokens:BigInt(draft.supplyTokens),
  metadataURI:draft.metadataURI};
}

/**
 * Both nodes MUST agree at the exact same canonical block. These observations
 * are provided by independently configured RPC clients, not by the browser.
 * Pinned on-chain code hash prevents a random EVM contract from being treated
 * as an authorized issuance factory.
 */
export function verifiedFactoryObservations(first,second,configuration){
 const factory=checkedAddress(configuration?.factory,"factory address");
 const attestor=checkedAddress(configuration?.attestor,"attestor address");
 const expectedCodeHash=checkedHash(configuration?.codeHash,"pinned code hash");
 const check=x=>{
  if(x?.chainId!==ATTESTATION_CHAIN_ID || typeof x?.blockHash!=="string"||
     !HASH.test(x.blockHash) || typeof x?.code!=="string" ||
     !/^0x(?:[0-9a-f]{2})+$/i.test(x.code) || x.code.length>100000 ||
     checkedAddress(x.attestor,"observed attestor")!==attestor ||
     decimal(x.nonce,"nonce")>2n**64n ||
     checkedAddress(x.existingCoin??zeroAddress,"existing coin")!==zeroAddress)
    throw new RangeError("Factory on-chain state not eligible");
 };
 // For empty referenceCoinFor, zero address is required; never accept missing.
 const validate=x=>{
  if(x?.chainId!==ATTESTATION_CHAIN_ID||typeof x?.blockHash!=="string"||
     !HASH.test(x.blockHash)||typeof x?.code!=="string"||
     !/^0x(?:[0-9a-f]{2})+$/i.test(x.code) ||x.code.length>100000 ||
     checkedAddress(x.attestor,"observed attestor")!==attestor||
     typeof x.existingCoin!=="string"||x.existingCoin.toLowerCase()!==zeroAddress||
     decimal(x.nonce,"observed nonce")>2n**64n)
    throw new RangeError("Factory source, attestor, nonce or reference not verified");
  if(keccak256(x.code).toLowerCase()!==expectedCodeHash)
   throw new RangeError("Factory bytecode does not match pinned independent hash");
 };
 validate(first);validate(second);
 if(first.blockHash.toLowerCase()!==second.blockHash.toLowerCase()||
    first.code.toLowerCase()!==second.code.toLowerCase()||
    BigInt(first.nonce)!==BigInt(second.nonce) ||
    first.attestor.toLowerCase()!==second.attestor.toLowerCase() ||
    first.existingCoin.toLowerCase()!==second.existingCoin.toLowerCase())
  throw new RangeError("Independent RPC factory observations disagree");
 const observedAt=decimal(first.blockTimestamp,"block timestamp");
 if(observedAt===0n)throw new RangeError("Missing canonical block timestamp");
 return {factory,attestor,codeHash:expectedCodeHash,nonce:BigInt(first.nonce),
  blockHash:first.blockHash.toLowerCase(),observedAt};
}

/** Never returns an attestor signature. The material is informational until
 * external human review and explicit offline signer policy approval.
 */
export function unsignedContentPermit(source,observed){
 const creator=checkedAddress(source.creator,"creator address");
 const factory=checkedAddress(observed.factory,"verified factory");
 const attestor=checkedAddress(observed.attestor,"verified attestor");
 if(source.kind!==1)throw new RangeError("Only content review is supported");
 const ref=checkedHash(source.contentRef,"content reference");
 const draft=normalizeCreatorCoinDraft({name:source.name,symbol:source.symbol,
  supplyTokens:String(source.initialSupplyTokens),metadataURI:source.metadataURI});
 const nonce=decimal(observed.nonce,"observed nonce");
 const at=decimal(observed.observedAt,"observation timestamp");
 if(at<=0n)throw new RangeError("Untrusted chain timestamp");
 const deadline=at+ATTESTATION_TTL_SECONDS;
 const data={
  domain:{name:"LookeCoinFactory",version:"1",
   chainId:ATTESTATION_CHAIN_ID,verifyingContract:factory},
  primaryType:"CoinAuthorization",
  types:AUTH_TYPES,
  message:{
   creator,kind:1,contentRef:ref,
   nameHash:keccak256(toBytes(draft.name)),
   symbolHash:keccak256(toBytes(draft.symbol)),
   initialSupplyTokens:BigInt(draft.supplyTokens),
   metadataHash:keccak256(toBytes(draft.metadataURI)),
   nonce,deadline
  }
 };
 return {
  typedData:data,
  digest:hashTypedData(data),
  constructorAttestor:attestor,
  factoryCodeHash:observed.codeHash,
  observedBlockHash:observed.blockHash,
  sourcePostId:source.postId,
  manualApprovalRequired:true,
  signed:false,releaseApproved:false,issuanceEnabled:false,
  warning:"Unsigned review candidate only; external issuer must recheck the current post, governance/ownership, pinned factory and fresh nonce immediately before signing. Never sign automatically."
 };
}
