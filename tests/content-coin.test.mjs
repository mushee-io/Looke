import test from "node:test";
import assert from "node:assert/strict";
import {checkedContentPostId,normalizeContentCoinDraft,contentSnapshot,contentSnapshotIsCurrent,MAX_CONTENT_DRAFTS} from "../lib/content-coin.mjs";
const id="ed827d1a-a415-4b6a-8a5c-d47ec09dd931";
const a="0x1234567890abcdef1234567890abcdef12345678";
const b="0x1234567890abcdef1234567890abcdef87654321";
const uri="ipfs://Qm"+"a".repeat(44)+"/metadata.json";
const draft={postId:id,name:"Ultra Content",symbol:"POST",supplyTokens:"50000",metadataURI:uri};

test("content coin draft requires one bounded valid source post and M9 token rules",()=>{
 assert.deepEqual(normalizeContentCoinDraft(draft),{...draft,supplyTokens:50000});
 for(const bad of [
  {...draft,postId:"../../posts"}, {...draft,postId:"abc"},
  {...draft,supplyTokens:"0"},{...draft,symbol:"lower"},
  {...draft,creatorAddress:a},null,[],{}
 ])assert.throws(()=>normalizeContentCoinDraft(bad),RangeError);
 assert.equal(MAX_CONTENT_DRAFTS,20);
 assert.equal(checkedContentPostId(id.toUpperCase()),id);
});
test("content snapshot is deterministic, domain separated and bound to author, post and exact text",()=>{
 const first=contentSnapshot(id,a,"Hello Ultra");
 assert.match(first.contentRef,/^0x[0-9a-f]{64}$/);
 assert.match(first.textHash,/^0x[0-9a-f]{64}$/);
 assert.equal(first.version,"looke.content.v1");
 assert.equal(first.chainId,18881);
 assert.deepEqual(contentSnapshot(id.toUpperCase(),a.toUpperCase(),"Hello Ultra"),first);
 assert.notEqual(contentSnapshot(id,a,"Hello Ultra edited").contentRef,first.contentRef);
 assert.notEqual(contentSnapshot(id,b,"Hello Ultra").contentRef,first.contentRef);
 assert.notEqual(contentSnapshot("ed827d1a-a415-4b6a-8a5c-d47ec09dd932",a,"Hello Ultra").contentRef,first.contentRef);
 assert.equal(contentSnapshotIsCurrent(first,id,a,"Hello Ultra"),true);
 assert.equal(contentSnapshotIsCurrent(first,id,a,"Hello Ultra edited"),false);
 assert.equal(contentSnapshotIsCurrent(null,id,a,"Hello Ultra"),false);
});
test("content binding rejects empty posts and invalid creator identity",()=>{
 assert.throws(()=>contentSnapshot(id,"0x123","valid"),RangeError);
 assert.throws(()=>contentSnapshot(id,a," "),RangeError);
 assert.throws(()=>contentSnapshot(id,a,"x".repeat(1201)),RangeError);
 assert.throws(()=>contentSnapshot("not-an-id",a,"hello"),RangeError);
});
