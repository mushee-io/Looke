"use client";
import {useCallback,useEffect,useState} from "react";
import "./m20.css";

type AccountSummary={
 authenticated:boolean;ownerScoped:boolean;activity:{kind:string;indexed:number}[];
 points:{status:string;points:string;entries:number}[];
 indexRevision:string|null;coverage:string;source:string;note:string;error?:string;
};
type IndexState={
 authorized:boolean;checkpoint:{revision:string;cursor_at:string;updated_at:string};
 counts:{kind:string;entries:number}[];runs:{id:string;action:string;scanned:number;inserted:number;created_at:string}[];
 manualOnly:boolean;writeEnabled:boolean;scanLagSeconds:number;batchLimit:number;error?:string;
};
type Reconciliation={scanned:number;totalApproved:number;complete:boolean;
 issues:{ledgerId:string;kind:string;reason:string}[];status:string;note:string};
type Health={
 authorized:boolean;dbReachable:boolean;index:{recordedEvents:number;revision:string;cursorAt:string;
  checkpointUpdated:string;lastRun:{action:string;created_at:string;scanned:number;inserted:number}|null;
  completeCoverageClaim:false;manualOnly:true};
 queues:{pendingPoints:number;unresolvedReports:number};
 audit24h:{moderationActions:number;pointsDecisions:number};
 reconciliation:Reconciliation;note:string;error?:string;
};
type Risk={
 authorized:boolean;candidates:{
 repeatedCounterparties:{owner:string;counterparty:string;events:number}[];
 highDailyPosting:{owner:string;events:number}[];
 };reviews:{id:string;owner:string;signal:string;counterparty:string|null;
 disposition:string;reviewer:string;note:string;created_at:string}[];
 confidence:string;source:string;error?:string;
};
async function read<T>(path:string){
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store"});
 const data=await r.json() as T&{error?:string};
 if(!r.ok)throw Error(data.error||"Looke backend is unavailable.");
 return data;
}
async function write(path:string,payload:Record<string,unknown>){
 const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},
  credentials:"same-origin",cache:"no-store",body:JSON.stringify(payload)});
 const data=await r.json() as {ok?:boolean;error?:string};
 if(!r.ok||!data.ok)throw Error(data.error||"The operator action was rejected.");
 return data;
}
export function AccountIntegrity(){
 const [data,setData]=useState<AccountSummary|null>(null);
 const [status,setStatus]=useState("Reading your genuine indexed activity…");
 useEffect(()=>{
  let alive=true;
  void read<AccountSummary>("/api/social/ops/activity")
   .then(r=>{if(alive){setData(r);setStatus("");}})
   .catch(e=>{if(alive){setData(null);setStatus(e instanceof Error?e.message:"Unavailable");}});
  return()=>{alive=false;};
 },[]);
 return <section className="social-card lk-m20-panel">
  <h2>My activity integrity</h2><p>This page shows only the signed-in wallet's indexed creator events and real Points review states. Indexed data may be incomplete until a reviewer finishes recovery and reconciliation; it is not a token or reward entitlement.</p>
  {status&&<p role="status">{status}</p>}
  {data&&<><div className="lk-m20-metrics">
   {data.activity.length===0?<div><small>Activity index</small><strong>No indexed records</strong></div>:
    data.activity.map(x=><div key={x.kind}><small>{x.kind.replaceAll("_"," ")}</small><strong>{x.indexed}</strong></div>)}
   {data.points.map(x=><div key={x.status}><small>{x.status} Points</small>
    <strong>{x.points}</strong><small>{x.entries} real ledger entries</small></div>)}
  </div><small>Index checkpoint revision: {data.indexRevision??"not migrated"} · Account-scoped PostgreSQL records only.</small>
  <p className="lk-m20-note">{data.note}</p></>}
 </section>;
}
export function BackendOperations(){
 const [index,setIndex]=useState<IndexState|null>(null);
 const [health,setHealth]=useState<Health|null>(null);
 const [risk,setRisk]=useState<Risk|null>(null);
 const [status,setStatus]=useState("Verifying moderator authorization and database integrity…");
 const [busy,setBusy]=useState(false);
 const [reason,setReason]=useState("");
 const load=useCallback(async()=>{
  try{
   const [i,h,r]=await Promise.all([
    read<IndexState>("/api/social/index"),
    read<Health>("/api/social/ops/health"),
    read<Risk>("/api/social/ops/risk"),
   ]);
   setIndex(i);setHealth(h);setRisk(r);setStatus("");
  }catch(e){
   setIndex(null);setHealth(null);setRisk(null);
   setStatus(e instanceof Error?e.message:"Moderator backend unavailable.");
  }
 },[]);
 useEffect(()=>{void load();},[load]);
 async function act(path:string,payload:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setStatus("");
  try{await write(path,payload);await load();
   setStatus("Operator action committed and independently re-read from PostgreSQL.");}
  catch(e){setStatus(e instanceof Error?e.message:"Action blocked by safety policy.");}
  finally{setBusy(false);}
 }
 function rewind(){
  if(reason.trim().length<8){setStatus("A recovery reason of at least 8 characters is required.");return;}
  if(!window.confirm("Reset only the index checkpoint? Existing indexed events, Points and audited decisions will NOT be deleted. Replay needs additional manual scans."))return;
  void act("/api/social/index",{action:"rewind",reason:reason.trim()});
 }
 function review(owner:string,signal:string,counterparty:string|null,disposition:"review"|"dismissed"|"escalated"){
  if(reason.trim().length<8){setStatus("Enter a genuine review explanation of at least 8 characters.");return;}
  void act("/api/social/ops/risk",{owner,signal,counterparty,disposition,note:reason.trim()});
 }
 return <section className="social-card lk-m20-panel">
  <h2>Creator backend operations</h2>
  <p>Wallet-authorized moderator-only readout. Indexing is manual, resumable and source-backed; none of these controls mints tokens, pays rewards or changes a Points award.</p>
  {status&&<p role="status">{status}</p>}
  {index&&health&&risk&&<>
   <div className="lk-m20-metrics">
    <div><small>Indexed source events</small><strong>{health.index.recordedEvents}</strong></div>
    <div><small>Index revisions</small><strong>{health.index.revision}</strong></div>
    <div><small>Pending Points reviews</small><strong>{health.queues.pendingPoints}</strong></div>
    <div><small>Unresolved reports</small><strong>{health.queues.unresolvedReports}</strong></div>
    <div><small>Moderation actions · 24h</small><strong>{health.audit24h.moderationActions}</strong></div>
    <div><small>Points decisions · 24h</small><strong>{health.audit24h.pointsDecisions}</strong></div>
   </div>
   <div className="lk-m20-status">
    <strong>Index checkpoint</strong>
    <p>Cursor: {health.index.cursorAt==="1970-01-01T00:00:00.000Z"?"Not yet scanned":new Date(health.index.cursorAt).toLocaleString()}</p>
    <p>Last operator scan: {health.index.lastRun?new Date(health.index.lastRun.created_at).toLocaleString():"No recorded scan"}</p>
    <p>Batch limit: {index.batchLimit} real events; safety lag {index.scanLagSeconds} seconds. No recurring job has been activated.</p>
    <p>Full source coverage is not claimed; older late commits require explicit replay.</p>
   </div>
   <label className="lk-m20-input">Reason for risk review / recovery
    <textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}
     placeholder="Explain the real evidence, moderation context or recovery need."/>
   </label>
   <div className="lk-m20-controls">
    <button type="button" disabled={busy||!index.writeEnabled} onClick={()=>void act("/api/social/index",{action:"scan"})}>Scan next real source batch</button>
    <button type="button" disabled={busy||!index.writeEnabled} onClick={rewind}>Rewind checkpoint for recovery</button>
   </div>
   {!index.writeEnabled&&<p role="status">Manual indexing and risk review writes are currently disabled by Preview safety flags.</p>}
   <h3>Points reconciliation (read-only)</h3>
   <p>{health.reconciliation.scanned} / {health.reconciliation.totalApproved} approved entries independently checked against current source proofs. {health.reconciliation.complete?"Sample covers all current approved records.":"This is a bounded partial sample, not a full reconciliation."}</p>
   {health.reconciliation.issues.length===0?<p>No mismatch found in the sampled entries.</p>:
    health.reconciliation.issues.map(x=><div className="lk-m20-entry" key={x.ledgerId}>
     <strong>{x.reason}</strong><small>{x.kind} · {x.ledgerId}</small></div>)}
   <h3>Anti-abuse signals · indexed events in last 24 hours</h3>
   <p>Potential review patterns only. Shared wallets, automated operations or unique-person status cannot be concluded from these counts.</p>
   {risk.candidates.repeatedCounterparties.length===0&&risk.candidates.highDailyPosting.length===0&&
    <p>No threshold-triggering indexed patterns in the current sample; this does not prove absence of sybils.</p>}
   {risk.candidates.repeatedCounterparties.map((x,i)=><div className="lk-m20-entry" key={x.owner+":"+x.counterparty+":"+i}>
    <strong>Repeated reactions: {x.events}</strong><small>Creator {x.owner}, counterparty {x.counterparty}</small>
    <div className="lk-m20-controls">{(["review","dismissed","escalated"] as const).map(d=>
     <button type="button" key={d} disabled={busy||!index.writeEnabled||reason.trim().length<8}
      onClick={()=>review(x.owner,"repeated_counterparty",x.counterparty,d)}>{d}</button>)}</div>
   </div>)}
   {risk.candidates.highDailyPosting.map(x=><div className="lk-m20-entry" key={x.owner}>
    <strong>High post activity: {x.events}</strong><small>Creator {x.owner}</small>
    <div className="lk-m20-controls">{(["review","dismissed","escalated"] as const).map(d=>
     <button type="button" key={d} disabled={busy||!index.writeEnabled||reason.trim().length<8}
      onClick={()=>review(x.owner,"high_daily_activity",null,d)}>{d}</button>)}</div>
   </div>)}
   <h3>Recent manual risk review audit</h3>
   {risk.reviews.length===0?<p>No moderator reviews have been recorded.</p>:risk.reviews.map(e=>
    <div className="lk-m20-entry" key={e.id}><strong>{e.signal} · {e.disposition}</strong>
     <small>{e.owner} · {new Date(e.created_at).toLocaleString()}</small><p>{e.note}</p></div>)}
   <h3>Recent indexing / recovery journal</h3>
   {index.runs.length===0?<p>No indexing runs recorded.</p>:index.runs.map(run=>
    <div className="lk-m20-entry" key={run.id}><strong>{run.action}</strong>
     <small>{run.scanned} scanned · {run.inserted} newly indexed · {new Date(run.created_at).toLocaleString()}</small></div>)}
  </>}
 </section>;
}
