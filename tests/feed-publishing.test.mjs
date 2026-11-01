import test from "node:test";
import assert from "node:assert/strict";
import {encodeFeedCursor,decodeFeedCursor} from "../lib/feed-pagination.mjs";
import {cleanPostText,checkedReportReason,checkedPostUuid} from "../lib/post-content.mjs";

const ID="6a7bdd63-66c2-41a2-9973-112233445566";
test("public feed cursor is stable across encoding and decoding",()=>{
  const cursor=encodeFeedCursor("2026-11-01T15:28:00.123456Z",ID);
  assert.deepEqual(decodeFeedCursor(cursor),{createdAt:"2026-11-01T15:28:00.123456Z",id:ID});
  assert.equal(encodeFeedCursor(...["2026-11-01T15:28:00.123456Z",ID]),cursor);
});
test("reject malformed and oversized cursor input",()=>{
  for(const cursor of ["","invalid","?".repeat(900),Buffer.from('["2026-02-30T10:00:00.000000Z","'+ID+'"]').toString("base64url"),
    Buffer.from('["2026-11-01T15:28:00.123456Z","../passwd"]').toString("base64url"),
    Buffer.from('{"id":"x"}').toString("base64url")]){
      assert.throws(()=>decodeFeedCursor(cursor),RangeError);
  }
});
test("publishing validation enforces correct text and control filtering",()=>{
  assert.equal(cleanPostText("  Hello\r\nUltra  "),"Hello\nUltra");
  assert.equal(cleanPostText("x".repeat(1200)).length,1200);
  for(const input of ["","    ","x".repeat(1201),"text\u0000broken",42,null]){
    assert.throws(()=>cleanPostText(input),RangeError);
  }
});
test("post IDs and reports reject user-supplied arbitrary values",()=>{
  assert.equal(checkedPostUuid(ID.toUpperCase()),ID);
  assert.throws(()=>checkedPostUuid("../../../other"),RangeError);
  assert.equal(checkedReportReason("spam"),"spam");
  for(const reason of ["", "not-a-reason", null, {"spam":true}])assert.throws(()=>checkedReportReason(reason),RangeError);
});
