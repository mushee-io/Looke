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

test("rejects compressed or ambiguous encoded authentication bodies before reading", async () => {
  for (const encoding of ["gzip", "br", "deflate", "identity, gzip", ""]) {
    const req = request("{}");
    req.headers.set("content-encoding", encoding);
    await assert.rejects(parseBoundedJson(req), /Unsupported Content-Encoding/);
    assert.equal(req.body.locked, false);
  }
});
test("accepts explicit identity encoding", async () => {
  const req = request("{}");
  req.headers.set("content-encoding", "Identity");
  assert.deepEqual(await parseBoundedJson(req), {});
});

test("rejects JSON nesting deeper than 32 containers", async () => {
  const deep = '{"value":'.repeat(33) + 'null' + '}'.repeat(33);
  await assert.rejects(parseBoundedJson(request(deep)), /nesting too deep/);
});
test("accepts nested JSON at the 32-container boundary", async () => {
  const boundary = '{"value":'.repeat(32) + 'null' + '}'.repeat(32);
  assert.ok(await parseBoundedJson(request(boundary)));
});
test("counts nested arrays as containers", async () => {
  const deep = '{"value":' + '['.repeat(32) + '0' + ']'.repeat(32) + '}';
  await assert.rejects(parseBoundedJson(request(deep)), /nesting too deep/);
});


test("rejects prototype-sensitive keys in nested authentication payloads", async () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    for (const body of [JSON.stringify({ [key]: "bad" }), JSON.stringify({ data: [{ [key]: true }] })]) {
      await assert.rejects(parseBoundedJson(request(body)), /Forbidden JSON property/);
    }
  }
});
test("accepts ordinary nested authentication properties", async () => {
  assert.deepEqual(await parseBoundedJson(request('{"profile":{"name":"Looke"}}')), { profile: { name: "Looke" } });
});


test("accepts JSON within the 2048-container budget", async () => {
  const body = JSON.stringify({ items: Array.from({ length: 2046 }, () => []) });
  const result = await parseBoundedJson(request(body));
  assert.equal(result.items.length, 2046);
});
test("rejects wide JSON structures above the container budget", async () => {
  const body = JSON.stringify({ items: Array.from({ length: 2047 }, () => []) });
  await assert.rejects(parseBoundedJson(request(body)), /JSON structure too complex/);
});

test("accepts authentication JSON at the 2048-property boundary", async () => {
  const data = Object.fromEntries(Array.from({ length: 2048 }, (_, i) => [i.toString(36), 0]));
  assert.equal(Object.keys(await parseBoundedJson(request(JSON.stringify(data)))).length, 2048);
});
test("rejects excess scalar properties even without nested containers", async () => {
  const data = Object.fromEntries(Array.from({ length: 2049 }, (_, i) => [i.toString(36), 0]));
  await assert.rejects(parseBoundedJson(request(JSON.stringify(data))), /too many properties/);
});

test("rejects UTF-8 BOM before JSON decoding", async () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
  await assert.rejects(parseBoundedJson(request(bytes)), /BOM not permitted/);
});
test("rejects malformed UTF-8 instead of replacing invalid bytes", async () => {
  const bytes = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x22, 0x7d]);
  await assert.rejects(parseBoundedJson(request(bytes)), TypeError);
});
test("accepts ordinary UTF-8 authentication JSON", async () => {
  assert.deepEqual(await parseBoundedJson(request('{"label":"Café"}')), { label: "Café" });
});


test("rejects understated Content-Length even when within the byte budget", async () => {
  const req = request('{"value":1}');
  req.headers.set("content-length", "2");
  await assert.rejects(parseBoundedJson(req), /Content-Length does not match/);
});
test("rejects overstated Content-Length even when within the byte budget", async () => {
  const req = request("{}");
  req.headers.set("content-length", "3");
  await assert.rejects(parseBoundedJson(req), /Content-Length does not match/);
});
test("accepts absent and accurate Content-Length framing", async () => {
  assert.deepEqual(await parseBoundedJson(request("{}")), {});
  const req = request('{"ok":true}');
  req.headers.set("content-length", String(new TextEncoder().encode('{"ok":true}').length));
  assert.deepEqual(await parseBoundedJson(req), { ok: true });
});
