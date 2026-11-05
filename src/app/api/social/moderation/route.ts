import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin,writesEnabled} from "../../../../lib/social/auth";
import {query,rateLimit,socialDb} from "../../../../lib/social/db";
import {failure,readJson} from "../../../../lib/social/http";
import {assertModerator,reportDecision} from "../../../../lib/social/m18";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};

/** Private moderator queue; pending media URLs must not appear in public feeds. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  assertModerator(actor);
  const [media,reports,audits]=await Promise.all([
   query<{id:string;author:string;handle:string;body:string;media_url:string;media_kind:string;created_at:Date}>(`
    SELECT p.id,p.author,pr.handle,p.body,p.media_url,p.media_kind,p.created_at
    FROM social_posts p JOIN social_profiles pr ON pr.address=p.author
    WHERE p.media_status='pending' AND p.media_url IS NOT NULL
      AND p.hidden=false AND p.deleted_at IS NULL
    ORDER BY p.created_at ASC,p.id ASC LIMIT 40`),
   query<{id:string;target_type:string;target_id:string;reporter_handle:string;
    reason:string;details:string;created_at:Date;target_body:string|null}>(`
    SELECT r.id,CASE WHEN r.post_id IS NULL THEN 'comment' ELSE 'post' END AS target_type,
      COALESCE(r.post_id,r.comment_id)::text AS target_id,
      rep.handle AS reporter_handle,r.reason,r.details,r.created_at,
      COALESCE(p.body,c.body) AS target_body
    FROM social_reports r
    JOIN social_profiles rep ON rep.address=r.reporter
    LEFT JOIN social_posts p ON p.id=r.post_id
    LEFT JOIN social_comments c ON c.id=r.comment_id
    WHERE r.reviewed_at IS NULL AND NOT EXISTS(
      SELECT 1 FROM social_report_resolutions s WHERE s.report_id=r.id)
    ORDER BY r.created_at ASC,r.id ASC LIMIT 40`),
   query<{action:string;target_id:string;created_at:Date;reason:string}>(`
    SELECT action,target_id,created_at,reason FROM social_moderation_audit
    ORDER BY created_at DESC LIMIT 10`),
  ]);
  return NextResponse.json({authorized:true,media:media.rows,reports:reports.rows,
   recentActions:audits.rows,source:"actual-postgres-review-queue"},{headers});
 }catch(error){return failure(error);}
}

/** Resolves one genuine user report with a transaction and permanent audit record. */
export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!writesEnabled())throw new HttpError(503,"Moderation writes are not enabled.");
  const actor=(await requireViewer(req)).address;
  assertModerator(actor);
  const input=reportDecision.parse(await readJson(req));
  await rateLimit(actor,"review_report",35,600);
  const conn=await socialDb().connect();
  try{
   await conn.query("BEGIN");
   const report=await conn.query<{post_id:string|null;comment_id:string|null}>(`
    SELECT post_id,comment_id FROM social_reports
    WHERE id=$1 AND reviewed_at IS NULL FOR UPDATE`,[input.reportId]);
   if(report.rowCount!==1)throw new HttpError(409,"Report already resolved or not found.");
   const target=report.rows[0];
   if(input.decision==="actioned"){
    const post=Boolean(target.post_id);
    const targetId=target.post_id??target.comment_id;
    const updated=await conn.query(post
      ?"UPDATE social_posts SET hidden=true WHERE id=$1 AND hidden=false RETURNING id"
      :"UPDATE social_comments SET hidden=true WHERE id=$1 AND hidden=false RETURNING id",
      [targetId]);
    if(updated.rowCount!==1)throw new HttpError(409,"Reported content is already hidden or missing.");
    await conn.query(`
      INSERT INTO social_moderation_audit(moderator,action,target_id,reason)
      VALUES($1,$2,$3,$4)
    `,[actor,post?"hide_post":"hide_comment",targetId,input.explanation]);
   }
   await conn.query(`
    INSERT INTO social_report_resolutions(report_id,moderator,decision,explanation)
    VALUES($1,$2,$3,$4)
   `,[input.reportId,actor,input.decision,input.explanation]);
   await conn.query("UPDATE social_reports SET reviewed_at=now() WHERE id=$1",[input.reportId]);
   await conn.query("COMMIT");
   return NextResponse.json({ok:true,reportId:input.reportId,
     decision:input.decision,audited:true},{headers});
  }catch(error){await conn.query("ROLLBACK");throw error;}finally{conn.release();}
 }catch(error){return failure(error);}
}
