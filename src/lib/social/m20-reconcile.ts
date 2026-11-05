import type {PoolClient} from "pg";
import {lookupEvidence} from "./points-evidence";
import {type SourceKind} from "./points";

type Reviewed={
 id:string;owner:string;source_actor:string;source_kind:SourceKind;
 source_id:string;activity_at:Date;points:number;season_id:string;
 starts_at:Date;ends_at:Date;points_post:number;points_comment:number;
 points_like_received:number;points_repost_received:number;
};
export type Drift={ledgerId:string;kind:SourceKind;reason:string};
export async function reconcileApproved(conn:Pick<PoolClient,"query">,max=40){
 const count=await conn.query<{total:number}>(`
  SELECT count(*)::integer AS total FROM social_points_ledger WHERE status='approved'`);
 const items=await conn.query<Reviewed>(`
  SELECT l.id,l.owner,l.source_actor,l.source_kind,l.source_id,l.activity_at,
    l.points,l.season_id,s.starts_at,s.ends_at,
    s.points_post,s.points_comment,s.points_like_received,s.points_repost_received
  FROM social_points_ledger l JOIN social_points_seasons s ON s.id=l.season_id
  WHERE l.status='approved' ORDER BY l.reviewed_at DESC,l.id DESC LIMIT $1
 `,[max]);
 const issues:Drift[]=[];
 for(const r of items.rows){
  const current=await lookupEvidence(conn,r.source_kind,r.source_id);
  if(!current){issues.push({ledgerId:r.id,kind:r.source_kind,reason:"source_missing_or_ineligible"});continue;}
  const expectedPoints={
   post:r.points_post,comment:r.points_comment,
   like_received:r.points_like_received,repost_received:r.points_repost_received,
  }[r.source_kind];
  const at=new Date(r.activity_at).getTime();
  if(r.owner!==current.owner||r.source_actor!==current.actor||
    new Date(current.activity_at).getTime()!==at||
    at<new Date(r.starts_at).getTime()||at>=new Date(r.ends_at).getTime()||
    r.points!==expectedPoints){
   issues.push({ledgerId:r.id,kind:r.source_kind,reason:"ledger_evidence_or_season_mismatch"});
  }
 }
 return {scanned:items.rows.length,totalApproved:count.rows[0].total,
  complete:count.rows[0].total===items.rows.length,issues,
  status:issues.length?"attention":count.rows[0].total===items.rows.length?"sample_clean":"incomplete",
  note:"Read-only current-source checks. No balances, approvals or reversals were changed."};
}
