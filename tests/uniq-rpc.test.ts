import assert from "node:assert/strict";
import { test } from "node:test";
import { getNativeTestnetInfo, readNativeTable, ownedUniqs, getFactory, getListing } from "../src/lib/ultra-native-rpc";
import { ULTRA_NATIVE_TESTNET } from "../src/lib/ultra-native";

function mockRpc(calls: Array<{ endpoint: string; body: Record<string, unknown> }>, chainId = ULTRA_NATIVE_TESTNET.chainId, pages?: Record<string, unknown>) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const endpoint = String(input).split("/").at(-1) || "";
    const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    calls.push({ endpoint, body });
    const value = endpoint === "get_info"
      ? { chain_id: chainId, head_block_num: 200, last_irreversible_block_num: 193 }
      : pages?.[String(body.table)] || { rows: [], more: false, next_key: "" };
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  };
}

test("RPC code asserts native Testnet chain before table reads", async () => {
  const previous = globalThis.fetch;
  const calls: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  try {
    globalThis.fetch = mockRpc(calls, "a9c481dfbc7d9506dc7e87e9a137c931b0a9303f64fd7a1d08b8230133920097") as typeof fetch;
    await assert.rejects(() => ownedUniqs("aa1aa2aa3aa4"), /not connected to Ultra Testnet/);
    assert.deepEqual(calls.map(x => x.endpoint), ["get_info"]);
  } finally { globalThis.fetch = previous; }
});

test("read-only tables query correct scopes and support bounded pagination", async () => {
  const previous = globalThis.fetch;
  const calls: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  try {
    globalThis.fetch = mockRpc(calls, ULTRA_NATIVE_TESTNET.chainId, {
      "token.b": { rows: [{ id: 12, token_factory_id: 5, uri: "https://nft.example/12" }], more: true, next_key: "13" },
      "factory.b": { rows: [{ id: 5, asset_creator: "aa1aa2aa3aa4", asset_manager: "aa1aa2aa3aa4", stat: 0 }], more: false },
      "resale.a": { rows: [{ token_id: 12, owner: "aa1aa2aa3aa4", price: "2.00000000 UOS" }], more: false },
    }) as typeof fetch;
    const inventory = await ownedUniqs("aa1aa2aa3aa4", 999);
    assert.equal(inventory.rows[0].id, "12");
    assert.equal(inventory.next_key, "13");
    assert.equal(inventory.irreversibleBlock, 193);
    const factory = await getFactory("5");
    assert.equal(factory.factory?.asset_manager, "aa1aa2aa3aa4");
    const listing = await getListing("12");
    assert.equal(listing.listing?.price, "2.00000000 UOS");
    const tableRequests = calls.filter(x => x.endpoint === "get_table_rows").map(x => x.body);
    assert.deepEqual(tableRequests.map(x => [x.table, x.scope]), [
      ["token.b", "aa1aa2aa3aa4"], ["factory.b", "eosio.nft.ft"], ["resale.a", "eosio.nft.ft"],
    ]);
    assert.equal(tableRequests[0].limit, 50);
    assert.equal(tableRequests[1].lower_bound, "5");
    assert.equal(tableRequests[2].lower_bound, "12");
    assert.equal(tableRequests[2].code, "eosio.nft.ft");
  } finally { globalThis.fetch = previous; }
});

test("rejects untrusted pagination and invalid network info", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = mockRpc([]) as typeof fetch;
  try {
    await assert.rejects(() => readNativeTable("token.b", "test", value => value, { lowerBound: "1;DROP" }), /cursor/);
  } finally { globalThis.fetch = previous; }
});
