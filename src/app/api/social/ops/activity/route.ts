import {type NextRequest,NextResponse} from "next/server";
import {requireViewer} from "../../../../../lib/social/auth";
import {query} from "../../../../../lib/social/db";
import {failure} from "../../../../../lib/social/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** No owner parameter: the session wallet is the only account allowed. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;
  const [activity,points,checkpoint]=await Promise.all([
   query<{kind:string;indexed:number}>(`
    SELECT kind,count(*)::integer AS indexed FROM social_activity_index
    WHERE owner=$1 GROUP BY kind ORDER BY kind`,[actor]),
   query<{status:string;points:string;entries:number}>(`
    SELECT status,COALESCE(sum(points),0)::text AS points,
      count(*)::integer AS entries FROM social_points_ledger
    WHERE owner=$1 GROUP BY status ORDER BY status`,[actor]),
   query<{revision:string}>(`
    SELECT revision FROM social_index_checkpoints WHERE stream='creator_activity'`),
  ]);
  return NextResponse.json({
   authenticated:true,ownerScoped:true,
   activity:activity.rows,points:points.rows,
   indexRevision:checkpoint.rows[0]?.revision??null,
   coverage:"partial_until_operator_replay_and_live_source_checks",
   source:"wallet-scoped-postgres-events",
   note:"Indexed entries may include moderated/hidden activity. They are not a public engagement total or reward entitlement.",
  },{headers:{"cache-control":"private, no-store"}});
 }catch(e){return failure(e);}
}
