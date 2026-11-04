import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMetadataJSON } from "../vendor/zora/coins-sdk/validateMetadataJSON";
import { validateCoinDraft } from "../src/lib/metadata";

const valid = {
  name: "Ultra Cat",
  symbol: "UCAT",
  description: "A creator coin for Ultra.",
  image: "ipfs://bafytestimage",
  metadataURI: "ipfs://bafytestmetadata",
  supply: "1000000",
};

test("permitted Zora metadata validator accepts IPFS image", () => {
  assert.equal(validateMetadataJSON({ name: valid.name, description: valid.description, image: valid.image }), true);
});
test("Zora validator rejects missing image", () => {
  assert.throws(() => validateMetadataJSON({ name: valid.name, description: valid.description }), /image/i);
});
test("Looke validator normalizes names and tickers", () => {
  assert.deepEqual(validateCoinDraft({ ...valid, name: " Ultra Cat ", symbol: "ucat" }), valid);
});
test("Looke validator rejects invalid metadata URI", () => {
  assert.throws(() => validateCoinDraft({ ...valid, metadataURI: "javascript:alert(1)" }), /metadata JSON URI/i);
});
test("Looke validator rejects zero supply and overprecision", () => {
  assert.throws(() => validateCoinDraft({ ...valid, supply: "0" }), /positive/i);
  assert.throws(() => validateCoinDraft({ ...valid, supply: "1.1234567890123456789" }), /positive/i);
});
test("Looke validator rejects invalid ticker", () => {
  assert.throws(() => validateCoinDraft({ ...valid, symbol: "@X" }), /ticker/i);
});
