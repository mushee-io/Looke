/**
 * Ultra *native* Uniq NFT domain types and transaction builders.
 * Distinct from Ultra EVM (chain ID 18881). Nothing in this file signs or broadcasts.
 * Sources: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/
 */
export const ULTRA_NATIVE_TESTNET = {
  chainId: "7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9",
  rpc: "https://ultra-testnet.eosphere.io",
  contract: "eosio.nft.ft",
  explorer: "https://explorer.testnet.ultra.io",
} as const;

export type NativeAction = {
  contract: typeof ULTRA_NATIVE_TESTNET.contract;
  action: "create.b" | "issue.b" | "resell" | "cancelresell" | "buy";
  data: Record<string, unknown>;
};
export type UniqFactory = {
  id: string;
  asset_creator: string;
  asset_manager: string;
  stat?: number;
  factory_uri?: string;
  default_token_uri?: string;
  max_mintable_tokens?: number | null;
  minted_tokens_no?: number;
};
export type UniqToken = {
  id: string;
  token_factory_id: string;
  serial_number?: number;
  uri?: string | null;
  hash?: string | null;
};
export type UniqListing = {
  token_id: string;
  owner: string;
  price: string;
  promoter_basis_point?: number;
};

export function validateNativeAccount(value: string): string {
  const name = value.trim();
  if (!/^[a-z1-5.]{1,12}$/.test(name) || name.startsWith(".") || name.endsWith(".")) {
    throw new Error("Enter a valid Ultra account (1–12 lowercase characters a-z, 1–5 or dots).");
  }
  return name;
}
export function positiveId(value: string): string {
  const id = value.trim();
  if (!/^[1-9][0-9]{0,15}$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new Error("Uniq/factory ID must be a safe positive decimal integer.");
  }
  return id;
}
export function formatUos(value: string, cap?: number): string {
  const normalized = value.trim();
  if (!/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,8})?$/.test(normalized) || Number(normalized) <= 0) {
    throw new Error("UOS amount must be positive with at most 8 decimal places.");
  }
  if (cap !== undefined && Number(normalized) > cap) throw new Error(`UOS amount must not exceed ${cap}.`);
  const [whole, fractional = ""] = normalized.split(".");
  return `${whole}.${fractional.padEnd(8, "0")} UOS`;
}
export function validateMetadataUri(value: string): string {
  const uri = value.trim();
  if (uri.length > 500 || !/^(https:\/\/|ipfs:\/\/|ar:\/\/)/.test(uri)) {
    throw new Error("Metadata must use a published https://, ipfs:// or ar:// URI (up to 500 characters).");
  }
  return uri;
}
export function validateMemo(value: string): string {
  const memo = value.trim();
  if (new TextEncoder().encode(memo).length > 256) throw new Error("Memo must be at most 256 bytes.");
  return memo;
}
function nullableHash(value: string): string | null {
  const hash = value.trim();
  if (!hash) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) throw new Error("Metadata SHA256 must be exactly 64 hexadecimal digits.");
  return hash.toLowerCase();
}
function maxPayment(value: string): string {
  // Explicitly bound the user's potential Testnet RAM expense. No unlimited payment.
  return formatUos(value, 20);
}
export function createFactoryAction(params: {
  account: string; factoryURI: string; defaultTokenURI: string;
  maxMintable: string; maxUos: string; memo?: string;
  factoryHash?: string;
}): NativeAction {
  const actor = validateNativeAccount(params.account);
  const maxMintable = positiveId(params.maxMintable);
  if (Number(maxMintable) > 1_000_000) throw new Error("Maximum supply is limited to 1,000,000 Uniqs per factory.");
  return {
    contract: ULTRA_NATIVE_TESTNET.contract,
    action: "create.b",
    data: { create: {
      memo: validateMemo(params.memo ?? "Created through Looke Testnet"),
      asset_creator: actor, asset_manager: actor,
      minimum_resell_price: null, resale_shares: null,
      mintable_window_start: null, mintable_window_end: null,
      trading_window_start: null, trading_window_end: null,
      recall_window_start: null, recall_window_end: null,
      max_mintable_tokens: Number(maxMintable), lockup_time: null,
      conditionless_receivers: null, stat: 0,
      factory_uri: validateMetadataUri(params.factoryURI),
      factory_hash: nullableHash(params.factoryHash ?? ""),
      authorized_minters: null, account_minting_limit: null,
      transfer_window_start: null, transfer_window_end: null,
      maximum_uos_payment: maxPayment(params.maxUos),
      default_token_uri: validateMetadataUri(params.defaultTokenURI),
      default_token_hash: null, lock_hash: false,
    }},
  };
}
export function mintUniqAction(params: {
  account: string; receiver: string; factoryId: string;
  maxUos: string; metadataUri?: string; memo?: string;
}): NativeAction {
  const actor = validateNativeAccount(params.account);
  const receiver = validateNativeAccount(params.receiver);
  return {
    contract: ULTRA_NATIVE_TESTNET.contract,
    action: "issue.b",
    data: { issue: {
      to: receiver,
      token_configs: [{ token_factory_id: Number(positiveId(params.factoryId)), amount: 1, custom_data: "" }],
      memo: validateMemo(params.memo ?? "Minting a Uniq via Looke Testnet"),
      authorizer: null,
      maximum_uos_payment: maxPayment(params.maxUos),
      // Omit optional token_metadata to inherit factory default URI, unless explicit metadata supplied.
      ...(params.metadataUri?.trim()
        ? { token_metadata: [{ meta_uri: validateMetadataUri(params.metadataUri), meta_hash: null }] }
        : {}),
    }},
  };
}
export function listUniqAction(params: {
  owner: string; tokenId: string; priceUos: string;
}): NativeAction {
  return {
    contract: ULTRA_NATIVE_TESTNET.contract,
    action: "resell",
    data: { resell: {
      seller: validateNativeAccount(params.owner),
      token_id: Number(positiveId(params.tokenId)),
      price: formatUos(params.priceUos),
      promoter_basis_point: 0,
      memo: "List Uniq via Looke Testnet",
    }},
  };
}
export function cancelListingAction(params: { tokenId: string }): NativeAction {
  return {
    contract: ULTRA_NATIVE_TESTNET.contract,
    action: "cancelresell",
    data: { cancelresell: {
      token_id: Number(positiveId(params.tokenId)), memo: "Cancel Looke Testnet listing",
    }},
  };
}
export function buyUniqAction(params: {
  buyer: string; tokenId: string; maxPriceUos: string;
}): NativeAction {
  const buyer = validateNativeAccount(params.buyer);
  return {
    contract: ULTRA_NATIVE_TESTNET.contract,
    action: "buy",
    data: { buy: {
      buyer, receiver: buyer, token_id: Number(positiveId(params.tokenId)),
      memo: "Buy Uniq via Looke Testnet",
      max_price: formatUos(params.maxPriceUos), promoter_id: null,
    }},
  };
}
export function parseFactory(row: unknown): UniqFactory {
  if (typeof row !== "object" || row === null) throw new Error("Invalid factory row.");
  const r = row as Record<string, unknown>;
  const id = positiveId(String(r.id));
  const asset_creator = validateNativeAccount(String(r.asset_creator));
  const asset_manager = validateNativeAccount(String(r.asset_manager));
  return {
    id, asset_creator, asset_manager,
    stat: typeof r.stat === "number" ? r.stat : undefined,
    factory_uri: typeof r.factory_uri === "string" ? r.factory_uri : undefined,
    default_token_uri: typeof r.default_token_uri === "string" ? r.default_token_uri : undefined,
    max_mintable_tokens: typeof r.max_mintable_tokens === "number" ? r.max_mintable_tokens : null,
    minted_tokens_no: typeof r.minted_tokens_no === "number" ? r.minted_tokens_no : undefined,
  };
}
export function parseUniq(row: unknown): UniqToken {
  if (typeof row !== "object" || row === null) throw new Error("Invalid Uniq row.");
  const r = row as Record<string, unknown>;
  return {
    id: positiveId(String(r.id)), token_factory_id: positiveId(String(r.token_factory_id)),
    serial_number: typeof r.serial_number === "number" ? r.serial_number : undefined,
    uri: typeof r.uri === "string" ? r.uri : null,
    hash: typeof r.hash === "string" ? r.hash : null,
  };
}
export function parseListing(row: unknown): UniqListing {
  if (typeof row !== "object" || row === null) throw new Error("Invalid resale row.");
  const r = row as Record<string, unknown>;
  if (typeof r.price !== "string" || !/^[0-9]+\.[0-9]{8} (UOS|USD)$/.test(r.price)) {
    throw new Error("Invalid on-chain resale price.");
  }
  return {
    token_id: positiveId(String(r.token_id)), owner: validateNativeAccount(String(r.owner)),
    price: r.price,
    promoter_basis_point: typeof r.promoter_basis_point === "number" ? r.promoter_basis_point : undefined,
  };
}
export function parseWalletHash(result: unknown): string {
  if (!result || typeof result !== "object") throw new Error("Wallet did not provide a transaction result.");
  const wrapped = result as Record<string, unknown>;
  const data = wrapped.data && typeof wrapped.data === "object" ? wrapped.data as Record<string, unknown> : wrapped;
  const hash = data.transactionHash;
  if (typeof hash !== "string" || !/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error("Wallet transaction hash is missing or invalid.");
  }
  return hash.toLowerCase();
}
export function nativeTxUrl(tx: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(tx)) throw new Error("Invalid Testnet transaction ID.");
  return `${ULTRA_NATIVE_TESTNET.explorer}/transaction/${tx}`;
}
