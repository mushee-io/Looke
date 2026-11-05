import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {query,socialDb} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {reconcileApproved} from "../../../../../lib/social/m20-reconcile";

export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Moderator-only, read-only health: real DB evidence, not invented uptime. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const [checkpoint,indexed,pending,unresolved,audit,review,latest]=await Promise.all([
   query<{revision:string;cursor_at:Date;updated_at:Date}>(`
    SELECT revision,cursor_at,updated_at FROM social_index_checkpoints
    WHERE stream='creator_activity'`),
   query<{count:number}>(`SELECT count(*)::integer AS count FROM social_activity_index`),
   query<{count:number}>(`SELECT count(*)::integer AS count FROM social_points_ledger WHERE status='pending'`),
   query<{count:number}>(`SELECT count(*)::integer AS count FROM social_reports WHERE reviewed_at IS NULL`),
   query<{count:number}>(`SELECT count(*)::integer AS count FROM social_moderation_audit
      WHERE created_at>now()-interval '24 hours'`),
   query<{count:number}>(`SELECT count(*)::integer AS count FROM social_points_review_audit
      WHERE created_at>now()-interval '24 hours'`),
   query<{action:string;created_at:Date;scanned:number;inserted:number}>(`
    SELECT action,created_at,scanned,inserted FROM social_index_runs
    ORDER BY created_at DESC,id DESC LIMIT 1`),
  ]);
  const cp=checkpoint.rows[0];
  if(!cp)throw new Error("Index checkpoint not migrated.");
  const conn=await socialDb().connect();
  let reconciliation;
  try{reconciliation=await reconcileApproved(conn,40);}finally{conn.release();}
  return NextResponse.json({
   authorized:true,source:"live-postgres-only",dbReachable:true,
   index:{
    recordedEvents:indexed.rows[0].count,revision:cp.revision,cursorAt:cp.cursor_at,
    checkpointUpdated:cp.updated_at,lastRun:latest.rows[0]??null,
    completeCoverageClaim:false,manualOnly:true,
   },
   queues:{pendingPoints:pending.rows[0].count,unresolvedReports:unresolved.rows[0].count},
   audit24h:{moderationActions:audit.rows[0].count,pointsDecisions:review.rows[0].count},
   reconciliation,
   note:"Read-only live checks; no worker, cron, token mint, Points approval or recovery was executed.",
  },{headers:{"cache-control":"private, no-store"}});
 }catch(e){return failure(e);}
}
