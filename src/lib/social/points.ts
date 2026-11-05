import {z} from "zod";
import {uuid} from "./validation";

export const sourceKind=z.enum(["post","comment","like_received","repost_received"]);
export type SourceKind=z.infer<typeof sourceKind>;
export const operatorAction=z.discriminatedUnion("action",[
 z.object({action:z.literal("queue"),seasonId:uuid,kind:sourceKind,sourceId:uuid}).strict(),
 z.object({action:z.literal("review"),entryId:uuid,
   decision:z.enum(["approved","rejected","reversed"]),
   reason:z.string().trim().min(8).max(500)}).strict(),
]);
export function accountingEnabled(){
 return process.env.LOOKE_POINTS_ACCOUNTING_ENABLED==="true";
}
export const dailyLimits:Record<SourceKind,number>={
 post:2,comment:5,like_received:5,repost_received:3,
};
/** Compute exact, *read-only* informational vesting of reviewed off-chain Points. */
export function vestingAt(params:{
 total:string|number|bigint;start:string|Date;cliff:string|Date;
 end:string|Date;asOf:string|Date;
}){
 const total=BigInt(params.total);
 const start=new Date(params.start).getTime();
 const cliff=new Date(params.cliff).getTime();
 const end=new Date(params.end).getTime();
 const now=new Date(params.asOf).getTime();
 if(total<0n||![start,cliff,end,now].every(Number.isFinite)
   ||!(start<=cliff&&cliff<end))throw new Error("Invalid reviewed Points vesting schedule.");
 let unlocked=0n;
 if(now>=end)unlocked=total;
 else if(now>=cliff&&now>=start)
   unlocked=total*BigInt(now-start)/BigInt(end-start);
 return {total:total.toString(),unlocked:unlocked.toString(),
   scheduled: (total-unlocked).toString(),claimable:false,unit:"LOOKE_POINTS" as const};
}
