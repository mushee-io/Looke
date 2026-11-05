"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import "./m19.css";

type Season={id:string;slug:string;title:string;state:string;startsAt:string;endsAt:string;
 vestingStart:string;vestingCliff:string;vestingEnd:string;
 policy:{post:number;comment:number;likeReceived:number;repostReceived:number};
 approvedPoints:string;pendingPoints:string;rejectedPoints:string;reversedPoints:string;
 vesting:{total:string;unlocked:string;scheduled:string;unit:"LOOKE_POINTS";claimable:false}};
type Event={id:string;season_id:string;slug:string;source_kind:string;source_id:string;
 points:number;status:"pending"|"approved"|"rejected"|"reversed";
 review_note:string|null;activity_at:string;recorded_at:string;reviewed_at:string|null};
type Data={authenticated:boolean;ownerScoped:boolean;unit:"LOOKE_POINTS";
 asOf:string;tokensIssued:false;claimingEnabled:false;transferable:false;
 seasons:Season[];history:Event[];nextCursor:string|null;safetyNote:string;error?:string};
const label=(value:string)=>new Date(value).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
function percent(s:Season){
 try{const total=BigInt(s.vesting.total);
  if(total<=0n)return 0;
  return Number((BigInt(s.vesting.unlocked)*10000n)/total)/100;
 }catch{return 0;}
}
export function PointsDashboard(){
 const [data,setData]=useState<Data|null>(null);
 const [entries,setEntries]=useState<Event[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [status,setStatus]=useState("Loading signed-in Looke Points records…");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async(next?:string)=>{
  setBusy(true);
  try{
   const endpoint="/api/social/points"+(next?"?cursor="+encodeURIComponent(next):"");
   const r=await fetch(endpoint,{cache:"no-store",credentials:"same-origin"});
   const body=await r.json() as Data;
   if(!r.ok)throw Error(body.error||"Points records are unavailable.");
   if(!Array.isArray(body.seasons)||!Array.isArray(body.history))throw Error("Invalid points ledger response.");
   if(!body.ownerScoped||body.unit!=="LOOKE_POINTS"||body.claimingEnabled!==false||body.tokensIssued!==false)
    throw Error("Unexpected Points contract; cannot display this record.");
   setData(body);setEntries(prev=>next?[...prev,...body.history.filter(x=>!prev.some(e=>e.id===x.id))]:body.history);
   setCursor(body.nextCursor);setStatus("");
  }catch(e){if(!next){setData(null);setEntries([]);setCursor(null);}
   setStatus(e instanceof Error?e.message:"Point history unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const total=data?.seasons.reduce((sum,s)=>sum+BigInt(s.approvedPoints),0n)??0n;
 const awaiting=data?.seasons.reduce((sum,s)=>sum+BigInt(s.pendingPoints),0n)??0n;
 return <section className="lk-m19-page" aria-label="Looke Points and read-only vesting">
  <div className="lk-m19-hero"><span>LOOKE / COMMUNITY</span><h1>Points &amp; vesting</h1>
   <p>Participation records, reviewed off-chain rewards, and a schedule you can inspect. No token distribution, claim, transfer or financial transaction is enabled.</p>
  </div>
  {status&&<p role="status" className="lk-m19-notice">{status} <Link href="/social">Sign in to Looke social</Link></p>}
  {data&&<><div className="lk-m19-stats">
   <div><small>Approved Looke Points</small><strong>{total.toLocaleString()}</strong>
    <span>Real, moderator-reviewed records only</span></div>
   <div><small>Awaiting review</small><strong>{awaiting.toLocaleString()}</strong>
    <span>Not earned until explicitly approved</span></div>
   <div><small>Reward status</small><strong>No claims</strong>
    <span>Off-chain accounting, not tokens</span></div>
  </div>
  {!data.seasons.length?<div className="lk-m19-empty">
    <h2>No approved Points seasons configured</h2>
    <p>Looke does not assign sample rewards or vesting balances. Verified participation and reviewed Points will appear after an operator configures a genuine season and approves its evidence.</p>
   </div>:data.seasons.map(s=><article key={s.id} className="lk-m19-season">
    <div className="lk-m19-season-top"><div><small>{s.slug} · {s.state}</small><h2>{s.title}</h2>
     <p>Activity window: {label(s.startsAt)} – {label(s.endsAt)}</p></div>
     <strong>{BigInt(s.approvedPoints).toLocaleString()} Points</strong>
    </div>
    <div className="lk-m19-breakdown"><span>Posts +{s.policy.post}</span>
     <span>Qualifying comments +{s.policy.comment}</span>
     <span>Verified likes received +{s.policy.likeReceived}</span>
     <span>Verified reposts received +{s.policy.repostReceived}</span></div>
    <div className="lk-m19-vesting">
      <div><h3>Vesting schedule · informational</h3><span>{percent(s).toFixed(2)}% scheduled as unlocked</span></div>
      <div className="lk-m19-track"><div style={{width:percent(s)+"%"}}/></div>
      <div className="lk-m19-vest-values">
        <span><small>Schedule-unlocked</small><b>{BigInt(s.vesting.unlocked).toLocaleString()} Points</b></span>
        <span><small>Still scheduled</small><b>{BigInt(s.vesting.scheduled).toLocaleString()} Points</b></span>
      </div>
      <small>Starts {label(s.vestingStart)} · Cliff {label(s.vestingCliff)} · Ends {label(s.vestingEnd)}.</small>
      <p>These are only the approved off-chain Points distributed over the configured time schedule. An unlocked figure does not mean tokens exist or can be claimed.</p>
    </div>
   </article>)}
  <section className="lk-m19-history"><h2>Eligibility &amp; review history</h2>
   <p>Every row corresponds to a real, independently checked Looke post or social interaction. A rejected or reversed row is not included in approved Points.</p>
   {entries.length===0?<p>No recorded participation reviews for this wallet yet.</p>:
    <div className="lk-m19-ledger">{entries.map(e=><div className="lk-m19-entry" key={e.id}>
      <span><strong>{e.source_kind.replaceAll("_"," ")}</strong><small>{e.slug} · {label(e.activity_at)}</small></span>
      <span className={"lk-m19-state "+e.status}>{e.status}</span>
      <span className="lk-m19-points">+{e.points} pts</span>
      {e.review_note&&<small className="lk-m19-review">{e.review_note}</small>}
    </div>)}</div>}
   {cursor&&<button type="button" disabled={busy} onClick={()=>{void load(cursor);}}>
     {busy?"Loading verified records…":"Load older eligibility records"}
   </button>}
   <small>As of {new Date(data.asOf).toLocaleString()} · Source: {data.unit} approved PostgreSQL ledger.</small>
  </section></>}
 </section>;
}
