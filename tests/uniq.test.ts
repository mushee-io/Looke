import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ULTRA_NATIVE_TESTNET, buyUniqAction, cancelListingAction, createFactoryAction, formatUos,
  listUniqAction, mintUniqAction, nativeTxUrl, parseFactory, parseListing, parseUniq,
  parseWalletHash, positiveId, validateMetadataUri, validateNativeAccount,
} from "../src/lib/ultra-native";

const actor = "aa1aa2aa3aa4";

test("native Testnet chain is distinct from Ultra EVM and fixed", () => {
  assert.equal(ULTRA_NATIVE_TESTNET.chainId.length, 64);
  assert.equal(ULTRA_NATIVE_TESTNET.contract, "eosio.nft.ft");
  assert.notEqual(ULTRA_NATIVE_TESTNET.chainId, "18881");
});

test("account, URI and ID validators reject unsafe inputs", () => {
  assert.equal(validateNativeAccount(actor), actor);
  assert.throws(() => validateNativeAccount("BAD_USER"), /valid Ultra account/);
  assert.throws(() => validateNativeAccount("a".repeat(13)), /valid Ultra account/);
  assert.throws(() => validateMetadataUri("javascript:alert(1)"), /Metadata/);
  assert.throws(() => positiveId("0"), /integer/);
  assert.throws(() => positiveId("9007199254740992"), /integer/);
  assert.equal(positiveId("12345"), "12345");
});

test("UOS precision and explicit RAM spending cap", () => {
  assert.equal(formatUos("1.23"), "1.23000000 UOS");
  assert.equal(formatUos("0.00000001"), "0.00000001 UOS");
  assert.throws(() => formatUos("0"), /positive/);
  assert.throws(() => formatUos("-1"), /positive/);
  assert.throws(() => formatUos("1.123456789"), /positive/);
  assert.throws(() => formatUos("21", 20), /exceed/);
});

test("factory creation is native create.b, one manager/creator and bounded payment", () => {
  const action = createFactoryAction({
    account: actor, factoryURI: "https://example.org/factory.json",
    defaultTokenURI: "https://example.org/{serial_number}.json", maxMintable: "100",
    maxUos: "2.5",
  });
  assert.equal(action.action, "create.b");
  const args = action.data.create as Record<string, unknown>;
  assert.equal(args.asset_creator, actor);
  assert.equal(args.asset_manager, actor);
  assert.equal(args.stat, 0);
  assert.equal(args.max_mintable_tokens, 100);
  assert.equal(args.maximum_uos_payment, "2.50000000 UOS");
  assert.equal(args.default_token_uri, "https://example.org/{serial_number}.json");
  assert.throws(() => createFactoryAction({
    account: actor, factoryURI: "https://x.test", defaultTokenURI: "https://x.test",
    maxMintable: "1000001", maxUos: "1",
  }), /1,000,000/);
});

test("mint uses native issue.b, one uniq, caller-managed factory, capped RAM", () => {
  const action = mintUniqAction({
    account: actor, receiver: "bb1bb2bb3bb4", factoryId: "43",
    maxUos: "0.5", metadataUri: "ipfs://bafyexample",
  });
  assert.equal(action.action, "issue.b");
  const args = action.data.issue as Record<string, unknown>;
  assert.deepEqual(args.token_configs, [{ token_factory_id: 43, amount: 1, custom_data: "" }]);
  assert.equal(args.to, "bb1bb2bb3bb4");
  assert.equal(args.maximum_uos_payment, "0.50000000 UOS");
  assert.deepEqual(args.token_metadata, [{ meta_uri: "ipfs://bafyexample", meta_hash: null }]);
});

test("resell, cancel and buy action types are native with no promoter", () => {
  const sell = listUniqAction({ owner: actor, tokenId: "72", priceUos: "4.5" });
  assert.equal(sell.action, "resell");
  assert.equal((sell.data.resell as Record<string, unknown>).seller, actor);
  assert.equal((sell.data.resell as Record<string, unknown>).promoter_basis_point, 0);
  assert.equal((sell.data.resell as Record<string, unknown>).price, "4.50000000 UOS");
  assert.equal(cancelListingAction({ tokenId: "72" }).action, "cancelresell");
  const buy = buyUniqAction({ buyer: actor, tokenId: "72", maxPriceUos: "4.5" });
  assert.equal(buy.action, "buy");
  assert.equal((buy.data.buy as Record<string, unknown>).promoter_id, null);
  assert.equal((buy.data.buy as Record<string, unknown>).max_price, "4.50000000 UOS");
});

test("normalizes native table rows without fabricating metadata", () => {
  const uniq = parseUniq({ id: "72", token_factory_id: 43, serial_number: 1 });
  assert.equal(uniq.id, "72");
  assert.equal(uniq.uri, null);
  const factory = parseFactory({ id: 43, asset_creator: actor, asset_manager: actor, stat: 0 });
  assert.equal(factory.stat, 0);
  const listing = parseListing({ token_id: "72", owner: actor, price: "4.00000000 UOS" });
  assert.equal(listing.price, "4.00000000 UOS");
  assert.throws(() => parseListing({ token_id: "72", owner: actor, price: "bad" }), /price/);
});

test("wallet broadcast response is required to contain a real-shaped hash", () => {
  const hash = "f".repeat(64);
  assert.equal(parseWalletHash({ status: "success", data: { transactionHash: hash } }), hash);
  assert.throws(() => parseWalletHash({ data: { transactionHash: "" } }), /hash/);
  assert.throws(() => nativeTxUrl("not_a_hash"), /ID/);
  assert.ok(nativeTxUrl(hash).includes(hash));
});
