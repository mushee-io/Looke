import {z} from "zod";
import {address} from "./validation";

export const scanLimit=100;
export const safetyLagSeconds=120;
export const indexMutation=z.discriminatedUnion("action",[
 z.object({action:z.literal("scan")}).strict(),
 z.object({action:z.literal("rewind"),reason:z.string().trim().min(8).max(500)}).strict(),
]);
export const riskMutation=z.object({
 owner:address,
 signal:z.enum(["repeated_counterparty","high_daily_activity"]),
 counterparty:address.nullable(),
 disposition:z.enum(["review","dismissed","escalated"]),
 note:z.string().trim().min(8).max(500),
}).strict().superRefine((x,ctx)=>{
 if(x.signal==="repeated_counterparty"&&(!x.counterparty||x.counterparty===x.owner))
  ctx.addIssue({code:"custom",message:"A distinct, proven counterparty is required.",path:["counterparty"]});
 if(x.signal==="high_daily_activity"&&x.counterparty!==null)
  ctx.addIssue({code:"custom",message:"High velocity signals do not accept counterparties.",path:["counterparty"]});
});
export function indexWritesEnabled(){
 return process.env.LOOKE_M20_INDEX_WRITES_ENABLED==="true";
}
/** Pure cursor comparison for append/replay ordering across genuine source tables. */
export type IndexCursor={occurred_at:Date;kind:string;source_id:string};
export function compareCursor(a:IndexCursor,b:IndexCursor):number {
 const ta=new Date(a.occurred_at).getTime(),tb=new Date(b.occurred_at).getTime();
 if(!Number.isFinite(ta)||!Number.isFinite(tb))throw Error("Invalid index event timestamp.");
 if(ta!==tb)return ta<tb?-1:1;
 if(a.kind!==b.kind)return a.kind<b.kind?-1:1;
 return a.source_id===b.source_id?0:a.source_id<b.source_id?-1:1;
}
