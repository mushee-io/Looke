"use client";
import {useCallback,useEffect,useState} from "react";
import "./m27.css";
type Assessment={
 operatorAuthorized:true;readOnly:true;previewSha:string|null;
 rehearsal:{decision:"NO_GO";publicBetaOpen:false;blockers:string[]};
 productionAliasExpected:string;productionAliasIndependentlyCheckedByThisAPI:false;
 walletAcceptance:{active_wallet_keys:number;accepted_nonce_records:number;
  independentTwoHumanWitnessVerified:false};
 moderatedMedia:{moderatorApprovedPostReceipts:number;pendingMedia:number;
  pendingReports:number;hostedProvider:{status:string;reason:string}|null;
  independentProviderWitnessApproved:false};
 assetProof:{status:string;note:string}|null;
 proofOfBothAssetsAtCurrentChainHeads:false;
 pointsFullSourceReconciliation:{scanned:number;totalApproved:number;complete:boolean;
  issues:{ledgerId:string;reason:string}[];status:string}|null;
 pointsScanBlocker:string|null;
 antiSybil:{manualReviewEventCount:number;humanIndependenceCleared:false};
 dualRole:{realSignedReferenceRows:number;qualifiedTwoRoleReviewIds:string[];
  distinctRoleSeparationFailures:number;actualHumanRoleSignoff:false};
 recovery:{requiredTables:19;separateTLSRestoreObserved:false;
  independentHumanRestoreWitnessAccepted:false};
 externalAudit:{signedReferences:number;actualFileContentsIndependentlyInspected:false};
 incidentRehearsal:{realRecordedIncidents:number;realProductionRollbackConducted:false};
 releaseDecision:"NO_GO";error?:string;
};
export function M27VerificationLab(){
 const [data,setData]=useState<Assessment|null>(null);
 const [busy,setBusy]=useState(false),[status,setStatus]=useState("Inspecting real operational evidence…");
 const [kind,setKind]=useState<"token"|"uniq">("token");
 const [factory,setFactory]=useState(""),[tx,setTx]=useState("");
 const [owner,setOwner]=useState(""),[factoryId,setFactoryId]=useState(""),[tokenId,setTokenId]=useState("");
 const refresh=useCallback(async(params?:URLSearchParams)=>{
  setBusy(true);
  try{
   const r=await fetch("/api/social/ops/m27"+(params?"?"+params.toString():""),
    {credentials:"same-origin",cache:"no-store"});
   const json=await r.json() as Assessment;
   if(!r.ok||!json.operatorAuthorized)throw Error(json.error||"Moderator authentication required.");
   setData(json);setStatus("");
  }catch(e){setData(null);setStatus(e instanceof Error?e.message:"Evidence collection unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 function probe(){
  const p=new URLSearchParams({assetKind:kind});
  if(kind==="token"){p.set("factory",factory.trim());p.set("tx",tx.trim());}
  else{p.set("nativeOwner",owner.trim());p.set("factoryId",factoryId.trim());p.set("tokenId",tokenId.trim());}
  void refresh(p);
 }
 return <section className="social-card lk-m27">
  <header><small>M27 / INDEPENDENT OPERATIONAL VERIFICATION</small>
   <h2>Witness evidence &amp; protected release rehearsal</h2>
   <p>Actual authenticated database and external-source observations only. These checks do not sign transactions, enable public beta, moderate user posts or approve a launch.</p></header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m27-actions">
   <button type="button" disabled={busy} onClick={()=>void refresh()}>Refresh real records</button>
   <button type="button" disabled={busy} onClick={()=>void refresh(new URLSearchParams({live:"true"}))}>Read real media provider and Ultra RPC</button>
  </div>
  {data&&<>
   <div className="lk-m27-metrics">
    <div><small>Public beta</small><strong>NO-GO</strong></div>
    <div><small>Signed wallet keys</small><strong>{data.walletAcceptance.active_wallet_keys}</strong></div>
    <div><small>Human witnesses accepted</small><strong>None</strong></div>
    <div><small>Reviewed media posts</small><strong>{data.moderatedMedia.moderatorApprovedPostReceipts}</strong></div>
    <div><small>Points inspected</small><strong>{data.pointsFullSourceReconciliation?data.pointsFullSourceReconciliation.scanned+"/"+data.pointsFullSourceReconciliation.totalApproved:"Blocked"}</strong></div>
    <div><small>Restore manifest tables</small><strong>{data.recovery.requiredTables}</strong></div>
   </div>
   <p className="lk-m27-danger">Signing public evidence references does not prove human independence. Database verification does not restore a backup. Even if every technical indicator is green, external operational acceptance and a distinct authorized launch decision remain mandatory.</p>
   <h3>Source-specific acceptance evidence</h3>
   <div className="lk-m27-grid">
    <div><strong>Two-wallet acceptance</strong><p>{data.walletAcceptance.accepted_nonce_records} consumed nonce records across {data.walletAcceptance.active_wallet_keys} distinct wallet keys. Independent two-person witnessing: NOT VERIFIED.</p></div>
    <div><strong>Hosted media and moderation</strong><p>{data.moderatedMedia.moderatorApprovedPostReceipts} moderator-approved source posts; {data.moderatedMedia.pendingMedia} pending media, {data.moderatedMedia.pendingReports} pending reports. Cloudinary: {data.moderatedMedia.hostedProvider?.status??"NOT INSPECTED"}.</p></div>
    <div><strong>Points source and anti-sybil</strong><p>{data.pointsFullSourceReconciliation?.status??"UNVERIFIED"}; {data.pointsFullSourceReconciliation?.issues.length??"unknown"} source discrepancies; {data.antiSybil.manualReviewEventCount} actual risk review events. Human anti-sybil clearance: NOT VERIFIED.</p></div>
    <div><strong>Dual-role signoff boundaries</strong><p>{data.dualRole.realSignedReferenceRows} signed reference rows; {data.dualRole.qualifiedTwoRoleReviewIds.length} reviews contain two distinct role keys. Independent human signoff: NOT VERIFIED.</p></div>
    <div><strong>Full PostgreSQL backup/restore</strong><p>Read-only 19-table row and schema hash CLI provided. No actual separately restored TLS database or independent restore witness has been checked by this page.</p></div>
    <div><strong>Incident and rollback</strong><p>{data.incidentRehearsal.realRecordedIncidents} recorded incident references. Known-good deployment: {data.productionAliasExpected}. No production rollback performed.</p></div>
   </div>
   {data.pointsScanBlocker&&<p className="lk-m27-danger">Full online Points scan blocked: {data.pointsScanBlocker}. Run the bounded operator CLI against the actual database for larger datasets.</p>}
   <h3>Independently inspect creator assets</h3>
   <p>An actual Ultra EVM Testnet CoinCreated receipt and a real native Uniq current-owner record are required. Checking one asset never certifies both.</p>
   <div className="lk-m27-actions">
    <button type="button" onClick={()=>setKind("token")}>EVM coin</button>
    <button type="button" onClick={()=>setKind("uniq")}>Native Uniq</button>
   </div>
   {kind==="token"?<div className="lk-m27-fields">
    <label>Real factory address<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Canonical creator receipt<input value={tx} onChange={e=>setTx(e.target.value)} placeholder="0x…"/></label>
   </div>:<div className="lk-m27-fields">
    <label>Native token owner<input value={owner} onChange={e=>setOwner(e.target.value)}/></label>
    <label>Factory ID<input value={factoryId} onChange={e=>setFactoryId(e.target.value)}/></label>
    <label>Uniq ID<input value={tokenId} onChange={e=>setTokenId(e.target.value)}/></label>
   </div>}
   <button type="button" disabled={busy} onClick={probe}>Check canonical read-only chain evidence</button>
   {data.assetProof&&<p role="status">Chain proof: {data.assetProof.status} — {data.assetProof.note}</p>}
   <h3>Protected release rehearsal steps</h3>
   <ol>
    <li>Confirm signed-out SSO independently, record the exact protected Preview commit and take a real outside-browser witness screenshot.</li>
    <li>Run <code>npm run m27:full-points-audit</code> for complete source-backed ledger review; have a different reviewer investigate sybil patterns and discrepancies.</li>
    <li>Restore an actual backup into a separately controlled TLS PostgreSQL host and run <code>npm run m27:full-restore-audit</code> for all 19 tables, including M26 witness references.</li>
    <li>Inspect hosted media with real provider credentials, moderator audit receipts, independently checked EVM and Uniq on-chain sources, and actual security-audit document contents.</li>
    <li>Use <code>npm run m24:verify-evidence</code> for local real-file SHA-256; separately review audit scope and remediation. A hash match alone is not approval.</li>
    <li>With a read-only Vercel token, run <code>npm run m27:release-rehearsal</code> to inspect the pinned alias and closed feature flags. Never roll back production automatically.</li>
    <li>Obtain independently verified human security and operator signoffs outside this API; any real rollout requires new, separately approved launch controls.</li>
   </ol>
   <h3>Release blockers</h3>
   <div className="lk-m27-grid">{data.rehearsal.blockers.map(x=>
    <div key={x}><small>NOT APPROVED</small><strong>{x.replaceAll("_"," ")}</strong></div>)}</div>
   <p className="lk-m27-danger">Final decision: NO-GO. Public beta, social/media writes, Points accounting, token creation/claims, private messaging and financial transactions remain disabled.</p>
  </>}
 </section>;
}
