"use client";
import {useCallback,useEffect,useState} from "react";
import "./m30.css";
type Step={id:string;status:string;reason:string;source:string;humanAcceptanceVerified:false};
type Readiness={
 configuration:{missingEnvironmentKeys:string[];releaseFlagsClosed:boolean;
  exactImmutablePreviewIdentityConfigured:boolean;canQueryExistingPostgreSQL:boolean;
  canAttemptRealProviderInspection:boolean;canAttemptSeparateTLSRecovery:boolean;
  canAttemptIndependentSignedFileVerification:boolean};
 steps:Step[];technicallyVerifiedCount:number;humanAcceptanceVerifiedCount:0;
 releaseDecision:"NO_GO";publicBetaOpen:false;executedLiveAcceptance?:boolean;
 sourceResultsRequireAuthenticatedOperator?:boolean;moderatorAuthenticated?:boolean;
 error?:string;
};
export function M30OperatorRun(){
 const [config,setConfig]=useState<Readiness|null>(null),[source,setSource]=useState<Readiness|null>(null);
 const [status,setStatus]=useState("Reading exact protected Preview configuration…"),[busy,setBusy]=useState(false);
 const [factory,setFactory]=useState(""),[tx,setTx]=useState("");
 const [uniqFactoryId,setUniqFactoryId]=useState(""),[uniqTokenId,setUniqTokenId]=useState("");
 const [uniqOwner,setUniqOwner]=useState("");
 const reload=useCallback(async()=>{
  setBusy(true);
  try{
   const resp=await fetch("/api/experience/m30-readiness",{cache:"no-store"});
   const obj=await resp.json() as Readiness;
   if(!resp.ok)throw Error(obj.error||"Protected Preview readiness unavailable.");
   setConfig(obj);setStatus("");
  }catch(e){setConfig(null);setStatus(e instanceof Error?e.message:"Status unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 async function sources(){
  setBusy(true);
  try{
   const p=new URLSearchParams({inspectProvider:"true"});
   if(factory.trim()||tx.trim()){p.set("tokenFactory",factory.trim());p.set("coinTx",tx.trim());}
   if(uniqFactoryId.trim()||uniqTokenId.trim()||uniqOwner.trim()){
    p.set("uniqFactoryId",uniqFactoryId.trim());p.set("uniqTokenId",uniqTokenId.trim());
    p.set("uniqOwner",uniqOwner.trim());
   }
   const resp=await fetch("/api/social/ops/m30?"+p.toString(),{
    cache:"no-store",credentials:"same-origin"});
   const obj=await resp.json() as Readiness;
   if(!resp.ok||!obj.moderatorAuthenticated)
    throw Error(obj.error||"Real authenticated moderator and PostgreSQL records required. Source verification blocked.");
   setSource(obj);setStatus("Authentic source read completed. External human approvals remain unverified.");
  }catch(e){setSource(null);setStatus(e instanceof Error?e.message:"Real source records unavailable.");}
  finally{setBusy(false);}
 }
 return <section className="social-card lk-m30">
  <header><small>M30 / REAL OPERATOR ACCEPTANCE EXECUTION</small>
   <h2>Release evidence prerequisites and live verification</h2>
   <p>Real sources only. The first check reads credential PRESENCE without disclosing values. The live check requires a genuine moderator session, TLS PostgreSQL sources, existing user records and actual provider or chain identifiers.</p>
  </header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m30-actions"><button type="button" onClick={()=>void reload()} disabled={busy}>Refresh real Preview configuration</button></div>
  {config&&<>
   <div className="lk-m30-grid lk-m30-kpi">
    <article><small>Launch decision</small><strong>NO-GO</strong></article>
    <article><small>Live PostgreSQL connection configured</small><strong>{config.configuration.canQueryExistingPostgreSQL?"Yes":"Missing"}</strong></article>
    <article><small>Hosted provider prerequisites</small><strong>{config.configuration.canAttemptRealProviderInspection?"Configured":"Missing"}</strong></article>
    <article><small>Independent restore endpoint</small><strong>{config.configuration.canAttemptSeparateTLSRecovery?"Configured":"Missing"}</strong></article>
    <article><small>Human approvals accepted</small><strong>0</strong></article>
   </div>
   <p className="lk-m30-warning">Configuration is not proof: no real wallet holder, approved media, minted asset, completed independent backup, audit report or human GO is inferred from these indicators.</p>
   <h3>Exactly missing operator prerequisites</h3>
   {config.configuration.missingEnvironmentKeys.length?
    <div className="lk-m30-prerequisites">{config.configuration.missingEnvironmentKeys.map(k=>
     <div key={k}><code>{k}</code><small>not configured on this Preview</small></div>)}</div>:
    <p>All named configuration keys are present; actual source contents and human decisions still require independent verification.</p>}
   {!config.configuration.releaseFlagsClosed&&<p className="lk-m30-warning">One or more prohibited write/launch flags are active. Treat this as a release safety violation requiring operator review.</p>}
   <h3>Run actual authenticated source inspection</h3>
   <p>These IDs must refer to actual independently confirmed Ultra Testnet assets. A missing input never becomes a generated sample transaction.</p>
   <div className="lk-m30-fields">
    <label>Actual creator coin factory<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Canonical CoinCreated receipt<input value={tx} onChange={e=>setTx(e.target.value)} placeholder="0x…"/></label>
    <label>Native Uniq factory ID<input value={uniqFactoryId} onChange={e=>setUniqFactoryId(e.target.value)} /></label>
    <label>Native Uniq token ID<input value={uniqTokenId} onChange={e=>setUniqTokenId(e.target.value)} /></label>
    <label>Native Uniq owner<input value={uniqOwner} onChange={e=>setUniqOwner(e.target.value)} /></label>
   </div>
   <button type="button" disabled={busy||!config.configuration.canQueryExistingPostgreSQL} onClick={()=>void sources()}>
    Check authenticated DB, provider and Ultra Testnet evidence
   </button>
   {!config.configuration.canQueryExistingPostgreSQL&&<p role="status">Live source inspection is blocked until an operator configures the authorized PostgreSQL connection. No production or write flags need to be enabled.</p>}
   <h3>Eight operator-owned acceptance gates</h3>
   <div className="lk-m30-grid">{(source||config).steps.map(s=>
    <article key={s.id}><small>{s.status.replaceAll("_"," ")}</small>
     <strong>{s.source}</strong><p>{s.reason}</p>
     <p>Independent human acceptance: NOT VERIFIED</p>
    </article>)}</div>
   <h3>One-shot operator acceptance (no recurring tasks)</h3>
   <p>On a restricted operator computer with genuine source access, run <code>npm run m30:operator-acceptance -- --live</code>, adding actual wallet packet, audit file and signed manifest paths, restore database, Vercel read-only token and real Ultra proof IDs. The tool writes only a redacted NO-GO report to <code>artifacts/m30/operator-acceptance.json</code>.</p>
   <p className="lk-m30-warning">A matching 19-table digest is not a separately witnessed restore. Two valid reviewer keys are not verified people. An audit hash is not a security finding retest. No code in M30 can turn the release flag on, broadcast finance, create tokens or promote production.</p>
  </>}
 </section>;
}
