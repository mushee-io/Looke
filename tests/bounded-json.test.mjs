import test from "node:test";
import assert from "node:assert/strict";
import { parseBoundedJson } from "../lib/bounded-json.mjs";

const request = (body, type = "application/json") => new Request("https://looke.test/api/auth/verify", {
  method: "POST", headers: { "content-type": type }, body
});

test("accepts a valid JSON object", async () => {
  assert.deepEqual(await parseBoundedJson(request('{"address":"0xabc"}')), { address: "0xabc" });
});
test("rejects missing JSON content type", async () => {
  await assert.rejects(parseBoundedJson(request("{}", "text/plain")), /application\/json/);
});
test("rejects bodies above the byte limit", async () => {
  await assert.rejects(parseBoundedJson(request(JSON.stringify({ value: "x".repeat(200) }), 64)), /too large/);
});
test("counts UTF-8 bytes rather than characters", async () => {
  await assert.rejects(parseBoundedJson(request(JSON.stringify({ value: "🦊".repeat(20) }), 64)), /too large/);
});
test("rejects malformed JSON", async () => {
  await assert.rejects(parseBoundedJson(request("{invalid")), SyntaxError);
});
test("rejects empty body", async () => {
  await assert.rejects(parseBoundedJson(request("")), SyntaxError);
});
