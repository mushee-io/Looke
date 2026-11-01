import test from "node:test";
import assert from "node:assert/strict";
import { challengeMatchesRequest } from "../lib/auth-challenge.mjs";

const host = "looke.example";
const address = "0x" + "a".repeat(40);
const now = Date.parse("2026-11-01T05:00:00.000Z");
function message(issued, expires) {
  return [
    "Looke — Sign in to your Ultra EVM testnet social account",
    "Domain: " + host,
    "Address: " + address,
    "Chain ID: 18881",
    "Nonce: " + "b".repeat(40),
    "Issued At: " + issued,
    "Expires At: " + expires,
    "This signature is only for login. It does not authorize spending or trading."
  ].join("\n");
}
test("accepts canonical UTC challenge timestamps", () => {
  assert.equal(challengeMatchesRequest(message("2026-11-01T05:00:00.000Z", "2026-11-01T05:05:00.000Z"), host, address, now), true);
});
test("rejects impossible calendar date even if Date.parse normalizes it", () => {
  assert.equal(challengeMatchesRequest(message("2026-02-30T05:00:00.000Z", "2026-03-01T05:05:00.000Z"), host, address, now), false);
});
test("rejects noncanonical UTC representations", () => {
  assert.equal(challengeMatchesRequest(message("2026-11-01T05:00:00.000Z", "2026-11-01T05:05:00.000Z"), host, address, now), true);
  assert.equal(challengeMatchesRequest(message("2026-11-01T05:00:00.000Z", "2026-11-01T05:05:00.001Z"), host, address, now), false);
});
