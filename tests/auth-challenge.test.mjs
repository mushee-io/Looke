import test from "node:test";
import assert from "node:assert/strict";
import { challengeMatchesRequest } from "../lib/auth-challenge.mjs";
const address = "0x1234567890123456789012345678901234567890";
const host = "preview.example";
const message = [
  "Looke — Sign in to your Ultra EVM testnet social account",
  "Domain: " + host,
  "Address: " + address,
  "Chain ID: 18881",
  "Nonce: " + "ab".repeat(20),
  "Issued At: 2026-11-01T01:00:00.000Z",
  "Expires At: 2026-11-01T01:05:00.000Z",
  "This signature is only for login. It does not authorize spending or trading."
].join("\n");
test("accepts exact challenge host, wallet, chain and five-minute window", () => {
  assert.equal(challengeMatchesRequest(message,host,address),true);
});
test("rejects cross-host and wallet challenge replay", () => {
  assert.equal(challengeMatchesRequest(message,"other.example",address),false);
  assert.equal(challengeMatchesRequest(message,host,"0x0000000000000000000000000000000000000001"),false);
});
test("rejects altered chain, nonce, expiration, and added lines", () => {
  for (const altered of [message.replace("18881","1"),message.replace("Nonce: ab","Nonce: zz"),message.replace("01:05:00","01:06:00"),message+"\nExtra"]) {
    assert.equal(challengeMatchesRequest(altered,host,address),false);
  }
});
