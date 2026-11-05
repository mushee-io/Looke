"use client";
import {useCallback,useEffect,useState} from "react";
import "./m28.css";
type Observation={
 operatorAuthorized:true;readOnly:true;immutablePreviewCommit:string|null;
 gate:{decision:"NO_GO";blockers:string[]};
 wallets:{distinctKeysWithConsumedNonce:number;independentlyVerifiedTwoHumanWitnesses:false;
  operatorProofCLI:string};
 liveMedia:{requested:boolean;status:string;inspected:number;verified:number;reason:string;
  independentHumanModeratorAccepted:boolean};
 chain:{token:{status:string;reason:string;txHash?:string};uniq:{status:string;reason:string};
  bothIndependentlyVerified:boolean};
 points:{complete?:boolean;scanned?:number;totalApproved?:number;issues?:unknown[];blockedReason?:string};
 recovery:{fullTables:number;sourceAndSeparatelyRestoredTLSVerifiedByThisRequest:false};
 audit:{signedReferenceCount:number;actualFileDigestVerifiedByThisRequest:false};
 incident:{actualJournalEntries:number;independentlyWitnessedRollback:false};
 publicBetaOpen:false;error?:string;
};
export function M28RealProofLab(){
 const [data,setData]=useState<Observation|null>(null);
 const [status,setStatus]=useState("Retrieving real operator evidence…"),[busy,setBusy]=useState(false);
 const [factory,setFactory]=useState(""),[coinTx,setCoinTx]=useState("");
 const [uniqFactoryId,setUniqFactoryId]=useState(""),[uniqTokenId,setUniqTokenId]=useState("");
 const [uniqOwner,setUniqOwner]=useState("");
 const refresh=useCallback(async(query?:URLSearchParams)=>{
  setBusy(true);
  try{
   const response=await fetch("/api/social/ops/m28"+(query?"?"+query.toString():""),
    {credentials:"same-origin",cache:"no-store"});
   const json=await response.json() as Observation;
   if(!response.ok||!json.operatorAuthorized)throw Error(json.error||"Authorized moderator required.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Read-only verification unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 function inspect(){
  const p=new URLSearchParams({inspectProvider:"true"});
  if(factory.trim()||coinTx.trim()){p.set("tokenFactory",factory.trim());p.set("coinTx",coinTx.trim());}
  if(uniqFactoryId.trim()||uniqOwner.trim()||uniqTokenId.trim()){
   p.set("uniqFactoryId",uniqFactoryId.trim());p.set("uniqOwner",uniqOwner.trim());p.set("uniqTokenId",uniqTokenId.trim());
  }
  void refresh(p);
 }
 return <section className="social-card lk-m28">
  <header><small>M28 / REAL EXTERNAL EVIDENCE</small>
   <h2>Actual provider, asset and witness verification</h2>
   <p>Use real externally sourced records. Nothing on this page creates a wallet session, posts media, authorizes a financial transaction, changes production or approves public beta.</p></header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m28-controls"><button type="button" disabled={busy} onClick={()=>void refresh()}>Read existing records</button></div>
  {data&&<>
   <div className="lk-m28-stats">
    <div><small>Launch</small><strong>NO-GO</strong></div>
    <div><small>Consumed wallet key proofs</small><strong>{data.wallets.distinctKeysWithConsumedNonce}</strong></div>
    <div><small>Provider verified this request</small><strong>{data.liveMedia.verified}/{data.liveMedia.inspected}</strong></div>
    <div><small>Points records examined</small><strong>{data.points.scanned??"Blocked"}</strong></div>
    <div><small>Full restore table coverage</small><strong>{data.recovery.fullTables}</strong></div>
   </div>
   <p className="lk-m28-warning">Independent real-person identities, provider content-safety review, auditor findings, externally witnessed database restoration, and a human go-live decision are NOT established by cryptographic keys or CI fixtures.</p>
   <h3>Live authenticated Cloudinary and Ultra Testnet inspection</h3>
   <p>Enter actual canonical proof identifiers. When you run the check, the server reads approved moderated PostgreSQL media against the authenticated Cloudinary asset API and independently checks both Ultra proof types if you supply both sets of identifiers.</p>
   <div className="lk-m28-fields">
    <label>Deployed Ultra EVM creator factory<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Actual creator-coin receipt hash<input value={coinTx} onChange={e=>setCoinTx(e.target.value)} placeholder="0x…"/></label>
    <label>Native Uniq factory ID<input value={uniqFactoryId} onChange={e=>setUniqFactoryId(e.target.value)}/></label>
    <label>Native Uniq token ID<input value={uniqTokenId} onChange={e=>setUniqTokenId(e.target.value)}/></label>
    <label>Current native Uniq owner<input value={uniqOwner} onChange={e=>setUniqOwner(e.target.value)}/></label>
   </div>
   <button type="button" disabled={busy} onClick={inspect}>Run real read-only provider and chain checks</button>
   <div className="lk-m28-grid">
    <article><strong>Hosted media provider</strong><p>{data.liveMedia.status}: {data.liveMedia.reason}</p>
     <small>Human content moderation is still a separate approval.</small></article>
    <article><strong>Creator coin transaction</strong><p>{data.chain.token.status}: {data.chain.token.reason}</p>
     <small>Ultra EVM chain 18881. No mint was initiated.</small></article>
    <article><strong>Native Uniq owner</strong><p>{data.chain.uniq.status}: {data.chain.uniq.reason}</p>
     <small>Current owner at irreversible native block, not attached text.</small></article>
    <article><strong>Complete Points and anti-sybil</strong><p>{data.points.complete?"Source ledger fully scanned":"Source scan incomplete"}; {data.points.issues?.length??"unknown"} source discrepancies.</p>
     <small>A manual human anti-sybil investigation remains necessary.</small></article>
   </div>
   {data.points.blockedReason&&<p role="status">Source scan blocker: {data.points.blockedReason}</p>}
   <h3>Actual offline operational evidence</h3>
   <ol>
    <li>Ask two actual wallet holders to personally sign fresh, distinct nonfinancial one-use wallet challenges. Have two distinct witnesses inspect sessions and sign a separately bound public observer message. The <code>m28:verify-wallet-evidence</code> CLI checks all four real signatures; independent human attendance is still externally verified.</li>
    <li>Have an independent security auditor review the original report contents and remediation. Run <code>m24:verify-evidence</code> against the actual report bytes and existing M23 evidence ID. Matching SHA-256 does not certify the audit.</li>
    <li>Independently restore a real consistent backup onto a second TLS PostgreSQL endpoint. Run <code>m27:full-restore-audit</code> to compare all 19 existing source and evidence tables. A different human must witness the actual recovery process.</li>
    <li>Run <code>m27:full-points-audit</code> against real database sources and separately investigate coordinated multi-wallet behaviour.</li>
    <li>Run the read-only <code>m27:release-rehearsal</code> to verify the pinned Vercel production alias; do not execute a rollback without a separately authorized incident procedure.</li>
   </ol>
   <h3>Unresolved external release conditions</h3>
   <div className="lk-m28-grid">{data.gate.blockers.map(reason=><article key={reason}>
    <small>UNVERIFIED</small><strong>{reason.replaceAll("_"," ")}</strong></article>)}</div>
   <p className="lk-m28-warning">Final decision: NO-GO. No beta, trading, rewards, token minting/claims, social/media writes or private messaging has been enabled.</p>
  </>}
 </section>;
}
