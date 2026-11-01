import test from "node:test";
import assert from "node:assert/strict";
import { formatLoginChallenge } from "../lib/login-challenge.mjs";
import { challengeMatchesRequest } from "../lib/auth-challenge.mjs";
const issuedAt = new Date("2026-11-01T01:00:00.000Z");
const expiresAt = new Date("2026-11-01T01:05:00.000Z");
const address = "0x1234567890123456789012345678901234567890";
const args = {host:"preview.example", address, nonce:"a".repeat(40), issuedAt, expiresAt};
test("generated challenge passes the same validation used by login verification", () => {
  const challenge = formatLoginChallenge(args);
  assert.equal(challengeMatchesRequest(challenge,args.host,address,issuedAt.getTime()),true);
  assert.equal(challenge.split("\n").length,8);
});
test("challenge formatter rejects invalid or injected context", () => {
  for (const patch of [{host:"preview.example\nInjected: yes"},{nonce:"x".repeat(40)},{address:"0x123"},{expiresAt:new Date("2026-11-01T01:05:01Z")},{issuedAt:new Date(NaN)}]) {
    assert.throws(()=>formatLoginChallenge({...args,...patch}),TypeError);
  }
});
