import test from "node:test";
import assert from "node:assert/strict";
import {scoreRewardDay,computeCommunityParticipation,utcWindow,checkedRewardDay,
 checkedSnapshotCursor,MAX_DAILY_SCORE,CATEGORY_POLICY} from "../lib/community-rewards.mjs";
const asOf="2026-11-01T19:00:00.000Z";
const row=(day,overrides={})=>({day,posts:0,comments:0,likes:0,reposts:0,follows:0,...overrides});
test("scores only observed moderated-source events and enforces strict category caps",()=>{
 const entry=scoreRewardDay(row("2026-10-31",{posts:100,comments:400,likes:1000,reposts:30,follows:60}));
 assert.equal(entry.points,MAX_DAILY_SCORE);
 assert.equal(MAX_DAILY_SCORE,37);
 assert.equal(entry.counts.posts.counted,2);
 assert.equal(entry.counts.likes.excludedByCap,996);
 assert.equal(entry.counts.follows.points,CATEGORY_POLICY.follows.weight*2);
 for(const value of [row("2026-11-31"),row("2026-10-31",{likes:-1}),
  row("2026-10-31",{posts:1.5}),row("2026-10-31",{comments:"3"})])
  assert.throws(()=>scoreRewardDay(value),RangeError);
});
test("14-day provisional ledger distinguishes activity score from eligibility",()=>{
 const days=[row("2026-10-31",{posts:2,comments:1}),
   row("2026-10-30",{likes:1}),row("2026-10-29",{reposts:1})];
 const report=computeCommunityParticipation({
  rows:days,createdAt:"2026-10-01T00:00:00Z",asOf,uniqueCounterpartCreators:2
 });
 assert.equal(report.totalProvisionalPoints,22);
 assert.equal(report.activeDays,3);
 assert.equal(report.qualifiesForManualReview,true);
 assert.equal(report.claimableRewards,false);
 assert.equal(report.creditedTokens,"0");
 assert.equal(report.distributionEnabled,false);
 const newProfile=computeCommunityParticipation({
  rows:days,createdAt:"2026-10-31T10:00:00Z",asOf,uniqueCounterpartCreators:2
 });
 assert.equal(newProfile.qualifiesForManualReview,false);
 assert.equal(newProfile.prerequisites[0].passed,false);
 assert.equal(computeCommunityParticipation({
  rows:days,createdAt:"2026-10-01",asOf,uniqueCounterpartCreators:1
 }).qualifiesForManualReview,false);
});
test("reward window uses UTC calendar days and excludes future activity",()=>{
 assert.deepEqual(utcWindow(asOf),{
  start:"2026-10-19T00:00:00.000Z",end:asOf,
  startDay:"2026-10-19",endDay:"2026-11-01"
 });
 assert.deepEqual(utcWindow(asOf,true),{
  start:"2026-10-18T00:00:00.000Z",end:"2026-11-01T00:00:00.000Z",
  startDay:"2026-10-18",endDay:"2026-11-01"
 });
 assert.equal(checkedRewardDay("2026-02-28"),"2026-02-28");
 assert.throws(()=>checkedRewardDay("2026-02-29"),RangeError);
});
test("data manipulation, duplicate days and bad cursors fail closed",()=>{
 for(const rows of [[row("2026-10-31"),row("2026-10-31")],
  Array(15).fill(row("2026-10-30"))])
  assert.throws(()=>computeCommunityParticipation({
   rows,createdAt:"2026-10-01",asOf,uniqueCounterpartCreators:2
  }),RangeError);
 for(const x of ["foo",23,"../a","0".repeat(34)])
  assert.throws(()=>checkedSnapshotCursor(x),RangeError);
 assert.equal(checkedSnapshotCursor(null),null);
});
