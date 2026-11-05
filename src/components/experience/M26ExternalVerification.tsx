"use client";
import {useCallback,useEffect,useState} from "react";
import "./m26.css";
type SourceReview={id:string;gate:string;recorded_by:string;external_reviewer:string;evidence_id:string;decision:string};
type SourceEvidence={id:string;evidence_sha256:string;auditor:string;kind:string};
type Witness={id:string;role:string;witness_wallet:string;review_id:string;decision:string;sourceDocumentVerified:false};
type Packet={
 reviewerAuthorized:boolean;immutablePreviewSha:string|null;witnessWritesEnabled:boolean;
 decision:{decision:"NO_GO";publicBetaOpen:false;dualRoleReferenceSignaturesPresent:boolean;
  distinctPublicSignerKeys:number};
 m25ReviewReferences:SourceReview[];realSignedEvidence:SourceEvidence[];
 dualRoleWitnessReferences:Witness[];
 walletProofs:{distinctPublicKeys:number;independentlyWitnessedHumans:false};
 media:{pendingMedia:number;openReports:number;providerInspection:{status:string;reason:string}|null};
 points:{complete:boolean;mismatches:number;manualRiskReviews:number};
 currentChainEvidence:{status:string;kind:string;note:string}|null;
 recovery:{tableCount:number;actualBackupsRestored:false;differentHumanRestoreWitness:false};
 externalAudits:{references:number;independentlyInspectedOriginalFiles:false};
 incidents:unknown[];outstanding:string[];error?:string;
};
export function M26ExternalVerification(){
 const [data,setData]=useState<Packet|null>(null),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Reading actual operational release evidence…");
 const [reviewId,setReviewId]=useState(""),[role,setRole]=useState<"independent_security"|"independent_operator">("independent_security");
 const [witnessWallet,setWitnessWallet]=useState("");
 const [decision,setDecision]=useState<"hold"|"reference_acknowledged_unverified">("hold");
 const [observedAt,setObservedAt]=useState(""),[signature,setSignature]=useState("");
 const [assetKind,setAssetKind]=useState("token"),[factory,setFactory]=useState(""),[tx,setTx]=useState("");
 const [owner,setOwner]=useState(""),[factoryId,setFactoryId]=useState(""),[tokenId,setTokenId]=useState("");
 const refresh=useCallback(async(query?:URLSearchParams)=>{
  setBusy(true);
  try{
   const r=await fetch("/api/social/ops/m26"+(query?"?"+query.toString():""),{
    credentials:"same-origin",cache:"no-store"});
   const json=await r.json() as Packet;
   if(!r.ok||!json.reviewerAuthorized)throw Error(json.error||"Real moderator session required.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Verification unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const review=data?.m25ReviewReferences.find(r=>r.id===reviewId);
 const source=data?.realSignedEvidence.find(e=>e.id===review?.evidence_id);
 const message=source&&review&&observedAt?[
  "Looke M26 independent release evidence-reference acknowledgment",
  "Protected Preview Origin: "+(typeof window!=="undefined"?window.location.origin:""),
  "Protected Preview Commit: "+data?.immutablePreviewSha,
  "Existing M25 Review: "+reviewId,
  "Existing Source Evidence SHA-256: "+source.evidence_sha256,
  "Release Gate: "+review.gate,
  "Witness Role: "+role,
  "Witness Wallet: "+witnessWallet.trim().toLowerCase(),
  "Decision: "+decision,
  "Observed At: "+observedAt,
  "Signature confirms a public reference ACKNOWLEDGEMENT ONLY, not review of its contents or independent human identity.",
  "NO beta launch, user postings, Points issuance, token claims, financial broadcasting or production deployment.",
 ].join("\n"):"";
 async function submit(){
  setBusy(true);
  try{
   const r=await fetch("/api/social/ops/m26",{method:"POST",credentials:"same-origin",
    cache:"no-store",headers:{"content-type":"application/json"},
    body:JSON.stringify({action:"record_witness",reviewId,role,
     witnessWallet:witnessWallet.trim().toLowerCase(),decision,observedAt,signature:signature.trim()})});
   const j=await r.json() as {ok?:boolean;error?:string;note?:string};
   if(!r.ok||!j.ok)throw Error(j.error||"Witness reference blocked.");
   setSignature("");setObservedAt("");await refresh();setStatus(j.note||"Reference acknowledged; NO-GO remains.");
  }catch(e){setStatus(e instanceof Error?e.message:"Review submission was denied.");}
  finally{setBusy(false);}
 }
 function checkAsset(){
  const p=new URLSearchParams({assetKind});
  if(assetKind==="token"){p.set("factory",factory.trim());p.set("tx",tx.trim());}
  else{p.set("nativeOwner",owner.trim());p.set("factoryId",factoryId.trim());p.set("tokenId",tokenId.trim());}
  void refresh(p);
 }
 return <section className="social-card lk-m26">
  <header><small>M26 · EXTERNAL RELEASE VERIFICATION</small>
   <h2>Independent acceptance and release gate</h2>
   <p>Authenticated, source-backed operational checklist. Every human approval stays unverified until separately witnessed and audited.</p></header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m26-actions"><button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh actual records</button>
   <button type="button" disabled={busy} onClick={()=>void refresh(new URLSearchParams({live:"true"}))}>Recheck provider and Testnet RPC</button></div>
  {data&&<>
   <div className="lk-m26-stats">
    <div><small>Public beta</small><strong>NO-GO</strong></div>
    <div><small>Consumed wallet keys</small><strong>{data.walletProofs.distinctPublicKeys}</strong></div>
    <div><small>Independent human witnesses</small><strong>0 verified</strong></div>
    <div><small>Source-backed Points drift</small><strong>{data.points.mismatches}</strong></div>
    <div><small>Restore tables checked by CLI</small><strong>{data.recovery.tableCount}</strong></div>
    <div><small>Witness references stored</small><strong>{data.dualRoleWitnessReferences.length}</strong></div>
   </div>
   <p className="lk-m26-warning">Two signed keys are not two independently witnessed humans. Two signed reviewer references are not an accepted security audit. Matching database hashes are not proof that an independent operator restored an authentic backup.</p>
   <h3>Actual external evidence status</h3>
   <p>Provider: {data.media.providerInspection?.status??"Not independently inspected"}.
   Pending media: {data.media.pendingMedia}. Open reports: {data.media.openReports}.
   Manual anti-sybil reviews: {data.points.manualRiskReviews}.
   Complete Points reconciliation: {String(data.points.complete)}.
   Actual independent restore witnessed: NO.</p>
   <h3>Independently inspect current Ultra assets</h3>
   <div className="lk-m26-actions">
    <button type="button" onClick={()=>setAssetKind("token")}>EVM creator coin</button>
    <button type="button" onClick={()=>setAssetKind("uniq")}>Native Uniq</button>
   </div>
   {assetKind==="token"?<div className="lk-m26-fields">
    <label>Actual deployed factory<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Canonical CoinCreated tx<input value={tx} onChange={e=>setTx(e.target.value)} placeholder="0x…"/></label>
   </div>:<div className="lk-m26-fields">
    <label>Native owner<input value={owner} onChange={e=>setOwner(e.target.value)}/></label>
    <label>Factory ID<input value={factoryId} onChange={e=>setFactoryId(e.target.value)}/></label>
    <label>Uniq ID<input value={tokenId} onChange={e=>setTokenId(e.target.value)}/></label>
   </div>}
   <button type="button" disabled={busy} onClick={checkAsset}>Verify current chain evidence, read only</button>
   {data.currentChainEvidence&&<p role="status">{data.currentChainEvidence.status}: {data.currentChainEvidence.note}</p>}
   <h3>Independent role reference acknowledgements</h3>
   <p>Only a pre-existing signed M25 review and M23 evidence source for this exact commit may be referenced. Different allowlisted security and operator wallets must personally sign the text. These are audit-trail records, not real-world identity verification or permission to activate beta.</p>
   <div className="lk-m26-fields">
    <label>Real M25 review<select value={reviewId} onChange={e=>{setReviewId(e.target.value);setSignature("");}}>
     <option value="">Choose a genuine review</option>{data.m25ReviewReferences.map(r=>
      <option key={r.id} value={r.id}>{r.gate.replaceAll("_"," ")} · {r.id.slice(0,9)}</option>)}
    </select></label>
    <label>Separate witness role<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>
     <option value="independent_security">Security reviewer</option>
     <option value="independent_operator">Operator reviewer</option>
    </select></label>
    <label>Witness wallet<input value={witnessWallet} onChange={e=>setWitnessWallet(e.target.value)} placeholder="0x…"/></label>
    <label>Decision<select value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}>
     <option value="hold">Hold — not approved</option>
     <option value="reference_acknowledged_unverified">Reference acknowledged, unverified</option>
    </select></label>
   </div>
   <button type="button" onClick={()=>setObservedAt(new Date().toISOString())}>Prepare five-minute signing message</button>
   {message&&<div className="lk-m26-form">
    <textarea rows={12} readOnly value={message}/>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(message)}>Copy signing message</button>
    <label>EIP-191 public signature<input value={signature} onChange={e=>setSignature(e.target.value)} placeholder="0x…"/></label>
    <button type="button" disabled={busy||!data.witnessWritesEnabled||!signature.trim()}
     onClick={()=>void submit()}>Verify and log reference only</button>
   </div>}
   {!data.witnessWritesEnabled&&<p role="status">Witness-recording writes are disabled in this protected Preview.</p>}
   {data.dualRoleWitnessReferences.length>0&&<div className="lk-m26-grid">
    {data.dualRoleWitnessReferences.map(w=><div key={w.id} className="lk-m26-item">
     <strong>{w.role.replaceAll("_"," ")}</strong><small>{w.witness_wallet}</small><small>{w.decision.replaceAll("_"," ")}</small>
     <small>Independent human review and artifact contents NOT verified.</small>
    </div>)}</div>}
   <h3>Required external acceptance work</h3>
   <ol>{data.outstanding.map((step,i)=><li key={i}>{step}</li>)}</ol>
   <p className="lk-m26-warning">Final launch decision: NO-GO. This interface cannot unpause beta, promote to production, mint tokens, distribute Points, message users or broadcast financial transactions.</p>
  </>}
 </section>;
}
