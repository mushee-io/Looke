/**
 * M19 participation policy v1. These are NON-REDEEMABLE activity scores,
 * not token rewards, earnings, airdrop eligibility, transferable XP or debt.
 * Zero qualifying actions = zero provisional score.
 */
export const REWARD_POLICY_VERSION=1;
export const REWARD_WINDOW_DAYS=14;
export const REWARD_SNAPSHOT_BATCH=50;
export const CATEGORY_POLICY=Object.freeze({
 posts:Object.freeze({weight:8,maxPerDay:2}),
 comments:Object.freeze({weight:3,maxPerDay:3}),
 likes:Object.freeze({weight:1,maxPerDay:4}),
 reposts:Object.freeze({weight:2,maxPerDay:3}),
 follows:Object.freeze({weight:1,maxPerDay:2}),
});
export const MAX_DAILY_SCORE=Object.entries(CATEGORY_POLICY).reduce((n,[,v])=>n+v.weight*v.maxPerDay,0);
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export function checkedRewardDay(value){
 if(typeof value!=="string"||!DAY.test(value))throw new RangeError("Expected a UTC YYYY-MM-DD date");
 const date=new Date(value+"T00:00:00.000Z");
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)
  throw new RangeError("Invalid UTC day");
 return value;
}
function safeCount(value,label){
 if(typeof value!=="number"||!Number.isSafeInteger(value)||value<0||value>1_000_000)
  throw new RangeError("Invalid "+label+" event count");
 return value;
}
export function scoreRewardDay(row){
 if(!row||typeof row!=="object"||Array.isArray(row))throw new RangeError("Invalid activity row");
 const day=checkedRewardDay(row.day);
 const breakdown={},counts={};
 let points=0;
 for(const [kind,rule] of Object.entries(CATEGORY_POLICY)){
  const count=safeCount(row[kind],kind);
  const counted=Math.min(count,rule.maxPerDay);
  const awarded=counted*rule.weight;
  counts[kind]={observed:count,counted,excludedByCap:count-counted,points:awarded};
  breakdown[kind]=awarded;
  points+=awarded;
 }
 if(points>MAX_DAILY_SCORE)throw new RangeError("Reward score cap was exceeded");
 return {day,points,breakdown,counts};
}
export function computeCommunityParticipation({rows,createdAt,asOf,uniqueCounterpartCreators}){
 if(!Array.isArray(rows)||rows.length>REWARD_WINDOW_DAYS)
  throw new RangeError("Invalid rolling participation data");
 const now=new Date(asOf),joined=new Date(createdAt);
 if(!Number.isFinite(now.getTime())||!Number.isFinite(joined.getTime())||
    joined.getTime()>now.getTime())throw new RangeError("Invalid account age");
 const counterparts=safeCount(uniqueCounterpartCreators,"counterpart creators");
 const seen=new Set();
 const daily=rows.map(row=>{
  const entry=scoreRewardDay(row);
  if(seen.has(entry.day))throw new RangeError("Duplicate participation day");
  seen.add(entry.day);return entry;
 }).sort((a,b)=>b.day.localeCompare(a.day));
 const total=daily.reduce((sum,x)=>sum+x.points,0);
 const activeDays=daily.filter(x=>x.points>0).length;
 const ageDays=Math.floor((now.getTime()-joined.getTime())/86_400_000);
 const prerequisites=[
  {id:"account_age",passed:ageDays>=7,label:"Profile is at least 7 days old"},
  {id:"active_days",passed:activeDays>=3,label:"At least 3 active days in the rolling window"},
  {id:"distinct_creators",passed:counterparts>=2,label:"Interact with 2 distinct other creators"},
 ];
 return {
  policyVersion:REWARD_POLICY_VERSION,windowDays:REWARD_WINDOW_DAYS,
  totalProvisionalPoints:total,daily,
  activeDays,accountAgeDays:ageDays,uniqueCounterpartCreators:counterparts,
  dailyMaximum:MAX_DAILY_SCORE,prerequisites,
  qualifiesForManualReview:prerequisites.every(x=>x.passed),
  status:"provisional_non_redeemable",
  creditedTokens:"0",claimableRewards:false,distributionEnabled:false,
  warning:"Activity score is dynamically derived from currently visible records. It is not an entitlement; multi-account abuse checks, operator moderation and external audits remain outstanding."
 };
}
export function utcWindow(asOf,completedOnly=false){
 const date=new Date(asOf);
 if(!Number.isFinite(date.getTime()))throw new RangeError("Invalid reward clock");
 const startOfToday=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
 const end=completedOnly?startOfToday:date.getTime();
 const start=startOfToday-(completedOnly?14:13)*86_400_000;
 return {start:new Date(start).toISOString(),end:new Date(end).toISOString(),
  startDay:new Date(start).toISOString().slice(0,10),
  endDay:new Date(end).toISOString().slice(0,10)};
}
export function checkedSnapshotCursor(value){
 if(value===null||value===undefined||value==="")return null;
 if(typeof value!=="string"||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
  throw new RangeError("Invalid snapshot cursor");
 return value.toLowerCase();
}
