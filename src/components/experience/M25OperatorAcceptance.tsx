"use client";
import {useCallback,useEffect,useState} from "react";
import "./m25.css";
type Evidence={id:string;kind:string;evidence_sha256:string;evidence_url:string;
 auditor:string;recorded_by:string;recorded_at:string};
type Gate={gate:string;reviewReferences:number;missingIndependentProof:true};
type Review={id:string;gate:string;external_reviewer:string;decision:string;
 evidence_id:string;recorded_at:string;artifactBytesIndependentlyVerified:false};
type Packet={
 reviewerAuthorized:boolean;immutablePreviewSha:string|null;reviewWritesEnabled:boolean;
 gate:{decision:"NO_GO";releaseFlagsClosed:boolean;reviewGates:Gate[];
  unresolvedReleaseGates:number;publicBetaOpen:false;canActivate:false};
 verifiedSourceReferences:Evidence[];operatorEvidenceReviews:Review[];
 distinctSignedWalletKeys:number;twoIndependentHumanWalletWitnessesApproved:false;
 moderation:{pendingMedia:number;openReports:number;providerInspection:{status:string;reason:string}|null};
 actualPoints:{complete:boolean;mismatches:number;totalApproved:number;approvedSourceScan:number;manualRiskReviews:number};
 independentCreatorAssetProof:{kind:string;status:string;source:string|null;note:string}|null;
 recovery:{actualIndependentlyRestoredBackupVerified:false;actualWitnessedDisasterRecovery:false};
 incidentObservations:{id:string;event_type:string;severity:string;observation:string}[];
 operatorChecklist:string[];error?:string;
};
export function M25OperatorAcceptance(){
 const [data,setData]=useState<Packet|null>(null);
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState("Reading real operator acceptance records…");
 const [gate,setGate]=useState("");
 const [evidenceId,setEvidenceId]=useState("");
 const [reviewer,setReviewer]=useState("");
 const [decision,setDecision]=useState<"reviewed_reference_only"|"needs_more_evidence">("needs_more_evidence");
 const [observedAt,setObservedAt]=useState("");
 const [signature,setSignature]=useState("");
 const [kind,setKind]=useState<"token"|"uniq">("token");
 const [factory,setFactory]=useState("");const [tx,setTx]=useState("");
 const [nativeOwner,setNativeOwner]=useState("");
 const [factoryId,setFactoryId]=useState("");const [tokenId,setTokenId]=useState("");
 const reload=useCallback(async(params?:URLSearchParams)=>{
  setBusy(true);
  try{
   const r=await fetch("/api/social/ops/m25"+(params?"?"+params.toString():""),{
    credentials:"same-origin",cache:"no-store"});
   const json=await r.json() as Packet;
   if(!r.ok||!json.reviewerAuthorized)throw Error(json.error||"Independent operator authorization required.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Independent acceptance unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const evidence=data?.verifiedSourceReferences.find(x=>x.id===evidenceId);
 const identity={origin:typeof window==="undefined"?"":window.location.origin,
  sha:data?.immutablePreviewSha??""};
 const reviewMessage=gate&&evidence&&reviewer&&observedAt?[
  "Looke M25 external evidence review acknowledgement",
  "Exact Preview Origin: "+identity.origin,
  "Exact Preview Commit: "+identity.sha,
  "Release Gate: "+gate,
  "Existing Signed Evidence ID: "+evidenceId,
  "Referenced Artifact SHA-256: "+evidence.evidence_sha256,
  "External Reviewer Wallet: "+reviewer.trim().toLowerCase(),
  "Decision: "+decision,
  "Observed At: "+observedAt,
  "This signs only an evidence reference. The reviewer MUST inspect source contents independently.",
  "No public beta, finance, token claims, social writes or production deployment is authorized.",
 ].join("\n"):"";
 async function submit(){
  setBusy(true);
  try{
   const res=await fetch("/api/social/ops/m25",{method:"POST",credentials:"same-origin",
    cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"record_review",gate,evidenceId,
     externalReviewer:reviewer.trim().toLowerCase(),decision,observedAt,signature:signature.trim()})});
   const json=await res.json() as {ok?:boolean;note?:string;error?:string};
   if(!res.ok||!json.ok)throw Error(json.error||"External review reference was not accepted.");
   setStatus(json.note||"Signed reference recorded; release remains NO-GO.");
   setSignature("");setObservedAt("");
   await reload();
  }catch(e){setStatus(e instanceof Error?e.message:"Review recording blocked.");}
  finally{setBusy(false);}
 }
 function chainProof(){
  const search=new URLSearchParams({assetKind:kind});
  if(kind==="token"){search.set("factory",factory.trim());search.set("tx",tx.trim());}
  else{search.set("nativeOwner",nativeOwner.trim());search.set("factoryId",factoryId.trim());
   search.set("tokenId",tokenId.trim());}
  void reload(search);
 }
 return <section className="social-card lk-m25">
  <header><small>M25 / OPERATOR-CONTROLLED ACCEPTANCE</small>
   <h2>External evidence &amp; go/no-go review</h2>
   <p>One signed reference at a time. This is an engineering acceptance register—not a public launch, wallet transfer, reward claim, completed independent audit or permission to change production.</p></header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m25-buttons">
   <button type="button" disabled={busy} onClick={()=>void reload()}>Refresh genuine database evidence</button>
   <button type="button" disabled={busy} onClick={()=>void reload(new URLSearchParams({live:"true"}))}>Recheck external media and Testnet RPC (read-only)</button>
  </div>
  {data&&<>
   <div className="lk-m25-kpis">
    <div><small>Release</small><strong>NO-GO</strong></div>
    <div><small>Independent gates unresolved</small><strong>{data.gate.unresolvedReleaseGates}</strong></div>
    <div><small>Wallet keys with consumed nonces</small><strong>{data.distinctSignedWalletKeys}</strong></div>
    <div><small>Points source checks</small><strong>{data.actualPoints.approvedSourceScan}/{data.actualPoints.totalApproved}</strong></div>
    <div><small>Moderation reports</small><strong>{data.moderation.openReports}</strong></div>
    <div><small>Externally signed references</small><strong>{data.operatorEvidenceReviews.length}</strong></div>
   </div>
   <p className="lk-m25-alert">Two real wallet keys do not prove two independent humans. A real file hash does not prove audit quality. A matching 17-table restore does not prove independent recovery witnessing. These gates remain unapproved until actual externally reviewed evidence exists.</p>
   <h3>Actual 11-gate release register</h3>
   <div className="lk-m25-grid">{data.gate.reviewGates.map(x=>
    <div key={x.gate} className="lk-m25-item">
     <small>INDEPENDENT APPROVAL BLOCKED</small>
     <strong>{x.gate.replaceAll("_"," ")}</strong>
     <p>{x.reviewReferences} signed reference acknowledgements recorded</p>
    </div>)}</div>
   <h3>Real source checks</h3>
   <p>Provider: {data.moderation.providerInspection?.status??"Not inspected externally in this request"}.
   Pending media: {data.moderation.pendingMedia}. Points integrity: {data.actualPoints.mismatches} mismatches;
   scan complete: {String(data.actualPoints.complete)}. Human-accepted two-wallet sessions: <strong>NO</strong>.</p>
   <div className="lk-m25-panel">
    <h3>Independently read an Ultra Testnet creator asset</h3>
    <p>Only actual canonical EVM creator coin transactions or native Uniq owner records can pass chain verification. No token/NFT issuance is executed.</p>
    <div className="lk-m25-buttons">
     <button type="button" onClick={()=>setKind("token")}>Ultra EVM creator coin</button>
     <button type="button" onClick={()=>setKind("uniq")}>Native Uniq</button>
    </div>
    {kind==="token"?<div className="lk-m25-fields">
     <label>Deployed factory address<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
     <label>Canonical CoinCreated receipt hash<input value={tx} onChange={e=>setTx(e.target.value)} placeholder="0x…"/></label>
    </div>:<div className="lk-m25-fields">
     <label>Native owner<input value={nativeOwner} onChange={e=>setNativeOwner(e.target.value)}/></label>
     <label>Factory ID<input value={factoryId} onChange={e=>setFactoryId(e.target.value)}/></label>
     <label>Uniq ID<input value={tokenId} onChange={e=>setTokenId(e.target.value)}/></label>
    </div>}
    <button type="button" disabled={busy} onClick={chainProof}>Check actual current Testnet proof</button>
    {data.independentCreatorAssetProof&&<p role="status">{data.independentCreatorAssetProof.status}: {data.independentCreatorAssetProof.note}</p>}
   </div>
   <h3>Review actual independently signed evidence references</h3>
   {data.verifiedSourceReferences.length===0?<p>No genuine M23 signed evidence references for this exact Preview revision.</p>:
    <div className="lk-m25-grid">{data.verifiedSourceReferences.map(x=>
     <div className="lk-m25-item" key={x.id}><strong>{x.kind} · {x.auditor}</strong>
      <small>{x.id}</small><small>SHA-256 {x.evidence_sha256}</small>
      <small>The linked document's bytes are not checked by this display.</small>
     </div>)}</div>}
   <div className="lk-m25-panel">
    <h3>Optional separate reviewer acknowledgment</h3>
    <p>A different independently allowlisted reviewer must sign the exact message below, after actually inspecting a real evidence artifact. The signature can log an acknowledgment or outstanding findings; it cannot mark the release gate as independently approved.</p>
    <div className="lk-m25-fields">
     <label>Release gate<select value={gate} onChange={e=>{setGate(e.target.value);setSignature("");}}>
      <option value="">Choose a gate</option>
      {data.gate.reviewGates.map(x=><option key={x.gate} value={x.gate}>{x.gate.replaceAll("_"," ")}</option>)}
     </select></label>
     <label>Existing signed reference<select value={evidenceId} onChange={e=>{setEvidenceId(e.target.value);setSignature("");}}>
      <option value="">Choose a genuine record</option>
      {data.verifiedSourceReferences.map(x=><option key={x.id} value={x.id}>{x.kind} · {x.id.slice(0,8)}</option>)}
     </select></label>
     <label>External reviewer public wallet<input value={reviewer} onChange={e=>setReviewer(e.target.value)} placeholder="0x…"/></label>
     <label>Review decision<select value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}>
      <option value="needs_more_evidence">Needs more evidence</option>
      <option value="reviewed_reference_only">Acknowledged reference only</option>
     </select></label>
    </div>
    <button type="button" onClick={()=>setObservedAt(new Date().toISOString())}>Prepare 5-minute review message</button>
    {reviewMessage&&<>
     <textarea rows={12} readOnly value={reviewMessage} aria-label="Exact external reviewer signing text"/>
     <button type="button" onClick={()=>void navigator.clipboard.writeText(reviewMessage)}>Copy exact reviewer message</button>
     <label>External reviewer EIP-191 signature<input value={signature} onChange={e=>setSignature(e.target.value)} placeholder="0x…"/></label>
     <button type="button" disabled={busy||!data.reviewWritesEnabled||!signature.trim()}
      onClick={()=>void submit()}>Validate and record signed reference</button>
    </>}
    {!data.reviewWritesEnabled&&<p role="status">Review-reference writes are disabled in this Preview. Read-only inspection works without them.</p>}
   </div>
   <h3>Current immutable review acknowledgements</h3>
   {data.operatorEvidenceReviews.length===0?<p>No external reviewers have recorded acknowledgments for this commit.</p>:
    data.operatorEvidenceReviews.map(x=><div key={x.id} className="lk-m25-item">
     <strong>{x.gate.replaceAll("_"," ")} · {x.decision.replaceAll("_"," ")}</strong>
     <small>{x.external_reviewer} · {new Date(x.recorded_at).toLocaleString()}</small>
     <small>Not an approved audit and not authorization to release.</small>
    </div>)}
   <h3>Human operator checklist</h3>
   <ol>{data.operatorChecklist.map((step,i)=><li key={i}>{step}</li>)}</ol>
   <p className="lk-m25-alert">No GO action exists in this interface. Public beta, media/social writes, Points, token minting/claims, private messaging and financial transactions remain disabled.</p>
  </>}
 </section>;
}
