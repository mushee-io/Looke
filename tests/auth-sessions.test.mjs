import test from "node:test";
import assert from "node:assert/strict";
import { publicSessionRows } from "../lib/auth-sessions.mjs";

test("only safe fields leave the session API", () => {
  const rows = [
    { token_hash: "a".repeat(64), created_at: new Date("2026-11-01T10:00:00Z"), expires_at: new Date("2026-11-08T10:00:00Z"), is_current: true },
    { token_hash: "b".repeat(64), created_at: new Date("2026-10-31T08:00:00Z"), expires_at: new Date("2026-11-07T08:00:00Z"), is_current: false },
  ];
  const safe = publicSessionRows(rows);
  assert.deepEqual(safe, [
    { createdAt: "2026-11-01T10:00:00.000Z", expiresAt: "2026-11-08T10:00:00.000Z", current: true },
    { createdAt: "2026-10-31T08:00:00.000Z", expiresAt: "2026-11-07T08:00:00.000Z", current: false },
  ]);
  assert(!JSON.stringify(safe).includes(rows[0].token_hash));
  assert(!JSON.stringify(safe).includes(rows[1].token_hash));
});

test("reject invalid session result and date values", () => {
  assert.throws(() => publicSessionRows(null), /session rows/);
  assert.throws(() => publicSessionRows([{ created_at: "invalid", expires_at: "2026-11-08T10:00:00Z", is_current: true }]), RangeError);
});
