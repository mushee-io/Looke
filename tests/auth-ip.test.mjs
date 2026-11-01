import test from "node:test";
import assert from "node:assert/strict";
import { trustedVercelIp, authIpBucketKey } from "../lib/auth-ip.mjs";

test("Only accepts validated platform-provided Vercel IP addresses", () => {
  const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.40", "x-forwarded-for": "198.51.100.2" });
  assert.equal(trustedVercelIp(headers, true), "203.0.113.40");
  assert.equal(trustedVercelIp(headers, false), null);
  assert.equal(trustedVercelIp(new Headers({"x-vercel-forwarded-for":"2001:db8::1"}), true),"2001:db8::1");
});
test("Rejects ambiguous or malformed forwarded addresses", () => {
  for (const input of ["203.0.113.40, 198.51.100.2", "not-an-ip", "", "203.0.113.40:5000"]) {
    assert.equal(trustedVercelIp(new Headers({"x-vercel-forwarded-for":input}),true),null);
  }
  assert.equal(trustedVercelIp(new Headers(),true),null);
});
test("HMAC keys are stable, scoped and do not reveal plaintext IPs", () => {
  const key="a".repeat(32), ip="203.0.113.40";
  const a=authIpBucketKey(key,"challenge",ip);
  const b=authIpBucketKey(key,"verify",ip);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,b);
  assert.equal(a,authIpBucketKey(key,"challenge",ip));
  assert(!a.includes(ip));
  assert.notEqual(a,authIpBucketKey("b".repeat(32),"challenge",ip));
});
test("Rejects weak secrets and invalid scopes", () => {
  assert.throws(()=>authIpBucketKey("short","challenge","203.0.113.40"),/secret/);
  assert.throws(()=>authIpBucketKey("a".repeat(32),"other","203.0.113.40"),/bucket/);
  assert.throws(()=>authIpBucketKey("a".repeat(32),"verify","invalid"),/bucket/);
});
