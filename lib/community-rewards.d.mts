export const REWARD_POLICY_VERSION:number;
export const REWARD_WINDOW_DAYS:number;
export const REWARD_SNAPSHOT_BATCH:number;
export const CATEGORY_POLICY:Readonly<Record<string,{readonly weight:number;readonly maxPerDay:number}>>;
export const MAX_DAILY_SCORE:number;
export type RewardDayRow={day:string;posts:number;comments:number;likes:number;reposts:number;follows:number};
export type ScoredDay={day:string;points:number;breakdown:Record<string,number>;
 counts:Record<string,{observed:number;counted:number;excludedByCap:number;points:number}>};
export function checkedRewardDay(value:unknown):string;
export function scoreRewardDay(value:RewardDayRow):ScoredDay;
export function computeCommunityParticipation(args:{
 rows:RewardDayRow[];createdAt:string|Date;asOf:string|Date;uniqueCounterpartCreators:number;
}):{
 policyVersion:number;windowDays:number;totalProvisionalPoints:number;daily:ScoredDay[];
 activeDays:number;accountAgeDays:number;uniqueCounterpartCreators:number;
 dailyMaximum:number;prerequisites:Array<{id:string;passed:boolean;label:string}>;
 qualifiesForManualReview:boolean;status:string;creditedTokens:string;
 claimableRewards:false;distributionEnabled:false;warning:string;
};
export function utcWindow(asOf:string|Date,completedOnly?:boolean):{
 start:string;end:string;startDay:string;endDay:string;
};
export function checkedSnapshotCursor(value:unknown):string|null;
