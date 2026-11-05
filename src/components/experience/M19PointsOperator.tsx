"use client";
import {useCallback,useEffect,useState} from "react";
import "./m19.css";

type Evidence={id:string;owner:string;kind:string;points:number;slug:string;recorded_at:string};
type Candidate={kind:"post"|"comment"|"like_received"|"repost_received";
 source_id:string;owner:string;handle:string;activity_at:string};
type ActiveSeason={id:string;slug:string;title:string};
type Queue={authorized:boolean;pending:Evidence[];activeSeasons:number;
 seasons:ActiveSeason[];candidates:Candidate[];error?:string};
async function request(input:Record<string,unknown>){
 const r=await fetch("/api/social/points/operator",{method:"POST",headers:{"content-type":"application/json"},
  credentials:"same-origin",cache:"no-store",body:JSON.stringify(input)});
 const data=await r.json() as {ok?:boolean;error?:string};
 if(!r.ok||!data.ok)throw Error(data.error||"Operator approval rejected.");
}
export function PointsOperator(){
 const [queue,setQueue]=useState<Queue|null>(null);
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Checking signed moderator permissions…");
 const load=useCallback(async()=>{
  try{const r=await fetch("/api/social/points/operator",{credentials:"same-origin",cache:"no-store"});
   const data=await r.json() as Queue;
   if(!r.ok||!data.authorized)throw Error(data.error||"Not authorized for Points review.");
   setQueue(data);setStatus("");
  }catch(e){setQueue(null);setStatus(e instanceof Error?e.message:"Queue unavailable.");}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function commit(input:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setStatus("");
  try{await request(input);await load();setStatus("Points review decision recorded.");}
  catch(e){setStatus(e instanceof Error?e.message:"Points accounting is not active.");}
  finally{setBusy(false);}
 }
 return <section className="social-card lk-m19-operator">
  <h2>Points evidence review</h2><p>Moderator-only. Queue real activity for manual checking, then approve or reject with a written reason. No token allocation, redemption or automatic reward loop.</p>
  {status&&<p role="status">{status}</p>}
  {queue&&<>
    <h3>Active seasons: {queue.activeSeasons}</h3>
    {queue.seasons.length===0&&<p>An operator must configure and approve a real season before any Points can be queued.</p>}
    {queue.seasons.length>0&&<><h3>Real social source candidates · eligibility unverified</h3>
     <p>These are real records, but they still require anti-abuse checks and human approval. Nothing is issued automatically.</p>
     {queue.candidates.map(c=><div className="lk-m19-candidate" key={c.kind+":"+c.source_id}>
       <strong>{c.kind.replaceAll("_"," ")} · @{c.handle}</strong>
       <small>{new Date(c.activity_at).toLocaleString()} · {c.source_id}</small>
       {queue.seasons.map(s=><button key={s.id} type="button" disabled={busy} onClick={()=>{void commit({
        action:"queue",seasonId:s.id,kind:c.kind,sourceId:c.source_id,
       });}}>Queue for {s.slug} review</button>)}
     </div>)}
    </>}
    <h3>Pending eligibility reviews ({queue.pending.length})</h3>
    <label className="lk-m19-reason">Written reason (8–500 characters)
     <textarea value={reason} minLength={8} maxLength={500}
       onChange={e=>setReason(e.target.value)}
       placeholder="Explain verified eligibility, abuse indicators, or rejection."/>
    </label>
    {queue.pending.length===0?<p>No genuinely queued Points evidence.</p>:
      queue.pending.map(e=><div className="lk-m19-candidate" key={e.id}>
       <strong>{e.kind.replaceAll("_"," ")} · {e.points} Points</strong>
       <small>{e.slug} · {e.owner} · {new Date(e.recorded_at).toLocaleString()}</small>
       <div className="lk-m19-buttons">
        {(["approved","rejected"] as const).map(decision=><button key={decision}
          type="button" disabled={busy||reason.trim().length<8}
          onClick={()=>{void commit({action:"review",entryId:e.id,decision,reason:reason.trim()});}}>
           {decision==="approved"?"Approve reviewed Points":"Reject evidence"}
         </button>)}
       </div>
      </div>)}
  </>}
 </section>;
}
