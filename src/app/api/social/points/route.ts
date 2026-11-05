import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../lib/social/auth";
import {query} from "../../../../lib/social/db";
import {failure} from "../../../../lib/social/http";
import {uuid} from "../../../../lib/social/validation";
import {vestingAt} from "../../../../lib/social/points";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Season={
 id:string;slug:string;title:string;state:string;
 starts_at:Date;ends_at:Date;vest_start_at:Date;vest_cliff_at:Date;vest_end_at:Date;
 points_post:number;points_comment:number;points_like_received:number;points_repost_received:number;
 approved:string;pending:string;rejected:string;reversed:string;
};
type Entry={id:string;season_id:string;slug:string;source_kind:string;source_id:string;
 points:number;status:string;review_note:string|null;activity_at:Date;recorded_at:Date;reviewed_at:Date|null};
export async function GET(request:NextRequest){
 try{
  const owner=(await requireViewer(request)).address;
  const asOf=new Date(); // server UTC, never browser clock or client-submitted time.
  const cursor=request.nextUrl.searchParams.get("cursor");
  const parsedCursor=cursor?uuid.parse(cursor):null;
  const [seasons,events]=await Promise.all([
   query<Season>(`
    SELECT s.id,s.slug,s.title,s.state,s.starts_at,s.ends_at,
      s.vest_start_at,s.vest_cliff_at,s.vest_end_at,
      s.points_post,s.points_comment,s.points_like_received,s.points_repost_received,
      COALESCE(SUM(l.points) FILTER(WHERE l.status='approved'),0)::text AS approved,
      COALESCE(SUM(l.points) FILTER(WHERE l.status='pending'),0)::text AS pending,
      COALESCE(SUM(l.points) FILTER(WHERE l.status='rejected'),0)::text AS rejected,
      COALESCE(SUM(l.points) FILTER(WHERE l.status='reversed'),0)::text AS reversed
    FROM social_points_seasons s
    LEFT JOIN social_points_ledger l ON l.season_id=s.id AND l.owner=$1
    WHERE s.state IN ('active','closed') OR l.id IS NOT NULL
    GROUP BY s.id ORDER BY s.starts_at DESC,s.id DESC LIMIT 20
   `,[owner]),
   query<Entry>(`
    SELECT l.id,l.season_id,s.slug,l.source_kind,l.source_id,l.points,l.status,
      l.review_note,l.activity_at,l.recorded_at,l.reviewed_at
    FROM social_points_ledger l JOIN social_points_seasons s ON s.id=l.season_id
    WHERE l.owner=$1 AND ($2::uuid IS NULL OR (l.recorded_at,l.id) <
      (SELECT recorded_at,id FROM social_points_ledger
       WHERE id=$2 AND owner=$1))
    ORDER BY l.recorded_at DESC,l.id DESC LIMIT 41
   `,[owner,parsedCursor]),
  ]);
  const items=seasons.rows.map(s=>({
   id:s.id,slug:s.slug,title:s.title,state:s.state,
   startsAt:s.starts_at,endsAt:s.ends_at,
   vestingStart:s.vest_start_at,vestingCliff:s.vest_cliff_at,vestingEnd:s.vest_end_at,
   policy:{post:s.points_post,comment:s.points_comment,
    likeReceived:s.points_like_received,repostReceived:s.points_repost_received},
   approvedPoints:s.approved,pendingPoints:s.pending,
   rejectedPoints:s.rejected,reversedPoints:s.reversed,
   vesting:vestingAt({total:s.approved,start:s.vest_start_at,cliff:s.vest_cliff_at,
     end:s.vest_end_at,asOf}),
  }));
  return NextResponse.json({
   authenticated:true,ownerScoped:true,source:"reviewed-postgres-evidence-ledger",
   unit:"LOOKE_POINTS",asOf:asOf.toISOString(),tokensIssued:false,claimingEnabled:false,
   transferable:false,seasons:items,
   history:events.rows.slice(0,40),
   nextCursor:events.rows.length>40?events.rows[39]?.id:null,
   safetyNote:"Off-chain, reviewed participation Points only. Vesting is a schedule, not a token, redemption, claim or promise of allocation.",
  },{headers:{"cache-control":"private, no-store"}});
 }catch(error){return failure(error);}
}
