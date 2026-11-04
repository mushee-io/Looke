import { type TablePage, type ChainInfo } from "./ultra-native-rpc";
import { type UniqFactory, type UniqListing, type UniqToken, positiveId, validateNativeAccount } from "./ultra-native";

async function request<T>(params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams(params);
  const response = await fetch(`/api/uniqs?${q}`, { cache: "no-store" });
  const body = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || "Ultra native chain query failed.");
  return body;
}
export function queryNativeStatus(): Promise<{ chainId: string; headBlock: number; irreversibleBlock: number }> {
  return request({ kind: "status" });
}
export function queryOwnedUniqs(account: string): Promise<TablePage<UniqToken>> {
  return request({ kind: "owned", account: validateNativeAccount(account), limit: "50" });
}
export function queryListings(): Promise<TablePage<UniqListing>> {
  return request({ kind: "listings", limit: "50" });
}
export function queryFactory(id: string): Promise<{ factory: UniqFactory | null; irreversibleBlock: number }> {
  return request({ kind: "factory", id: positiveId(id) });
}
export function queryListing(id: string): Promise<{ listing: UniqListing | null; irreversibleBlock: number }> {
  return request({ kind: "listing", id: positiveId(id) });
}
export async function waitUntilIrreversible(block: number, checks = 8): Promise<boolean> {
  if (!Number.isSafeInteger(block) || block <= 0) return false;
  for (let attempt = 0; attempt < checks; attempt++) {
    const info = await queryNativeStatus();
    if (info.irreversibleBlock >= block) return true;
    if (attempt < checks - 1) await new Promise(resolve => setTimeout(resolve, 1800));
  }
  return false;
}
export function processedBlock(result: unknown): number | null {
  if (!result || typeof result !== "object") return null;
  const wrapper = result as Record<string, unknown>;
  const data = (wrapper.data && typeof wrapper.data === "object") ? wrapper.data as Record<string, unknown> : wrapper;
  const processed = data.processed;
  if (!processed || typeof processed !== "object") return null;
  const block = Number((processed as Record<string, unknown>).block_num);
  return Number.isSafeInteger(block) && block > 0 ? block : null;
}
