"use client";
import {useCallback,useEffect,useState} from "react";
import "./m29.css";
type Step={id:string;label:string;status:string;command:string;external:string};
type Report={
 milestone:"M29";readOnly:true;operatorAuthorized:true;exactPreviewCommit:string|null;
 decision:"NO_GO";publicBetaOpen:false;
 realTechnicalObservations:{
  authenticAtomicNonceRecords:number;distinctAcceptedKeyCount:number;
  recordsWithMissingOrInvalidConsumption:number;expiredWitnessScopes:number;
  matchingAuthenticatedCloudinaryAssets:number;currentCanonicalEvmReceiptVerified:boolean;
  currentIrreversibleNativeUniqVerified:boolean;sourcePointsScanComplete:boolean;
  sourcePointsDiscrepancies:number;twoDistinctSignedReviewRoles:boolean;
  realIncidentRecords:number;
 };
 fullOperatorChecklist:Step[];
 actualExternalEvidencePacketCommand:string;
 actualHumanIndependenceVerified:false;
 signedHumanSecurityAndOperatorLaunchAuthorizationAccepted:false;
 actualIndependentBackupRestorationVerified:false;
 sourceReviewResult:{liveMedia:{status:string;reason:string};chain:{token:{status:string;reason:string};
  uniq:{status:string;reason:string}}};
 error?:string;
};
export function M29OperatorEvidence(){
 const [data,setData]=useState<Report|null>(null);
 const [status,setStatus]=useState("Inspecting real operational acceptance sources…");
 const [busy,setBusy]=useState(false);
 const [factory,setFactory]=useState(""),[coinTx,setCoinTx]=useState("");
 const [uniqFactoryId,setUniqFactoryId]=useState(""),[uniqTokenId,setUniqTokenId]=useState("");
 const [uniqOwner,setUniqOwner]=useState("");
 const refresh=useCallback(async(p?:URLSearchParams)=>{
  setBusy(true);
  try{
   const result=await fetch("/api/social/ops/m29"+(p?"?"+p.toString():""),{
    credentials:"same-origin",cache:"no-store"});
   const json=await result.json() as Report;
   if(!result.ok||!json.operatorAuthorized)throw Error(json.error||"Authenticated moderator required.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Evidence verification unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 function live(){
  const p=new URLSearchParams({inspectProvider:"true"});
  if(factory||coinTx){p.set("tokenFactory",factory.trim());p.set("coinTx",coinTx.trim());}
  if(uniqFactoryId||uniqTokenId||uniqOwner){
   p.set("uniqFactoryId",uniqFactoryId.trim());
   p.set("uniqTokenId",uniqTokenId.trim());p.set("uniqOwner",uniqOwner.trim());
  }
  void refresh(p);
 }
 function exportReport(){
  if(!data)return;
  const safe={...data,exportedAt:new Date().toISOString(),
   important:"Untrusted JSON snapshot; check external artifact bytes and cryptographic witnesses separately. NO_GO."};
  const blob=new Blob([JSON.stringify(safe,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");anchor.href=url;
  anchor.download="looke-m29-unverified-operator-snapshot.json";anchor.click();
  URL.revokeObjectURL(url);
 }
 return <section className="social-card lk-m29">
  <header>
   <small>M29 · EXTERNAL EVIDENCE COLLECTION</small>
   <h2>Verified source records, independently reviewed by humans</h2>
   <p>Collect only genuine source evidence. Offline signature and document checkers never substitute for actual attendance, a reviewed security audit or an authorized public launch.</p>
  </header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m29-actions">
   <button disabled={busy} type="button" onClick={()=>void refresh()}>Refresh genuine database evidence</button>
   <button disabled={!data||busy} type="button" onClick={exportReport}>Export unverified source snapshot</button>
  </div>
  {data&&<>
   <div className="lk-m29-metrics">
    <div><small>Beta decision</small><strong>NO-GO</strong></div>
    <div><small>Distinct wallet keys</small><strong>{data.realTechnicalObservations.distinctAcceptedKeyCount}</strong></div>
    <div><small>Atomic nonce acceptances</small><strong>{data.realTechnicalObservations.authenticAtomicNonceRecords}</strong></div>
    <div><small>Hosted assets verified now</small><strong>{data.realTechnicalObservations.matchingAuthenticatedCloudinaryAssets}</strong></div>
    <div><small>Independent human signoffs</small><strong>0 verified</strong></div>
   </div>
   <p className="lk-m29-warning">A database nonce consumption proves one-time key control, not two separate humans. A real Cloudinary API match proves hosted metadata, not content safety. Two signed reference reviews cannot approve a release.</p>
   <h3>Check real hosted media and both Ultra asset proofs</h3>
   <p>Provide public identifiers for actual deployed Testnet assets. Provider inspection requires configured server-side Cloudinary credentials and a genuinely moderated upload.</p>
   <div className="lk-m29-fields">
    <label>EVM creator factory<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Real CoinCreated receipt<input value={coinTx} onChange={e=>setCoinTx(e.target.value)} placeholder="0x…"/></label>
    <label>Native Uniq factory ID<input value={uniqFactoryId} onChange={e=>setUniqFactoryId(e.target.value)}/></label>
    <label>Native Uniq token ID<input value={uniqTokenId} onChange={e=>setUniqTokenId(e.target.value)}/></label>
    <label>Native Uniq owner<input value={uniqOwner} onChange={e=>setUniqOwner(e.target.value)}/></label>
   </div>
   <button type="button" disabled={busy} onClick={live}>Verify actual provider and both chain sources</button>
   <div className="lk-m29-grid">
    <article><strong>Authenticated provider</strong><p>{data.sourceReviewResult.liveMedia.status}: {data.sourceReviewResult.liveMedia.reason}</p></article>
    <article><strong>Ultra EVM coin</strong><p>{data.sourceReviewResult.chain.token.status}: {data.sourceReviewResult.chain.token.reason}</p></article>
    <article><strong>Ultra native Uniq</strong><p>{data.sourceReviewResult.chain.uniq.status}: {data.sourceReviewResult.chain.uniq.reason}</p></article>
    <article><strong>Points and anti-sybil</strong><p>Full source scan: {String(data.realTechnicalObservations.sourcePointsScanComplete)}; {data.realTechnicalObservations.sourcePointsDiscrepancies} discrepancies. Manual anti-sybil clearance not inferred.</p></article>
   </div>
   <h3>Eight required real-world evidence packages</h3>
   <div className="lk-m29-grid">{data.fullOperatorChecklist.map(task=>
    <article key={task.id}><small>{task.status.replaceAll("_"," ")}</small>
     <strong>{task.label}</strong><p><code>{task.command}</code></p><p>{task.external}</p>
    </article>)}</div>
   <h3>Source-bound wallet and auditor evidence</h3>
   <p>The wallet CLI checks two original M23 one-use consumed nonces and raw EIP-191 signatures against the real database, plus fresh separate observer signatures. The second CLI hashes eight actual files (no symlinks), verifies their manifest and two separately allowlisted security/operator review signatures. Neither can create a GO decision.</p>
   <p><code>{data.actualExternalEvidencePacketCommand}</code></p>
   <h3>Release hold</h3>
   <p className="lk-m29-warning">Independent human verification, original external audit findings/remediation, real database restoration on a second TLS host, content moderation, and a witnessed rollback drill remain separate mandatory steps. Public beta, Points, social/media writes, token minting/claims, financial transactions and private messaging are disabled.</p>
  </>}
 </section>;
}
