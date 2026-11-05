import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin,writesEnabled} from "../../../../../lib/social/auth";
import {rateLimit,socialDb} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {accountingEnabled,dailyLimits,operatorAction,type SourceKind} from "../../../../../lib/social/points";
import {lookupEvidence,utcActivityDay} from "../../../../../lib/social/points-evidence";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};
type Season={id:string;state:string;starts_at:Date;ends_at:Date;
 points_post:number;points_comment:number;points_like_received:number;points_repost_received:number};
type Ledger={id:string;season_id:string;owner:string;source_kind:SourceKind;
 source_id:string;status:string};

export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  assertModerator(actor);
  const conn=await socialDb().connect();
  try{
   const [pending,seasons,candidates]=await Promise.all([
    conn.query<{id:string;owner:string;kind:string;points:number;slug:string;recorded_at:Date}>(`
      SELECT l.id,l.owner,l.source_kind AS kind,l.points,s.slug,l.recorded_at
      FROM social_points_ledger l JOIN social_points_seasons s ON s.id=l.season_id
      WHERE l.status='pending'
      ORDER BY l.recorded_at ASC,l.id ASC LIMIT 40`),
    conn.query<{id:string;slug:string;title:string}>(`
      SELECT id,slug,title FROM social_points_seasons
      WHERE state='active' AND starts_at<=now() AND ends_at>now()
      ORDER BY starts_at DESC LIMIT 10`),
    conn.query<{kind:SourceKind;source_id:string;owner:string;handle:string;activity_at:Date}>(`
      WITH real_sources AS (
        SELECT 'post'::text AS kind,p.id AS source_id,p.author AS owner,
          p.created_at AS activity_at
        FROM social_posts p
        WHERE p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')
        UNION ALL
        SELECT 'comment'::text,c.id,c.author,c.created_at
        FROM social_comments c JOIN social_posts p ON p.id=c.post_id
        WHERE c.hidden=false AND p.hidden=false AND p.deleted_at IS NULL
          AND (p.media_url IS NULL OR p.media_status='approved')
          AND c.author<>p.author
        UNION ALL
        SELECT 'like_received'::text,l.id,p.author,l.created_at
        FROM social_post_likes l JOIN social_posts p ON p.id=l.post_id
        WHERE p.hidden=false AND p.deleted_at IS NULL
          AND l.actor<>p.author
          AND (p.media_url IS NULL OR p.media_status='approved')
        UNION ALL
        SELECT 'repost_received'::text,r.id,p.author,r.created_at
        FROM social_post_reposts r JOIN social_posts p ON p.id=r.post_id
        WHERE p.hidden=false AND p.deleted_at IS NULL
          AND r.actor<>p.author
          AND (p.media_url IS NULL OR p.media_status='approved')
      )
      SELECT src.*,pr.handle FROM real_sources src
      JOIN social_profiles pr ON pr.address=src.owner
      WHERE pr.suspended=false AND NOT EXISTS(
        SELECT 1 FROM social_points_ledger l
        WHERE l.source_kind=src.kind AND l.source_id=src.source_id)
      ORDER BY src.activity_at DESC,src.source_id DESC LIMIT 30`),
   ]);
   return NextResponse.json({authorized:true,pending:pending.rows,
     activeSeasons:seasons.rows.length,seasons:seasons.rows,
     candidates:candidates.rows,source:"real-review-queue"},{headers});
  }finally{conn.release();}
 }catch(error){return failure(error);}
}

export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!writesEnabled()||!accountingEnabled())
    throw new HttpError(503,"Looke Points accounting is disabled pending operator approval.");
  const reviewer=(await requireViewer(req)).address;
  assertModerator(reviewer);
  const input=operatorAction.parse(await readJson(req));
  await rateLimit(reviewer,"points_review",60,600);
  const conn=await socialDb().connect();
  try{
   await conn.query("BEGIN");
   if(input.action==="queue"){
    const season=await conn.query<Season>(`
      SELECT id,state,starts_at,ends_at,points_post,points_comment,
        points_like_received,points_repost_received
      FROM social_points_seasons WHERE id=$1 AND state='active' FOR SHARE`,
      [input.seasonId]);
    if(season.rowCount!==1)throw new HttpError(404,"No active approved season exists.");
    const policy=season.rows[0];
    const evidence=await lookupEvidence(conn,input.kind,input.sourceId);
    if(!evidence)throw new HttpError(404,"No valid current social participation proof.");
    const at=new Date(evidence.activity_at);
    if(at<new Date(policy.starts_at)||at>=new Date(policy.ends_at)||at>new Date())
      throw new HttpError(409,"Source timestamp is outside the actual active season.");
    const day=utcActivityDay(at);
    // A single reviewed evidence item is not an automatic reward; it remains pending.
    // The signed-in operator cannot set owner, actor, points, day or season policy.
    // Serialize per owner / season / activity type / UTC date to enforce caps
    // even with concurrent moderator sessions.
    await conn.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))",
      [policy.id+":"+evidence.owner+":"+input.kind+":"+day]);
    const count=await conn.query<{count:number}>(`
      SELECT count(*)::integer AS count FROM social_points_ledger
      WHERE season_id=$1 AND owner=$2 AND source_kind=$3 AND activity_day=$4`,
      [policy.id,evidence.owner,input.kind,day]);
    if(count.rows[0].count>=dailyLimits[input.kind])
      throw new HttpError(409,"Daily participation cap reached for this wallet and category.");
    const points={
      post:policy.points_post,comment:policy.points_comment,
      like_received:policy.points_like_received,repost_received:policy.points_repost_received,
    }[input.kind];
    const inserted=await conn.query<{id:string}>(`
      INSERT INTO social_points_ledger
        (season_id,owner,source_kind,source_id,source_actor,activity_at,activity_day,points)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT DO NOTHING RETURNING id
    `,[policy.id,evidence.owner,input.kind,input.sourceId,evidence.actor,at,day,points]);
    if(inserted.rowCount!==1)throw new HttpError(409,"This activity has already been recorded.");
    await conn.query("COMMIT");
    return NextResponse.json({ok:true,id:inserted.rows[0].id,status:"pending",
      sourceVerified:true,points,owner:evidence.owner,token:false},{headers});
   }
   const found=await conn.query<Ledger>(`
     SELECT id,season_id,owner,source_kind,source_id,status FROM social_points_ledger
     WHERE id=$1 FOR UPDATE`,[input.entryId]);
   if(found.rowCount!==1)throw new HttpError(404,"Points evidence record was not found.");
   const current=found.rows[0];
   const legal=current.status==="pending"&&input.decision!=="reversed"||
     current.status==="approved"&&input.decision==="reversed";
   if(!legal)throw new HttpError(409,"Points review transition not allowed.");
   if(input.decision==="approved"){
    const currentEvidence=await lookupEvidence(conn,current.source_kind,current.source_id);
    if(!currentEvidence||currentEvidence.owner!==current.owner)
      throw new HttpError(409,"Source lost verified eligibility; reject or leave pending for review.");
   }
   await conn.query(`
     UPDATE social_points_ledger SET status=$2,review_note=$3,
       reviewed_by=$4,reviewed_at=now() WHERE id=$1
   `,[current.id,input.decision,input.reason,reviewer]);
   await conn.query(`
     INSERT INTO social_points_review_audit(ledger_id,moderator,decision,reason)
     VALUES($1,$2,$3,$4)
   `,[current.id,reviewer,input.decision,input.reason]);
   await conn.query("COMMIT");
   return NextResponse.json({ok:true,id:current.id,status:input.decision,
     audited:true,token:false},{headers});
  }catch(e){
   await conn.query("ROLLBACK");
   if((e as {code?:string}).code==="23505")
     throw new HttpError(409,"A duplicate source or counterparty has already been counted.");
   throw e;
  }finally{conn.release();}
 }catch(error){return failure(error);}
}
