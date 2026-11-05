import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {engagementMutation,mutations,activityKind,summaryFromRows} from "../src/lib/social/engagement";

test("M17 accepts only exact bounded actions and canonical post UUIDs",()=>{
 const postId="11111111-1111-4111-8111-111111111111";
 assert.equal(engagementMutation.parse({action:"like",postId}).action,"like");
 for(const action of ["follow","sendMessage","swap","__proto__","engage"]){
  assert.throws(()=>engagementMutation.parse({action,postId}));
 }
 assert.throws(()=>engagementMutation.parse({action:"like",postId,actor:"0x123"}));
 assert.throws(()=>engagementMutation.parse({action:"repost",postId:"not-a-uuid"}));
 assert.throws(()=>activityKind.parse("messages"));
});
test("M17 mutations never interpolate a user-selected SQL table",()=>{
 assert.deepEqual(Object.keys(mutations).sort(),[
  "bookmark","like","repost","unbookmark","unlike","unrepost",
 ].sort());
 assert.equal(mutations.like.table,"social_post_likes");
 assert.equal(mutations.repost.table,"social_post_reposts");
 assert.equal(mutations.bookmark.table,"social_post_bookmarks");
 assert.equal(mutations.unbookmark.add,false);
 assert.equal(mutations.unlike.add,false);
 assert.equal(mutations.unrepost.add,false);
 assert.equal(mutations.repost.allowSelf,false);
 assert.equal(mutations.like.allowSelf,false);
 assert.equal(mutations.bookmark.allowSelf,true);
});
test("Engagement summaries contain only genuine database counts and viewer booleans",()=>{
 assert.deepEqual(summaryFromRows({
  like_count:7,repost_count:2,liked_by_me:false,reposted_by_me:true,bookmarked_by_me:true,
 }),{like_count:7,repost_count:2,liked_by_me:false,reposted_by_me:true,bookmarked_by_me:true});
});
test("M17 server routes preserve signed origin, moderation and nonfinancial gates",()=>{
 const source=readFileSync(resolve("src/app/api/social/engagement/route.ts"),"utf8");
 const feed=readFileSync(resolve("src/app/api/social/route.ts"),"utf8");
 const notifications=readFileSync(resolve("src/app/api/experience/notifications/route.ts"),"utf8");
 assert.match(source,/verifyRequestOrigin\(req\)/);
 assert.match(source,/requireViewer\(req\)/);
 assert.match(source,/writesEnabled\(\)/);
 assert.match(source,/FOR SHARE OF p/);
 assert.match(source,/social_blocks/);
 assert.match(source,/media_status='approved'/);
 assert.match(source,/ON CONFLICT\(actor,post_id\) DO NOTHING/);
 assert.match(source,/WHERE actor=\$1 AND post_id=\$2/);
 assert.match(feed,/social_post_reposts/);
 assert.match(feed,/social_post_likes/);
 assert.match(notifications,/social_post_reposts/);
 assert.match(notifications,/social_post_likes/);
 assert.ok(!source.includes("eth_sendTransaction"));
 assert.ok(!source.includes("sendMessage("));
});
