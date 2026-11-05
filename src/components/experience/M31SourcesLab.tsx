"use client";
import {useCallback,useEffect,useState} from "react";
import "./m31.css";
type Source={
 milestone:"M31";sourceStatus?:string;status?:string;
 schemaCompatible:boolean;configuredReadOnlyPostgresConnection?:boolean;
 missingCurrentDatabaseConnection?:boolean;
 actualCurrentTables?:number;requiredTables?:number;
 legacyTables?:number;socialTables?:number;
 missingTables?:string[];missingColumns?:string[];
 availableConfigKeysOnly?:Record<string,boolean>;
 releaseFlagsClosed?:boolean;realRowsInspected?:boolean;
 externalCloudinaryLookupPerformedByThisEndpoint?:boolean;
 separateTLSRestoreVerified?:boolean;
 releaseDecision:"NO_GO";note?:string;error?:string;
};
export function M31SourcesLab(){
 const [data,setData]=useState<Source|null>(null);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("Inspecting the actual protected Preview source configuration…");
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const r=await fetch("/api/experience/m31-source-readiness",{
    cache:"no-store",credentials:"same-origin"});
   const x=await r.json() as Source;
   if(!r.ok)throw Error(x.error||"Read-only source inspection unavailable.");
   setData(x);setMsg("");
  }catch(e){setData(null);setMsg(e instanceof Error?e.message:"Current source is unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 return <section className="social-card lk-m31">
  <header>
   <small>M31 / AUTHENTIC SOURCE CONNECTION GATES</small>
   <h2>Actual database compatibility and external acceptance blockers</h2>
   <p>Unlike a credential-presence check, this verifies the actual PostgreSQL table and column structure over TLS when a connection exists. It never migrates data, signs an approval or enables beta.</p>
  </header>
  {msg&&<p role="status">{msg}</p>}
  <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh read-only source compatibility</button>
  {data&&<>
   <div className="lk-m31-metrics">
    <div><small>Public beta</small><strong>NO-GO</strong></div>
    <div><small>Actual Preview database</small><strong>{data.sourceStatus==="not_connected"?"Not connected":data.configuredReadOnlyPostgresConnection?"Configured":"Blocked"}</strong></div>
    <div><small>Expected social tables</small><strong>{data.actualCurrentTables??0}/19</strong></div>
    <div><small>Current schema compatibility</small><strong>{data.schemaCompatible?"Schema only":"Blocked"}</strong></div>
    <div><small>Separate TLS restore</small><strong>Unverified</strong></div>
   </div>
   <p className="lk-m31-warning">{data.note||"Current Preview metadata is not enough to verify real media, two human witnesses, an external audit or a recovered backup."}</p>
   <h3>Live source compatibility</h3>
   <div className="lk-m31-grid">
    <article><strong>Actual PostgreSQL schema</strong><p>Result: {data.sourceStatus??data.status??"unknown"}. {data.legacyTables??0} legacy Looke tables; {data.socialTables??0} current-format social tables. Read-only schema compatibility is {data.schemaCompatible?"present, not user acceptance":"missing or incomplete"}.</p></article>
    <article><strong>Authenticated hosted-media inspection</strong><p>Requires actual moderated social media records plus operator-owned Cloudinary credentials; this endpoint does not inspect real provider assets.</p></article>
    <article><strong>Both canonical Ultra Testnet assets</strong><p>Real CoinCreated receipt and native Uniq current-owner proof must be supplied and checked separately. No generated coin or transaction is substituted.</p></article>
    <article><strong>Independent 19-table restoration</strong><p>Needs a genuinely separate restored TLS PostgreSQL host with the entire current source schema. A staging database with only old Looke tables cannot pass.</p></article>
   </div>
   {data.missingTables&&data.missingTables.length>0&&<>
    <h3>Missing required source tables</h3>
    <div className="lk-m31-columns">{data.missingTables.map(x=><code key={x}>{x}</code>)}</div>
   </>}
   {data.missingColumns&&data.missingColumns.length>0&&<>
    <h3>Missing evidence columns</h3>
    <div className="lk-m31-columns">{data.missingColumns.map(x=><code key={x}>{x}</code>)}</div>
   </>}
   <h3>Real connected project observation</h3>
   <p>A separate read-only connector inspection on 5 November 2026 found a Looke staging Neon database containing 25 older <code>looke_*</code> tables, zero <code>social_*</code> acceptance tables, and zero existing profiles, posts, media, challenges, sessions or coin events. That is a point-in-time observation, not a fresh query from this Preview. Connecting it as <code>DATABASE_URL</code> would not make the current acceptance system ready.</p>
   <h3>One-shot operator verification</h3>
   <p>First provide a genuine current-schema, least-privilege TLS PostgreSQL source. Then run <code>npm run m31:source-schema-audit -- --require-compatible</code> on an authorized operator computer. After a real independently restored backup exists, add its separate TLS URL and use <code>--full-restore-rows</code>. Follow with the earlier <code>m30:operator-acceptance -- --live</code> for original wallets, Points, media, actual Ultra assets and signed audit documents.</p>
   <p className="lk-m31-warning">Changing credentials must never turn on public beta, social/media writes, Points, token mint/claims, financial transactions or private messaging. Missing external human approvals, original security findings and incident witnesses remain blocked.</p>
  </>}
 </section>;
}
