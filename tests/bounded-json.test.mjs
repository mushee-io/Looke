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
  await assert.rejects(parseBoundedJson(request(JSON.stringify({ value: "x".repeat(200) })), 64), /too large/);
});
test("counts UTF-8 bytes rather than characters", async () => {
  await assert.rejects(parseBoundedJson(request(JSON.stringify({ value: "🦊".repeat(20) })), 64), /too large/);
});
test("rejects malformed JSON", async () => {
  await assert.rejects(parseBoundedJson(request("{invalid")), SyntaxError);
});
test("rejects empty body", async () => {
  await assert.rejects(parseBoundedJson(request("")), SyntaxError);
});

test("rejects declared oversize without reading the body", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([123, 125])); controller.close(); } });
  const req = new Request("https://looke.test/api/auth/verify", {
    method: "POST", headers: { "content-type": "application/json", "content-length": "1000" },
    body, duplex: "half"
  });
  await assert.rejects(parseBoundedJson(req, 64), /too large/);
  assert.equal(req.body.locked, false);
});
test("rejects malformed declared lengths", async () => {
  for (const length of ["-1", "1.5", "12x", "01"]) {
    const req = request("{}");
    req.headers.set("content-length", length);
    await assert.rejects(parseBoundedJson(req), /Invalid Content-Length/);
  }
});
test("does not trust an understated Content-Length", async () => {
  const req = request(JSON.stringify({ value: "x".repeat(200) }));
  req.headers.set("content-length", "2");
  await assert.rejects(parseBoundedJson(req, 64), /too large/);
});
test("accepts exact-boundary declared length", async () => {
  const req = request("{}");
  req.headers.set("content-length", "2");
  assert.deepEqual(await parseBoundedJson(req, 2), {});
});

test("accepts JSON with a UTF-8 charset parameter", async () => {
  assert.deepEqual(await parseBoundedJson(request("{}", "application/json; charset=UTF-8")), {});
  assert.deepEqual(await parseBoundedJson(request("{}", "Application/JSON; charset=\"utf-8\"")), {});
});
test("rejects misleading JSON media types and unsupported charset parameters", async () => {
  for (const type of ["application/jsonp", "application/json-seq", "application/jsonx", "application/json; charset=iso-8859-1", "application/json; arbitrary=yes", "text/json"]) {
    await assert.rejects(parseBoundedJson(request("{}", type)), /application\/json/);
  }
});

test("rejects non-object top-level authentication JSON", async () => {
  for (const value of ["null", "[]", "[1]", "true", "false", "42", '"hello"']) {
    await assert.rejects(parseBoundedJson(request(value)), /Expected a JSON object/);
  }
});
test("accepts empty and nested JSON objects", async () => {
  assert.deepEqual(await parseBoundedJson(request("{}")), {});
  assert.deepEqual(await parseBoundedJson(request('{"data":{"items":[1,2]}}')), { data: { items: [1, 2] } });
});
