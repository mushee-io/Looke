import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin,writesEnabled} from "../../../../../lib/social/auth";
import {query,rateLimit} from "../../../../../lib/social/db";
import {failure,readJson} from "../../../../../lib/social/http";
import {assertModerator} from "../../../../../lib/social/m18";
import {indexWritesEnabled,riskMutation} from "../../../../../lib/social/m20";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};

export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const [repeated,bursts,reviewed]=await Promise.all([
   query<{owner:string;counterparty:string;events:number}>(`
    SELECT owner,source_actor AS counterparty,count(*)::integer AS events
    FROM social_activity_index WHERE owner<>source_actor
      AND kind IN ('like_received','repost_received')
      AND occurred_at>now()-interval '24 hours'
    GROUP BY owner,source_actor HAVING count(*)>=3
    ORDER BY events DESC,owner ASC LIMIT 20`),
   query<{owner:string;events:number}>(`
    SELECT source_actor AS owner,count(*)::integer AS events
    FROM social_activity_index WHERE owner=source_actor
      AND kind='post' AND occurred_at>now()-interval '24 hours'
    GROUP BY source_actor HAVING count(*)>=8
    ORDER BY events DESC,source_actor ASC LIMIT 20`),
   query<{id:string;owner:string;signal:string;counterparty:string|null;
      disposition:string;reviewer:string;note:string;created_at:Date}>(`
    SELECT id,owner,signal,counterparty,disposition,reviewer,note,created_at
    FROM social_risk_review_events ORDER BY created_at DESC,id DESC LIMIT 40`),
  ]);
  return NextResponse.json({authorized:true,
   candidates:{
    repeatedCounterparties:repeated.rows,
    highDailyPosting:bursts.rows,
   },
   reviews:reviewed.rows,
   evidenceWindow:"last_24_hours_of_indexed_real_events",
   confidence:"signals_only_not_unique-human-proof",
   status:"manual_review_required",source:"recorded-postgres-events",
  },{headers});
 }catch(e){return failure(e);}
}

export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!writesEnabled()||!indexWritesEnabled())
   throw new HttpError(503,"Risk review writes are disabled in Preview.");
  const reviewer=(await requireViewer(req)).address;assertModerator(reviewer);
  const input=riskMutation.parse(await readJson(req));
  await rateLimit(reviewer,"m20_risk_review",40,600);
  // Fail closed on fabricated signal reports: the claimed candidate must
  // still be supported by *current indexed events* within 24 hours.
  const proof=input.signal==="repeated_counterparty"
   ?await query<{events:number}>(`
      SELECT count(*)::integer AS events FROM social_activity_index
      WHERE owner=$1 AND source_actor=$2 AND owner<>source_actor
        AND kind IN ('like_received','repost_received')
        AND occurred_at>now()-interval '24 hours'`,[input.owner,input.counterparty])
   :await query<{events:number}>(`
      SELECT count(*)::integer AS events FROM social_activity_index
      WHERE source_actor=$1 AND owner=source_actor AND kind='post'
        AND occurred_at>now()-interval '24 hours'`,[input.owner]);
  const threshold=input.signal==="repeated_counterparty"?3:8;
  if(!proof.rows[0]||proof.rows[0].events<threshold)
   throw new HttpError(409,"Current genuine indexed events do not support this signal.");
  const saved=await query<{id:string;created_at:Date}>(`
    INSERT INTO social_risk_review_events
      (owner,signal,counterparty,disposition,reviewer,note)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at
  `,[input.owner,input.signal,input.counterparty,input.disposition,reviewer,input.note]);
  return NextResponse.json({ok:true,reviewId:saved.rows[0].id,
   recordedAt:saved.rows[0].created_at,sourceEvents:proof.rows[0].events,
   humanReviewed:true,automatedEnforcement:false},{headers});
 }catch(e){return failure(e);}
}
