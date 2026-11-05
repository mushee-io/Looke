"use client";
import {useCallback,useEffect,useState} from "react";
import "./m24.css";
type Review={
 milestone:"M24";reviewerAuthorized:true;readOnly:true;publicBetaOpen:false;
 incidentWritesEnabled:boolean;immutablePreviewSha:string|null;
 review:{decision:"NO_GO";mayActivate:false;reviewGates:{gate:string;status:"blocked";note:string}[];
  unverifiedM21Gates:string[];featureFlagsClosed:boolean};
 realWallets:{distinctKeys:number;humanWitnessApproved:false};
 realModeration:{pendingMedia:number;openReports:number;providerInspection:{status:string;reason:string}|null};
 realCreatorAssetProof:{kind:string;status:string;source:string|null;note:string}|null;
 points:{approvedSourceScan:number;totalApproved:number;complete:boolean;mismatches:number;manualRiskReviews:number};
 evidenceReferences:{id:string;kind:string;auditor:string;evidence_sha256:string;evidence_url:string;
  actualFileDigestRechecked:false;independentAuditorContentApproved:false}[];
 incidentJournal:{id:string;event_type:string;severity:string;observation:string;
  external_evidence_id:string|null;created_at:string;action_taken:"none"}[];
 recovery:{fullRestoreRowsCompared:false;actualRestoreWitnessAccepted:false;next:string};
 incidentResponsePlan:string[];error?:string;
};
export function M24AuditReview(){
 const [data,setData]=useState<Review|null>(null);
 const [status,setStatus]=useState("Inspecting the protected release evidence register…");
 const [working,setWorking]=useState(false);
 const [kind,setKind]=useState("rollback_rehearsal");
 const [severity,setSeverity]=useState("info");
 const [note,setNote]=useState("");
 const [evidenceId,setEvidenceId]=useState("");
 const refresh=useCallback(async(live=false)=>{
  setWorking(true);
  try{
   const res=await fetch("/api/social/ops/m24"+(live?"?live=true":""),
    {credentials:"same-origin",cache:"no-store"});
   const body=await res.json() as Review;
   if(!res.ok||!body.reviewerAuthorized)throw Error(body.error||"Reviewer access is not verified.");
   setData(body);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Release acceptance unavailable.");}
  finally{setWorking(false);}
 },[]);
 useEffect(()=>{void refresh(false);},[refresh]);
 async function record(){
  setWorking(true);
  try{
   const r=await fetch("/api/social/ops/m24",{method:"POST",
    credentials:"same-origin",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"record_incident",eventType:kind,severity,
     observation:note.trim(),evidenceId:evidenceId||null})});
   const out=await r.json() as {ok?:boolean;error?:string};
   if(!r.ok||!out.ok)throw Error(out.error||"Incident write was rejected.");
   setNote("");setEvidenceId("");setStatus("An observation was recorded. No rollback or release action was executed.");
   await refresh(false);
  }catch(e){setStatus(e instanceof Error?e.message:"Incident write is disabled.");}
  finally{setWorking(false);}
 }
 return <section className="social-card lk-m24">
  <header><small>M24 / INDEPENDENT AUDIT READINESS</small>
   <h2>Launch review &amp; recovery control</h2>
   <p>Actual wallet, provider, Points, chain and signed external evidence only. This protected Preview does not activate a beta, claim rewards or execute rollback.</p>
  </header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m24-actions">
   <button type="button" disabled={working} onClick={()=>void refresh(false)}>Refresh real records</button>
   <button type="button" disabled={working} onClick={()=>void refresh(true)}>Inspect provider and Testnet RPC (read only)</button>
  </div>
  {data&&<>
   <div className="lk-m24-metrics">
    <div><small>Public release</small><strong>NO-GO</strong></div>
    <div><small>Two distinct wallet keys</small><strong>{data.realWallets.distinctKeys}</strong></div>
    <div><small>Points evidence checked</small><strong>{data.points.approvedSourceScan}/{data.points.totalApproved}</strong></div>
    <div><small>Points drift</small><strong>{data.points.mismatches}</strong></div>
    <div><small>Open moderation reports</small><strong>{data.realModeration.openReports}</strong></div>
    <div><small>Signed references</small><strong>{data.evidenceReferences.length}</strong></div>
   </div>
   <p className="lk-m24-warning">An existing signature verifies only key control and hash reference—not the audit's contents. Real two-person witnessing, independent media/content inspection and fully verified backup recovery remain blocked. Production and public beta are not touched.</p>
   <h3>Independent external acceptance gates</h3>
   <div className="lk-m24-gates">{data.review.reviewGates.map(g=>
    <article key={g.gate}><small>NOT ACCEPTED</small><strong>{g.gate.replaceAll("_"," ")}</strong>
     <p>{g.note}</p></article>)}</div>
   <h3>Real record observations</h3>
   <p>Provider scan: {data.realModeration.providerInspection?
     data.realModeration.providerInspection.status+" — "+data.realModeration.providerInspection.reason:
     "Not independently inspected in this request"}.
    Pending media: {data.realModeration.pendingMedia}.
    Manual anti-sybil risk reviews: {data.points.manualRiskReviews}.
    Source reconciliation: {data.points.complete?"complete within database":"incomplete"}.</p>
   <h3>Externally signed audit and restore references</h3>
   {data.evidenceReferences.length===0?<p>No independently signed references recorded for this exact Preview SHA.</p>:
    <div className="lk-m24-gates">{data.evidenceReferences.map(a=>
     <article key={a.id}><strong>{a.kind} · {a.auditor}</strong>
      <small>Reference {a.id}</small><p>SHA-256: {a.evidence_sha256}</p>
      <p>Artifact contents: NOT CHECKED by this endpoint</p></article>)}</div>}
   <p>For byte-level SHA-256 comparison, use the operator's `m24:verify-evidence` CLI against a real local report and recorded evidence ID. For complete PostgreSQL recovery integrity, use `m24:full-restore-audit` with separate TLS-verified endpoints. Neither command can approve public beta.</p>
   <h3>Incident and rollback rehearsal log</h3>
   <p>The rollback plan is a human-operated procedure, not a deployment-control button. Writing observations is separately disabled unless explicitly approved for the protected operator environment.</p>
   <div className="lk-m24-fields">
    <label>Event type<select value={kind} onChange={e=>setKind(e.target.value)}>
     <option value="rollback_rehearsal">Rollback rehearsal</option>
     <option value="incident">Incident</option>
     <option value="recovery_observation">Recovery observation</option></select></label>
    <label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value)}>
     {["info","low","medium","high","critical"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Optional actual evidence reference ID<select value={evidenceId} onChange={e=>setEvidenceId(e.target.value)}>
     <option value="">No linked reference</option>
     {data.evidenceReferences.map(x=><option value={x.id} key={x.id}>{x.kind} · {x.id.slice(0,9)}</option>)}</select></label>
   </div>
   <label>Observed facts only<textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}
    placeholder="Describe the observed test, affected subsystem and referenced records. Minimum 20 characters."/></label>
   <button type="button" disabled={working||!data.incidentWritesEnabled||note.trim().length<20}
    onClick={()=>void record()}>Record observation only (no rollback)</button>
   {!data.incidentWritesEnabled&&<p role="status">M24 operator incident writes are disabled in this Preview. No changes are required for read-only reviews.</p>}
   {data.incidentJournal.length===0?<p>No actual operator incidents recorded for this commit.</p>:
    data.incidentJournal.map(x=><article className="lk-m24-record" key={x.id}>
     <strong>{x.event_type} · {x.severity}</strong>
     <p>{x.observation}</p><small>{new Date(x.created_at).toLocaleString()} · no action executed</small></article>)}
   <h3>Operator incident and recovery checklist</h3>
   <ol>{data.incidentResponsePlan.map((s,i)=><li key={i}>{s}</li>)}</ol>
   <p className="lk-m24-warning">Final decision: NO-GO. An independent human audit and explicit authorized release process outside this Preview are mandatory.</p>
  </>}
 </section>;
}
