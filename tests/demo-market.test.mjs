import test from "node:test";
import assert from "node:assert/strict";
import { parseCompactNumber, parseAgeHours } from "../lib/demo-market.mjs";

test("parse market caps and volumes with K/M/B suffixes", () => {
  assert.equal(parseCompactNumber("$3.8m"), 3_800_000);
  assert.equal(parseCompactNumber("$968k"), 968_000);
  assert.equal(parseCompactNumber("$9.6k"), 9_600);
  assert.equal(parseCompactNumber("4,820"), 4_820);
  assert.equal(parseCompactNumber("$1.2b"), 1_200_000_000);
  assert.ok(Number.isNaN(parseCompactNumber("not money")));
});
test("sort demo ages by absolute time, not leading digit", () => {
  assert.equal(parseAgeHours("7h"), 7);
  assert.equal(parseAgeHours("2d"), 48);
  assert.equal(parseAgeHours("12d"), 288);
  assert.equal(parseAgeHours("15m"), 0.25);
  assert.ok(parseAgeHours("7h") < parseAgeHours("2d"));
  assert.ok(Number.isNaN(parseAgeHours("soon")));
});
