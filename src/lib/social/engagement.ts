import {z} from "zod";
import {uuid} from "./validation";

/** Exact, non-user-defined SQL table and operation mappings. */
export const engagementMutation=z.object({
 action:z.enum(["like","unlike","repost","unrepost","bookmark","unbookmark"]),
 postId:uuid,
}).strict();
export type EngagementAction=z.infer<typeof engagementMutation>["action"];
export const mutations:Record<EngagementAction,{table:string;add:boolean;allowSelf:boolean}>={
 like:{table:"social_post_likes",add:true,allowSelf:false},
 unlike:{table:"social_post_likes",add:false,allowSelf:true},
 repost:{table:"social_post_reposts",add:true,allowSelf:false},
 unrepost:{table:"social_post_reposts",add:false,allowSelf:true},
 bookmark:{table:"social_post_bookmarks",add:true,allowSelf:true},
 unbookmark:{table:"social_post_bookmarks",add:false,allowSelf:true},
};
export const activityKind=z.enum(["all","likes","reposts","bookmarks"]);
export function summaryFromRows(row:{
 like_count:number;repost_count:number;liked_by_me:boolean;
 reposted_by_me:boolean;bookmarked_by_me:boolean;
}){
 return {
  like_count:Number(row.like_count),repost_count:Number(row.repost_count),
  liked_by_me:Boolean(row.liked_by_me),reposted_by_me:Boolean(row.reposted_by_me),
  bookmarked_by_me:Boolean(row.bookmarked_by_me),
 };
}
