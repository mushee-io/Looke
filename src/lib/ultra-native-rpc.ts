import {
  ULTRA_NATIVE_TESTNET, parseFactory, parseListing, parseUniq, positiveId,
  validateNativeAccount, type UniqFactory, type UniqListing, type UniqToken,
} from "./ultra-native";

export type ChainInfo = {
  chain_id: string;
  head_block_num: number;
  last_irreversible_block_num: number;
};
export type TablePage<T> = {
  rows: T[];
  more: boolean;
  next_key: string;
  irreversibleBlock: number;
};

/** Fixed network only; never use user-supplied RPC URLs. This module is for server-side reads. */
const rpc = process.env.ULTRA_NATIVE_TESTNET_RPC_URL || ULTRA_NATIVE_TESTNET.rpc;
async function chainPost<T>(endpoint: "get_info" | "get_table_rows", body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${rpc}/v1/chain/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Ultra native RPC returned HTTP ${response.status} for ${endpoint}.`);
  return response.json() as Promise<T>;
}
export async function getNativeTestnetInfo(): Promise<ChainInfo> {
  const info = await chainPost<ChainInfo>("get_info", {});
  if (info.chain_id !== ULTRA_NATIVE_TESTNET.chainId) {
    throw new Error("Native RPC is not connected to Ultra Testnet. Read operations blocked.");
  }
  if (!Number.isSafeInteger(info.head_block_num) ||
      !Number.isSafeInteger(info.last_irreversible_block_num)) {
    throw new Error("Ultra RPC returned malformed block numbers.");
  }
  return info;
}
type RawPage = { rows?: unknown[]; more?: boolean | string; next_key?: string };
type Table = "factory.b" | "token.b" | "resale.a";
export async function readNativeTable<T>(
  table: Table, scope: string, parse: (item: unknown) => T,
  options: { limit?: number; lowerBound?: string } = {},
): Promise<TablePage<T>> {
  const info = await getNativeTestnetInfo();
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit || 20)));
  const lowerBound = options.lowerBound?.trim() || undefined;
  if (lowerBound && !/^[0-9]{1,16}$/.test(lowerBound)) throw new Error("Invalid pagination cursor.");
  const result = await chainPost<RawPage>("get_table_rows", {
    json: true,
    code: ULTRA_NATIVE_TESTNET.contract,
    scope, table,
    limit,
    ...(lowerBound ? { lower_bound: lowerBound } : {}),
  });
  if (!Array.isArray(result.rows)) throw new Error(`RPC did not return rows for ${table}.`);
  if (result.rows.length > limit) throw new Error("RPC exceeded the requested page size.");
  const rows = result.rows.map(parse);
  return {
    rows, more: result.more === true || typeof result.more === "string" && result.more.length > 0,
    next_key: typeof result.next_key === "string" ? result.next_key : "",
    irreversibleBlock: info.last_irreversible_block_num,
  };
}
export function ownedUniqs(account: string, limit = 20, lowerBound?: string): Promise<TablePage<UniqToken>> {
  return readNativeTable("token.b", validateNativeAccount(account), parseUniq, { limit, lowerBound });
}
export function activeListings(limit = 20, lowerBound?: string): Promise<TablePage<UniqListing>> {
  return readNativeTable("resale.a", ULTRA_NATIVE_TESTNET.contract, parseListing, { limit, lowerBound });
}
export async function getFactory(factoryId: string): Promise<{ factory: UniqFactory | null; irreversibleBlock: number }> {
  const id = positiveId(factoryId);
  const page = await readNativeTable("factory.b", ULTRA_NATIVE_TESTNET.contract, parseFactory, { limit: 1, lowerBound: id });
  return { factory: page.rows.find(row => row.id === id) ?? null, irreversibleBlock: page.irreversibleBlock };
}
export async function getListing(tokenId: string): Promise<{ listing: UniqListing | null; irreversibleBlock: number }> {
  const id = positiveId(tokenId);
  const page = await readNativeTable("resale.a", ULTRA_NATIVE_TESTNET.contract, parseListing, { limit: 1, lowerBound: id });
  return { listing: page.rows.find(row => row.token_id === id) ?? null, irreversibleBlock: page.irreversibleBlock };
}
