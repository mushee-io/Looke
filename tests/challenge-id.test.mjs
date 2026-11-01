import test from "node:test";
import assert from "node:assert/strict";
import { validChallengeId } from "../lib/challenge-id.mjs";

test("accepts canonical UUID-shaped challenge IDs", () => {
  assert.equal(validChallengeId("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(validChallengeId("123E4567-E89B-12D3-A456-426614174000"), true);
});

test("rejects malformed or non-string challenge IDs", () => {
  for (const value of [null, undefined, 0, {}, "", "123e4567e89b12d3a456426614174000",
    "123e4567-e89b-12d3-a456-42661417400-", "123e4567-e89b-12d3-a456-426614174000-",
    "123e4567-e89b-12d3-a456-42661417400g", "123e4567--89b-12d3-a456-426614174000"]) {
    assert.equal(validChallengeId(value), false, String(value));
  }
});
