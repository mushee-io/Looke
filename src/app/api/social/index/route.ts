import {type NextRequest,NextResponse} from "next/server";
import {HttpError,requireViewer,verifyRequestOrigin,writesEnabled} from "../../../../lib/social/auth";
import {rateLimit,socialDb} from "../../../../lib/social/db";
import {failure,readJson} from "../../../../lib/social/http";
import {assertModerator} from "../../../../lib/social/m18";
import {indexMutation,indexWritesEnabled,scanLimit,safetyLagSeconds} from "../../../../lib/social/m20";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store"};
const stream="creator_activity";
type Checkpoint={
 stream:string;cursor_at:Date;cursor_kind:string;cursor_id:string;
 revision:string;updated_at:Date;
};
type Indexed={
 kind:"post"|"comment"|"like_received"|"repost_received";
 source_id:string;owner:string;source_actor:string;occurred_at:Date;
};

/** Intentionally manual; never starts a cron, worker, payout, or blockchain action. */
export async function GET(req:NextRequest){
 try{
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const db=socialDb();
  const [checkpoint,counts,runs]=await Promise.all([
   db.query<Checkpoint>("SELECT * FROM social_index_checkpoints WHERE stream=$1",[stream]),
   db.query<{kind:string;entries:number}>(`
     SELECT kind,count(*)::integer AS entries FROM social_activity_index GROUP BY kind`),
   db.query<{id:string;action:string;scanned:number;inserted:number;note:string;created_at:Date}>(`
     SELECT id,action,scanned,inserted,note,created_at
     FROM social_index_runs ORDER BY created_at DESC,id DESC LIMIT 10`),
  ]);
  const cp=checkpoint.rows[0];
  if(!cp)throw new HttpError(503,"Index checkpoint migration was not applied.");
  return NextResponse.json({authorized:true,stream,checkpoint:cp,
    counts:counts.rows,runs:runs.rows,
    scanLagSeconds:safetyLagSeconds,batchLimit:scanLimit,
    manualOnly:true,writeEnabled:writesEnabled()&&indexWritesEnabled(),
    source:"durable-postgres-source-journal"},{headers});
 }catch(e){return failure(e);}
}

export async function POST(req:NextRequest){
 try{
  verifyRequestOrigin(req);
  if(!writesEnabled()||!indexWritesEnabled())
   throw new HttpError(503,"Operator indexing is disabled in closed Preview.");
  const actor=(await requireViewer(req)).address;assertModerator(actor);
  const action=indexMutation.parse(await readJson(req));
  await rateLimit(actor,"m20_index_manual",30,600);
  const db=socialDb();
  const conn=await db.connect();
  try{
   await conn.query("BEGIN");
   const locked=await conn.query<Checkpoint>(`
    SELECT * FROM social_index_checkpoints WHERE stream=$1 FOR UPDATE`,[stream]);
   if(locked.rowCount!==1)throw new HttpError(503,"Index checkpoint migration was not applied.");
   const before=locked.rows[0];
   const revision=BigInt(before.revision)+1n;
   if(action.action==="rewind"){
    // Reset ONLY the cursor, never delete existing proven events or reward entries.
    // Operator explicitly performs later bounded replays with action=scan.
    await conn.query(`
      UPDATE social_index_checkpoints SET cursor_at='epoch',cursor_kind='',
        cursor_id='00000000-0000-0000-0000-000000000000',
        revision=$2,updated_at=now() WHERE stream=$1`,[stream,revision.toString()]);
    await conn.query(`
      INSERT INTO social_index_runs
        (operator,action,from_at,to_at,before_revision,after_revision,scanned,inserted,note)
      VALUES($1,'rewind',$2,'epoch',$3,$4,0,0,$5)`,
      [actor,before.cursor_at,before.revision,revision.toString(),action.reason]);
    await conn.query("COMMIT");
    return NextResponse.json({ok:true,action:"rewind",cursorReset:true,
      removedEntries:0,removedPoints:0,revision:revision.toString()},{headers});
   }
   // Stable total ordering and a 2-minute lag to avoid most uncommitted source writes.
   // Older late commits can be covered by an explicitly audited cursor rewind.
   const found=await conn.query<Indexed>(`
    WITH sources AS (
      SELECT 'post'::text AS kind,p.id AS source_id,
        p.author AS owner,p.author AS source_actor,p.created_at AS occurred_at
      FROM social_posts p
      UNION ALL
      SELECT 'comment'::text,c.id,c.author,c.author,c.created_at
      FROM social_comments c JOIN social_posts p ON p.id=c.post_id
      UNION ALL
      SELECT 'like_received'::text,l.id,p.author,l.actor,l.created_at
      FROM social_post_likes l JOIN social_posts p ON p.id=l.post_id
      UNION ALL
      SELECT 'repost_received'::text,r.id,p.author,r.actor,r.created_at
      FROM social_post_reposts r JOIN social_posts p ON p.id=r.post_id
    )
    SELECT kind,source_id,owner,source_actor,occurred_at FROM sources
    WHERE (occurred_at,kind,source_id)>($1::timestamptz,$2::text,$3::uuid)
      AND occurred_at<=now()-($4::integer*interval '1 second')
    ORDER BY occurred_at ASC,kind ASC,source_id ASC LIMIT $5
   `,[before.cursor_at,before.cursor_kind,before.cursor_id,safetyLagSeconds,scanLimit]);
   const items=found.rows;
   let inserted=0;
   if(items.length){
    // All VALUES slots are generated from a server-owned, strictly bounded result.
    const placeholders=items.map((_,i)=>`($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5})`).join(",");
    const params=items.flatMap(e=>[e.kind,e.source_id,e.owner,e.source_actor,e.occurred_at]);
    const batch=await conn.query(`
      INSERT INTO social_activity_index(kind,source_id,owner,source_actor,occurred_at)
      VALUES ${placeholders} ON CONFLICT(kind,source_id) DO NOTHING RETURNING source_id`,
      params);
    inserted=batch.rowCount??0;
    const last=items[items.length-1];
    await conn.query(`
      UPDATE social_index_checkpoints SET cursor_at=$2,cursor_kind=$3,
        cursor_id=$4,revision=$5,updated_at=now() WHERE stream=$1`,
      [stream,last.occurred_at,last.kind,last.source_id,revision.toString()]);
   }else{
    await conn.query(`UPDATE social_index_checkpoints
      SET revision=$2,updated_at=now() WHERE stream=$1`,
      [stream,revision.toString()]);
   }
   await conn.query(`
     INSERT INTO social_index_runs(operator,action,from_at,to_at,
       before_revision,after_revision,scanned,inserted,note)
     VALUES($1,'scan',$2,$3,$4,$5,$6,$7,$8)`,
     [actor,before.cursor_at,items.at(-1)?.occurred_at??before.cursor_at,
      before.revision,revision.toString(),items.length,inserted,
      "Manual bounded scan of genuine stored creator source events"]);
   await conn.query("COMMIT");
   return NextResponse.json({ok:true,action:"scan",scanned:items.length,inserted,
     replayed:items.length-inserted,revision:revision.toString(),hasMore:items.length===scanLimit,
     checkpoint:items.at(-1)?{at:items.at(-1)!.occurred_at,
       kind:items.at(-1)!.kind,id:items.at(-1)!.source_id}:null,
     note:"No Points allocations or account balances were altered."},{headers});
  }catch(e){await conn.query("ROLLBACK");throw e;}finally{conn.release();}
 }catch(e){return failure(e);}
}
