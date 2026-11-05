"use client";
import {useCallback,useEffect,useState} from "react";
import "./m21.css";

type Gate={id:string;status:"verified"|"blocked"|"not_checked";reason:string;source?:string};
type Report={milestone:"M21";status:"blocked"|"awaiting-independent-security-review";
 required:number;verified:number;blocked:string[];checks:Gate[];
 publicBetaOpen:false;financialBroadcastEnabled:false;
 tokenClaimsEnabled:false;privateMessagingEnabled:false;transactionsSent:0};
type Acceptance={
 authorized:boolean;readOnly:true;liveProbesRequested:boolean;
 flagsClosed:boolean;report:Report;
 operational:{profiles:number;posts:number;visible_posts:number;pending_media:number;
  approved_media:number;media_approvals:number;live_sessions:number;
  approved_points:string;index_events:number;index_rewinds:number;index_scans:number;
  risk_reviews:number;unreviewed_reports:number};
 reconciliation:{scanned:number;totalApproved:number;complete:boolean;issues:{ledgerId:string;reason:string}[]};
 liveEvidence:{rpc:{evm:{status:string;headHash?:string};native:{status:string;irreversibleBlock?:number}}|null;
 factory:{status:string;confirmedLaunches:number;complete:boolean;sourceHashes:string[]}|null;
 provider:{status:string;reason:string}|null;
 database:{status:string;note:string}|null;
 protection:{status:string;signedOutChallengeVerified:boolean}|null};
 error?:string;note:string;
};
const labels:Record<string,string>={
 previewDeploymentIdentity:"Exact Preview deployment identity",
 signedOutProtection:"Independent signed-out protection challenge",
 walletSessionWitness:"Real wallet-signed user acceptance",
 walletIsolation:"Cross-wallet account isolation witness",
 mediaProviderInspection:"Independent hosted-media provider inspection",
 mediaModerationAudit:"Actual media moderation audit",
 creatorEngagementModeration:"Real creator engagement moderation",
 pointsEvidenceReconciliation:"Reviewed Points source reconciliation",
 antiSybilIndependentReview:"Independent anti-sybil review",
 indexRecoveryWitness:"Live index and restore witness",
 databaseTLSLeastPrivilege:"TLS database and restricted role",
 databaseRestoreWitness:"Operator-performed database restore proof",
 ultraEvmReadOnlyHead:"Ultra EVM Testnet head",
 ultraNativeReadOnlyHead:"Native Ultra irreversible block",
 creatorCoinReceiptProof:"Creator coin receipt and bytecode",
 nativeUniqOwnershipProof:"Native Uniq ownership evidence",
 independentSecurityAudit:"Independent security audit",
 operatorReleaseAuthorization:"Release authorization by operator",
};
export function M21SecurityLab(){
 const [data,setData]=useState<Acceptance|null>(null);
 const [running,setRunning]=useState(false);
 const [message,setMessage]=useState("Verifying reviewer role and reading actual database evidence…");
 const check=useCallback(async(live=false)=>{
  setRunning(true);
  try{
   const r=await fetch("/api/social/ops/acceptance"+(live?"?live=true":""),
    {credentials:"same-origin",cache:"no-store"});
   const x=await r.json() as Acceptance;
   if(!r.ok||!x.authorized||!x.report)throw Error(x.error||"M21 acceptance evidence unavailable.");
   setData(x);setMessage("");
  }catch(e){setData(null);setMessage(e instanceof Error?e.message:"No verified acceptance evidence.");}
  finally{setRunning(false);}
 },[]);
 useEffect(()=>{void check(false);},[check]);
 return <section className="social-card lk-m21">
   <header><span>M21 · REAL TESTNET EVIDENCE</span><h2>Testnet &amp; security acceptance</h2>
    <p>Reviewer-only evidence laboratory. A passing code test or RPC head is not proof of wallet use, a creator coin issuance, verified Uniq ownership, independent audit, or authorization to open public beta.</p>
   </header>
   {message&&<p role="status">{message}</p>}
   {data&&<>
    <div className="lk-m21-metrics">
      <div><small>External acceptance status</small><strong>{data.report.status==="blocked"?"BLOCKED":"External review required"}</strong></div>
      <div><small>Verified narrow gates</small><strong>{data.report.verified} / {data.report.required}</strong></div>
      <div><small>Real creator posts</small><strong>{data.operational.posts}</strong></div>
      <div><small>Pending media</small><strong>{data.operational.pending_media}</strong></div>
      <div><small>Indexed source events</small><strong>{data.operational.index_events}</strong></div>
      <div><small>Reviewed Points events</small><strong>{data.operational.approved_points}</strong></div>
    </div>
    <p className="lk-m21-warning">Public beta, token claims, wallet transaction broadcasting, and private messaging remain disabled. Technical gate results do not override operator approval.</p>
    <div className="lk-m21-actions">
     <button type="button" disabled={running} onClick={()=>{void check(false);}}>
       Refresh actual database evidence
     </button>
     <button type="button" disabled={running} onClick={()=>{void check(true);}}>
       {running?"Checking…":"Run independent read-only Testnet and provider checks"}
     </button>
    </div>
    {data.liveProbesRequested&&<p className="lk-m21-hint">The live check queries actual Ultra Testnet RPC endpoints, configured factory receipts, Cloudinary provider evidence, TLS database role and Vercel protection when credentials are available. Unconfigured or unreachable probes remain blocked.</p>}
    <h3>Required acceptance gates</h3>
    <div className="lk-m21-gates">{data.report.checks.map(g=><article key={g.id} className="lk-m21-gate">
     <span className={g.status==="verified"?"lk-m21-ok":"lk-m21-blocked"}>
       {g.status==="verified"?"Verified evidence":"Not accepted"}
     </span>
     <strong>{labels[g.id]??g.id}</strong>
     <p>{g.reason}</p>
     {g.source&&<small>Evidence: {g.source}</small>}
    </article>)}</div>
    <h3>Bounded Points reconciliation</h3>
    <p>Checked {data.reconciliation.scanned} of {data.reconciliation.totalApproved} approved ledger records.
     {data.reconciliation.complete?" This sample covers all approved records.":" This is not complete coverage."}
     {data.reconciliation.issues.length>0?" Mismatches require independent operator review.":" No mismatch found within the sample."}</p>
    <small>Read only. No user wallet signed any action here; no claims, minting, account punishment or recurring job executed.</small>
   </>}
  </section>;
}
