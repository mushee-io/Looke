"use client";
import {useCallback,useEffect,useState} from "react";
import "./m22.css";

type BetaData={
 reviewerAuthorized:boolean;readOnly:true;milestone:"M22";
 readiness:{releaseDecision:"NO_GO";flagsClosed:boolean;m21Verified:number;m21Total:number;
  blockers:number;m21Unverified:{id:string;reason:string}[];
  requiredWitnesses:{id:string;reason:string}[];note:string};
 realCreatorProfiles:{address:string;handle:string;created_at:string;visible_posts:number}[];
 visibleModeratedPosts:{id:string;handle:string;author:string;media_status:string;
  created_at:string;asset_type:string|null;asset_chain:string|null;asset_id:string|null;
  assetAttachmentVerified:false}[];
 moderation:{pendingMedia:number;unresolvedReports:number};
 points:{reviewed:number;checked:number;complete:boolean;mismatches:number;claimsEnabled:false};
 recovery:{checkpoint:{revision:string;rewinds:number;scans:number;cursor_at:string}|null;
  independentRestoreWitness:false;note:string};
 independentAssetProof:{kind:string;status:string;source:string|null;note:string}|null;
 witness:{liveWalletSessionAccepted:false;noncePersistenceEnabled:false;note:string};
 testFundingGuidance:string[];transactionsSent:0;betaActivated:false;error?:string;
};
type WitnessResult={status:string;signatureValid:boolean;correctPreviewOrigin:boolean;
 correctPreviewCommit:boolean;withinFiveMinuteWindow:boolean;operatorReviewed:false;
 walletSessionWitnessAccepted:false;note:string;error?:string};
async function readBeta(params?:URLSearchParams){
 const r=await fetch("/api/social/ops/beta"+(params?"?"+params.toString():""),
  {credentials:"same-origin",cache:"no-store"});
 const data=await r.json() as BetaData;
 if(!r.ok||!data.reviewerAuthorized)throw Error(data.error||"No authorized Testnet beta evidence.");
 return data;
}
export function M22BetaLab(){
 const [data,setData]=useState<BetaData|null>(null);
 const [status,setStatus]=useState("Reading real Testnet beta preparation evidence…");
 const [loading,setLoading]=useState(false);
 const [kind,setKind]=useState<"token"|"uniq">("token");
 const [factory,setFactory]=useState("");
 const [tx,setTx]=useState("");
 const [nativeOwner,setNativeOwner]=useState("");
 const [nativeFactory,setNativeFactory]=useState("");
 const [tokenId,setTokenId]=useState("");
 const [witnessJson,setWitnessJson]=useState("");
 const [witnessResult,setWitnessResult]=useState<WitnessResult|null>(null);
 const reload=useCallback(async(params?:URLSearchParams)=>{
  setLoading(true);
  try{
   const result=await readBeta(params);
   setData(result);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Beta evidence unavailable.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 function checkAsset(){
  const params=new URLSearchParams();
  params.set("assetKind",kind);
  if(kind==="token"){params.set("factory",factory.trim());params.set("tx",tx.trim());}
  else{params.set("nativeOwner",nativeOwner.trim());
   params.set("factoryId",nativeFactory.trim());params.set("tokenId",tokenId.trim());}
  void reload(params);
 }
 async function checkWitness(){
  setLoading(true);setWitnessResult(null);
  try{
   const submitted=JSON.parse(witnessJson) as Record<string,unknown>;
   const r=await fetch("/api/social/ops/beta/witness",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"content-type":"application/json"},body:JSON.stringify(submitted),
   });
   const result=await r.json() as WitnessResult;
   setWitnessResult(result);setStatus(r.ok?
    "Cryptographic signature checked. Human witness acceptance remains BLOCKED.":
    result.error||result.note||"Public signed message did not validate.");
  }catch(e){setStatus(e instanceof Error?e.message:"Signed public challenge is invalid.");}
  finally{setLoading(false);}
 }
 return <section className="social-card lk-m22">
  <header><small>M22 / AUTHENTICATED PREVIEW ONLY</small><h2>Protected Testnet beta preparation</h2>
   <p>Operator workspace for actual creator records, wallet-signature checks, independent chain proofs, Points integrity, and manual release decisions. Nothing here enables public beta, claims, social writes or transactions.</p>
  </header>
  {status&&<p role="status" className="lk-m22-status">{status}</p>}
  <div className="lk-m22-controls"><button type="button" disabled={loading} onClick={()=>void reload()}>
   {loading?"Inspecting…":"Refresh verified database state"}</button></div>
  {data&&<>
   <div className="lk-m22-summary">
    <div><small>Public beta</small><strong>{data.readiness.releaseDecision}</strong></div>
    <div><small>M21 independent gates</small><strong>{data.readiness.m21Verified}/{data.readiness.m21Total}</strong></div>
    <div><small>Outstanding checks</small><strong>{data.readiness.blockers}</strong></div>
    <div><small>Reviewable profiles</small><strong>{data.realCreatorProfiles.length}</strong></div>
    <div><small>Pending media</small><strong>{data.moderation.pendingMedia}</strong></div>
    <div><small>Points checked</small><strong>{data.points.checked}/{data.points.reviewed}</strong></div>
   </div>
   <p className="lk-m22-warning">NO-GO is enforced as an engineering gate. No wallet, signature, uploaded file, CI fixture, or screenshot can independently approve public release.</p>
   <h3>Real creator profiles · latest 12</h3>
   {data.realCreatorProfiles.length?<div className="lk-m22-rows">{data.realCreatorProfiles.map(p=>
    <div className="lk-m22-item" key={p.address}><strong>@{p.handle}</strong>
     <small>{p.address} · {p.visible_posts} visible moderated posts</small></div>)}</div>:
    <p>No actual approved creator profiles currently visible in this environment.</p>}
   <h3>Real visible posts · latest 12</h3>
   {data.visibleModeratedPosts.length?<div className="lk-m22-rows">{data.visibleModeratedPosts.map(p=>
    <div className="lk-m22-item" key={p.id}><strong>@{p.handle}</strong>
     <small>{p.media_status==="approved"?"Approved hosted media":p.media_status==="none"?"Text-only post":"Not approved"}</small>
     {p.asset_id&&<small>Unverified attachment {p.asset_chain}/{p.asset_type}: {p.asset_id}</small>}
     <small>{p.id} · {new Date(p.created_at).toLocaleString()}</small></div>)}</div>:
    <p>No real visible creator posts. Pending or rejected media is never included.</p>}
   <div className="lk-m22-section">
    <h3>Independently inspect a genuine creator asset</h3>
    <p>Paste a public transaction hash or native owner/factory/Uniq reference. Looke independently checks actual Testnet RPC receipts and current chain state. It does not issue a token or mint an NFT.</p>
    <div className="lk-m22-controls">
     <button type="button" onClick={()=>setKind("token")}>Ultra EVM creator token</button>
     <button type="button" onClick={()=>setKind("uniq")}>Native Ultra Uniq</button>
    </div>
    {kind==="token"?<div className="lk-m22-fields">
      <label>Real deployed factory address<input value={factory} onChange={e=>setFactory(e.target.value)}
       placeholder="0x…"/></label>
      <label>Canonical CoinCreated transaction hash<input value={tx} onChange={e=>setTx(e.target.value)}
       placeholder="0x…"/></label>
    </div>:<div className="lk-m22-fields">
      <label>Native Ultra Testnet account<input value={nativeOwner}
        onChange={e=>setNativeOwner(e.target.value)} placeholder="Native account name"/></label>
      <label>Factory ID<input value={nativeFactory} onChange={e=>setNativeFactory(e.target.value)}
       placeholder="1"/></label>
      <label>Uniq token ID<input value={tokenId} onChange={e=>setTokenId(e.target.value)}
       placeholder="1"/></label>
    </div>}
    <button type="button" disabled={loading} onClick={checkAsset}>
     Read Testnet evidence only</button>
    {data.independentAssetProof&&<p role="status">
     {data.independentAssetProof.status.toUpperCase()}: {data.independentAssetProof.note}
     {data.independentAssetProof.source&&" Source: "+data.independentAssetProof.source}
    </p>}
   </div>
   <div className="lk-m22-section">
    <h3>Read-only wallet signature acceptance</h3>
    <p>An operator can inspect a genuine, explicitly wallet-signed public EIP-191 challenge. Supply the complete public challenge and its signature as JSON. A valid signature proves key control only: it does not create a Looke session, consume the nonce, prove unique-human identity or authorize spending.</p>
    <label>Signed challenge JSON
      <textarea value={witnessJson} onChange={e=>setWitnessJson(e.target.value)}
       placeholder='{"challenge":{"purpose":"Looke M22 read-only wallet acceptance","address":"0x…",…},"signature":"0x…"}'
       rows={4}/>
    </label>
    <button type="button" disabled={loading||!witnessJson.trim()} onClick={()=>void checkWitness()}>
     Verify cryptographic signature (no transaction)
    </button>
    {witnessResult&&<p className="lk-m22-status">Signature proof: {witnessResult.status}.
      Valid signature: {String(witnessResult.signatureValid)}.
      Live human/session acceptance: not verified.</p>}
   </div>
   <h3>Points and database recovery integrity</h3>
   <p>Points source mismatches: {data.points.mismatches}. Indexed scans: {data.recovery.checkpoint?.scans??0}; audited rewinds: {data.recovery.checkpoint?.rewinds??0}.
   A database backup restore has not been independently witnessed. Counts and sample digests alone do not qualify as an approved restore.</p>
   <h3>Operator Testnet funding guidance</h3>
   <ol className="lk-m22-guide">{data.testFundingGuidance.map((step,i)=><li key={i}>{step}</li>)}</ol>
   <h3>Outstanding independent release checks</h3>
   <div className="lk-m22-gates">
    {data.readiness.requiredWitnesses.map(x=><div className="lk-m22-item" key={x.id}>
     <strong>{x.id.replaceAll(/([A-Z])/g," $1")}</strong><small>{x.reason}</small></div>)}
   </div>
   <p className="lk-m22-foot">The protected Preview may be READY while real-user beta remains NO-GO. Review the M21 Security Acceptance, Points, Moderation and Backend tabs for underlying evidence.</p>
  </>}
 </section>;
}
