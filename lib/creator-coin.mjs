/**
 * M9 draft validation. This is a launch specification, not an issuance service.
 * The onchain factory can only guarantee token rules; a signed-in social profile
 * does not constitute KYC, trademark verification or public launch permission.
 */
const CONTROL = /[\u0000-\u001f\u007f]/;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
export const MAX_CREATOR_SUPPLY = 1_000_000_000;

export function checkedIpfsMetadataUri(value) {
  if (typeof value !== "string" || value.length > 256 || !value.startsWith("ipfs://")) {
    throw new RangeError("Metadata must be an IPFS URI");
  }
  const rest = value.slice(7);
  const slash = rest.indexOf("/");
  const cid = slash === -1 ? rest : rest.slice(0,slash);
  const path = slash === -1 ? "" : rest.slice(slash+1);
  const cidV0 = cid.length === 46 && cid.startsWith("Qm") &&
    [...cid.slice(2)].every(c => BASE58.includes(c));
  const cidV1 = cid.length >= 52 && cid.length <= 90 &&
    cid.startsWith("bafy") && [...cid].every(c => BASE32.includes(c));
  if (!cidV0 && !cidV1) throw new RangeError("Invalid IPFS metadata content ID");
  if (slash >= 0 && (!path || path.length > 100 || path.includes("..") ||
      path.includes("//") || !/^[A-Za-z0-9_./-]+$/.test(path))) {
    throw new RangeError("Unsafe IPFS metadata path");
  }
  return value;
}

export function normalizeCreatorCoinDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RangeError("Creator coin draft must be an object");
  }
  const keys=Object.keys(input);
  if(keys.some(key => !["name","symbol","supplyTokens","metadataURI"].includes(key))){
    throw new RangeError("Unsupported creator coin field");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || new TextEncoder().encode(name).length < 2 ||
      new TextEncoder().encode(name).length > 80 || CONTROL.test(name)) {
    throw new RangeError("Name must contain 2–80 UTF-8 bytes and no control characters");
  }
  const symbol=typeof input.symbol==="string"?input.symbol.trim():"";
  if(!/^[A-Z0-9]{2,12}$/.test(symbol)) {
    throw new RangeError("Token symbol must be 2–12 uppercase letters or digits");
  }
  const raw=input.supplyTokens;
  if(typeof raw!=="string" || !/^[1-9][0-9]{0,9}$/.test(raw) ||
     BigInt(raw)>BigInt(MAX_CREATOR_SUPPLY)) {
    throw new RangeError("Supply must be a whole number between 1 and 1,000,000,000");
  }
  return {name,symbol,supplyTokens:Number(raw),metadataURI:checkedIpfsMetadataUri(input.metadataURI)};
}

export function creatorCoinPreview(draft,creatorAddress) {
  const input=normalizeCreatorCoinDraft({...draft,supplyTokens:String(draft?.supplyTokens)});
  if(typeof creatorAddress!=="string" || !/^0x[0-9a-fA-F]{40}$/.test(creatorAddress)){
    throw new RangeError("An Ultra EVM creator address is required");
  }
  return {
    ...input,
    creatorAddress:creatorAddress.toLowerCase(),
    kind:0,
    contentRef:"0x"+"00".repeat(32),
    supplyRaw:(BigInt(input.supplyTokens)*10n**18n).toString(),
    network:"Ultra EVM Testnet",
    chainId:18881,
    mintRecipient:"Connected wallet on the factory call; never the Looke server",
    liquidityCreated:false,
    executionEnabled:false,
  };
}
