"use client";
import {useCallback,useEffect,useState} from "react";
import "./m31.css";
type Mapping={legacyTable:string;currentTable:string;exists:boolean;rowCount:number|null;
 missingColumns:string[];policy:string;autoTransferAllowed:false};
type Source={observedLegacyTables:number;observedCurrentTables:number;currentSchemaCompatible:boolean;
 mappings:Mapping[];status:string};
type Report={milestone:"M32";sourceStatus:string;legacyConfigured?:boolean;currentConfigured?:boolean;
 legacyConnected:boolean;currentConnected:boolean;legacyTables:number;currentTables:number;
 currentSchemaCompatible:boolean;observedLegacyRows:number;legacy?:Source;current?:Source;
 releaseDecision:"NO_GO";publicBetaOpen:false;blockers:string[];note?:string;error?:string};
const words=(x:string)=>x.replaceAll("_"," ");
export function M32ReconciliationLab(){
 const [data,setData]=useState<Report|null>(null);
 const [status,setStatus]=useState("Reading the protected Preview's source configuration…");
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const response=await fetch("/api/experience/m32-reconciliation",
    {credentials:"same-origin",cache:"no-store"});
   const json=await response.json() as Report;
   if(!response.ok)throw Error(json.error||"Reconciliation check unavailable.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Read-only check blocked.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 return <section className="social-card lk-m31">
  <header>
   <small>M32 / LEGACY-TO-CURRENT REAL SOURCE RECONCILIATION</small>
   <h2>Real source lineage, no unapproved data transfer</h2>
   <p>Looke's older Neon schema and its 19-table current social system are different products of development. This tab checks actual separated TLS PostgreSQL sources only when both have been explicitly configured.</p>
  </header>
  <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh real read-only sources</button>
  {status&&<p role="status">{status}</p>}
  {data&&<>
   <div className="lk-m31-metrics">
    <div><small>Public beta</small><strong>NO-GO</strong></div>
    <div><small>Legacy TLS source</small><strong>{data.legacyConnected?"Observed":"Not verified"}</strong></div>
    <div><small>Current TLS source</small><strong>{data.currentConnected?"Observed":"Not verified"}</strong></div>
    <div><small>Current social tables</small><strong>{data.currentTables}/19</strong></div>
    <div><small>Automatic migration</small><strong>Disabled</strong></div>
   </div>
   <p className="lk-m31-warning">{data.note||"No authorized pair of separate TLS database connections is available to this Preview. Connected sources elsewhere are not automatically this deployment's sources."}</p>
   <h3>Legacy → current evidence mapping</h3>
   <div className="lk-m31-grid">
    {(data.legacy?.mappings??[
     {legacyTable:"looke_profiles",currentTable:"social_profiles",policy:"wallet_reauthentication_required",exists:false,rowCount:null,missingColumns:[],autoTransferAllowed:false},
     {legacyTable:"looke_posts",currentTable:"social_posts",policy:"owner_and_moderation_reapproval",exists:false,rowCount:null,missingColumns:[],autoTransferAllowed:false},
     {legacyTable:"looke_post_media",currentTable:"social_media_uploads",policy:"original_provider_and_moderation_proof",exists:false,rowCount:null,missingColumns:[],autoTransferAllowed:false},
     {legacyTable:"looke_sessions",currentTable:"social_sessions",policy:"sessions_must_not_transfer",exists:false,rowCount:null,missingColumns:[],autoTransferAllowed:false},
     {legacyTable:"looke_coin_events",currentTable:"social_creator_events",policy:"independent_chain_receipt_required",exists:false,rowCount:null,missingColumns:[],autoTransferAllowed:false},
    ]).map(x=><article key={x.legacyTable}>
     <strong>{x.legacyTable} → {x.currentTable}</strong>
     <p>{words(x.policy)}. {data.legacyConnected?
      (x.exists?"Actual source rows: "+String(x.rowCount??"unverified"):"Legacy table not present"):
      "No live database check performed in this Preview"}.</p>
     {x.missingColumns.length>0&&<p>Missing columns: {x.missingColumns.join(", ")}</p>}
    </article>)}
   </div>
   <h3>Release blockers</h3>
   <div className="lk-m31-columns">{data.blockers.map(x=><code key={x}>{words(x)}</code>)}</div>
   <h3>Independent connector observation — 5 November 2026</h3>
   <p>An independent read-only check found 25 legacy <code>looke_*</code> tables, zero current <code>social_*</code> tables and zero creator/profile/media/authentication entries in the checked legacy tables. Matching Looke Cloudinary prefixes had zero assets. This is historical source evidence, not a live query from the current page.</p>
   <h3>Operator action</h3>
   <p>After identifying an independently reviewed current-schema source and a separate approved legacy read-only source, configure <code>DATABASE_URL</code> and <code>LOOKE_M32_LEGACY_DATABASE_URL</code> on the protected Preview only. Run <code>npm run m32:reconcile -- --require-connected</code>. Neither source will be modified.</p>
   <p className="lk-m31-warning">No migration, session token transfer, signed-wallet authorization, hosted-media acceptance, native Uniq issuance, Points conversion or financial transaction is performed or approved here.</p>
  </>}
 </section>;
}
