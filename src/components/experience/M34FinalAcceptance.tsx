"use client";
import {useCallback,useEffect,useState} from "react";
import "./m31.css";

type Gate={id:string;status:"technical_verified"|"blocked";source:string;note:string;humanApproved:false};
type Report={milestone:"M34_FINAL";mode:string;releaseDecision:"NO_GO";
 technicalVerified:number;gates:Gate[];blocked:string[];
 observedAt:string;deployedGitSha:string|null;technicalEvidenceDigestSha256:string;
 expectedProductionAliasDeployment:string;underlyingM33ReadAttempted:boolean;
 liveSourcesQueried:boolean;originalHumanApprovals:0;publicBetaOpen:false;
 note:string;error?:string};
const title=(v:string)=>v.replaceAll("_"," ");
export function M34FinalAcceptance(){
 const [report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("Reading the existing protected release settings…");
 const refresh=useCallback(async(live:boolean)=>{
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/experience/m34-final?mode="+(live?"live":"config"),
     {cache:"no-store",credentials:"same-origin"});
   const result=await response.json() as Report;
   if(!response.ok)throw Error(result.error||"Actual source acceptance is unavailable.");
   setReport(result);
  }catch(e){setReport(null);setMessage(e instanceof Error?e.message:"Source checks blocked.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh(false);},[refresh]);
 return <section className="social-card lk-m31">
  <header><small>M34 / FINAL END-TO-END ENGINEERING ACCEPTANCE</small>
   <h2>Actual source checks, immutable release status</h2>
   <p>The completed product's final technical acceptance board. Check real Ultra Testnet connectivity, current PostgreSQL, hosted media and safety endpoints. Checks do not generate accounts, send trades or sign wallet approvals.</p></header>
  <button type="button" disabled={busy} onClick={()=>void refresh(true)}>
   {busy?"Reading actual Testnet, database and media sources…":"Run final live end-to-end checks"}
  </button>
  {message&&<p role="status">{message}</p>}
  {report&&<>
   <div className="lk-m31-metrics">
    <div><small>Release</small><strong>NO-GO</strong></div>
    <div><small>Technical checks</small><strong>{report.technicalVerified}/{report.gates.length}</strong></div>
    <div><small>Live source observations</small><strong>{report.liveSourcesQueried?"Performed":"Not performed"}</strong></div>
    <div><small>Independent human approvals</small><strong>0 verified</strong></div>
    <div><small>Public beta</small><strong>Closed</strong></div>
   </div>
   <p className="lk-m31-warning">{report.note}</p>
   <h3>Source-backed final verification matrix</h3>
   <div className="lk-m31-grid">{report.gates.map(g=><article key={g.id}>
    <strong>{title(g.id)}</strong>
    <p><b>{g.status==="technical_verified"?"Technical check passed":"Blocked or not independently verified"}</b></p>
    <p>{g.note}</p><small>Evidence source: {g.source}</small>
   </article>)}</div>
   <h3>Auditable technical report</h3>
   <p>Observed: {report.observedAt}. Deployed revision: <code>{report.deployedGitSha||"Not resolved"}</code>.</p>
   <p>Technical status digest (not a human signature): <code>{report.technicalEvidenceDigestSha256}</code>.</p>
   <p>Protected production alias is expected to remain on <code>{report.expectedProductionAliasDeployment}</code>.
    This web page cannot independently confirm the Vercel control-plane assignment.</p>
   <p className="lk-m31-warning">Final technical acceptance does not replace original wallet approvals, audited security findings, independent database restoration, approved media records or an independently witnessed rollback. Until those are genuine and verified, public beta, financial actions, token claims and social writes remain off.</p>
  </>}
 </section>;
}
