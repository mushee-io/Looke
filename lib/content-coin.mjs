import { encodeAbiParameters, getAddress, keccak256, toBytes } from "viem";
import { normalizeCreatorCoinDraft } from "./creator-coin.mjs";

/**
 * Content reference v1 is an offchain deterministic commitment to a specific
 * author's Looke post *snapshot*. This is NOT a wallet-signed attestation.
 *
 * ref = keccak256(abi.encode(domainHash, chainId, creator, postUUID, textHash))
 * domainHash = keccak256("looke.content.v1")
 */
const POST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN=keccak256(toBytes("looke.content.v1"));
export const LOOKE_CONTENT_CHAIN_ID=18881;
export const MAX_CONTENT_DRAFTS=20;

export function checkedContentPostId(value) {
  if(typeof value!=="string" || !POST_ID.test(value))throw new RangeError("Invalid Looke post ID");
  return value.toLowerCase();
}

export function normalizeContentCoinDraft(input) {
  if(!input || typeof input!=="object" || Array.isArray(input))throw new RangeError("Invalid content coin proposal");
  if(Object.keys(input).some(key=>!["postId","name","symbol","supplyTokens","metadataURI"].includes(key)))
    throw new RangeError("Unsupported content coin proposal field");
  const postId=checkedContentPostId(input.postId);
  const coin=normalizeCreatorCoinDraft({
    name:input.name,symbol:input.symbol,supplyTokens:input.supplyTokens,
    metadataURI:input.metadataURI
  });
  return {postId,...coin};
}

export function contentSnapshot(postId,creatorAddress,text) {
  const canonicalId=checkedContentPostId(postId);
  if(typeof creatorAddress!=="string" || !/^0x[a-fA-F0-9]{40}$/.test(creatorAddress))
    throw new RangeError("Invalid content creator wallet address");
  if(typeof text!=="string" || text.trim().length===0 || [...text].length>1200)
    throw new RangeError("Invalid source post text");
  const textHash=keccak256(toBytes(text));
  const address=getAddress(creatorAddress);
  const ref=keccak256(encodeAbiParameters(
    [{type:"bytes32"},{type:"uint256"},{type:"address"},{type:"bytes16"},{type:"bytes32"}],
    [DOMAIN,BigInt(LOOKE_CONTENT_CHAIN_ID),address,
      ("0x"+canonicalId.replaceAll("-","")),textHash]
  ));
  return {postId:canonicalId,creatorAddress:address.toLowerCase(),chainId:LOOKE_CONTENT_CHAIN_ID,
    version:"looke.content.v1",textHash,contentRef:ref};
}

export function contentSnapshotIsCurrent(snapshot,postId,creatorAddress,text) {
  const current=contentSnapshot(postId,creatorAddress,text);
  return typeof snapshot?.textHash==="string" && typeof snapshot?.contentRef==="string" &&
    snapshot.textHash.toLowerCase()===current.textHash &&
    snapshot.contentRef.toLowerCase()===current.contentRef;
}
