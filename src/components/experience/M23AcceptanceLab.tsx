"use client";
import {useCallback,useEffect,useState} from "react";
import "./m23.css";
type Challenge={purpose:string;address:string;origin:string;network:string;nonce:string;
 issuedAt:string;expiresAt:string;previewCommit:string;scope:string};
type Issued={ok:true;challengeId:string;challenge:Challenge;message:string;expiresAt:string};
type Acceptance={
 reviewerAuthorized:boolean;readOnly:true;previewOnly:boolean;releaseDecision:"NO_GO";
 acceptanceWritesEnabled:boolean;previewIdentity:{origin:string;sha:string};
 distinctWalletsWithConsumedNonce:number;twoWalletCryptographicProof:boolean;
 twoWalletIndependentHumanWitnessAccepted:false;
 operatorWalletProofs:{wallet:string;reviewer:string;verified_at:string;session_expires_at:string}[];
 countersignatures:{kind:string;auditor:string;recorded_at:string; evidence_sha256:string;
  evidence_url:string;artifactContentIndependentlyVerified:false}[];
 reports:{realProfiles:number;visiblePosts:number;pendingMedia:number;openReports:number;
  riskReviews:number;realMediaUploads:number};
 pointsReconciliation:{scanned:number;totalApproved:number;complete:boolean;
  issues:{ledgerId:string;reason:string}[]};
 independentlyCheckedMediaProvider:{status:string;reason:string}|null;
 independentAssetProof:{kind:string;status:string;source:string|null;note:string}|null;
 independentChainHeads:unknown;
 securityAuditApproved:false;databaseRestoreIndependentlyWitnessed:false;
 operatorReleaseApproved:false;
 error?:string;
};
async function read(params?:URLSearchParams){
 const url="/api/social/ops/m23"+(params?"?"+params.toString():"");
 const r=await fetch(url,{cache:"no-store",credentials:"same-origin"});
 const body=await r.json() as Acceptance;
 if(!r.ok||!body.reviewerAuthorized)throw Error(body.error||"M23 reviewer evidence unavailable.");
 return body;
}
async function write(payload:Record<string,unknown>){
 const r=await fetch("/api/social/ops/m23",{method:"POST",credentials:"same-origin",
  headers:{"content-type":"application/json"},body:JSON.stringify(payload),cache:"no-store"});
 const v=await r.json() as Record<string,unknown>&{error?:string};
 if(!r.ok||!v.ok)throw Error(v.error||"Controlled acceptance action was rejected.");
 return v;
}
export function M23AcceptanceLab(){
 const [data,setData]=useState<Acceptance|null>(null);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Reading real controlled Testnet acceptance evidence…");
 const [target,setTarget]=useState("");
 const [issued,setIssued]=useState<Issued|null>(null);
 const [manualSig,setManualSig]=useState("");
 const [recordedWallet,setRecordedWallet]=useState<string|null>(null);
 const [kind,setKind]=useState<"restore"|"security"|"operator">("restore");
 const [evidenceUrl,setEvidenceUrl]=useState("");
 const [evidenceHash,setEvidenceHash]=useState("");
 const [auditor,setAuditor]=useState("");
 const [signedAt,setSignedAt]=useState("");
 const [auditSignature,setAuditSignature]=useState("");
 const [assetMode,setAssetMode]=useState<"token"|"uniq">("token");
 const [factory,setFactory]=useState("");const [tx,setTx]=useState("");
 const [nativeOwner,setNativeOwner]=useState("");
 const [factoryId,setFactoryId]=useState("");const [tokenId,setTokenId]=useState("");
 const load=useCallback(async(params?:URLSearchParams)=>{
  setBusy(true);
  try{setData(await read(params));setStatus("");}
  catch(e){setData(null);setStatus(e instanceof Error?e.message:"M23 acceptance unavailable.");}
  finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function operatorAction(payload:Record<string,unknown>){
  setBusy(true);
  try{const out=await write(payload);setStatus(String(out.note||"Recorded actual operator proof."));
   await load();return out;}
  catch(e){setStatus(e instanceof Error?e.message:"Operator action not permitted.");return null;}
  finally{setBusy(false);}
 }
 async function issue(){
  const out=await operatorAction({action:"issue",wallet:target.trim()});
  if(out){setIssued(out as unknown as Issued);setRecordedWallet(null);setManualSig("");}
 }
 async function consume(signature:string){
  if(!issued)return;
  const out=await operatorAction({action:"consume",challengeId:issued.challengeId,
    challenge:issued.challenge,signature});
  if(out){setRecordedWallet(String(out.wallet));setIssued(null);setManualSig("");}
 }
 async function signWithWallet(){
  if(!issued)return;
  try{
   const ethereum=(window as typeof window&{
    ethereum?:{request(args:{method:string;params?:unknown[]}):Promise<unknown>};
   }).ethereum;
   if(!ethereum)throw Error("No EIP-1193 wallet is connected. The wallet holder may sign the exact public message externally and supply the signature.");
   const accounts=await ethereum.request({method:"eth_requestAccounts"}) as string[];
   if(!accounts.some(a=>a.toLowerCase()===issued.challenge.address.toLowerCase()))
    throw Error("Connected signer does not match the real wallet challenged by the operator.");
   // personal_sign is message-only: NO transaction, approval, mint, transfer or wallet key access.
   const signature=await ethereum.request({method:"personal_sign",
    params:[issued.message,issued.challenge.address]});
   if(typeof signature!=="string")throw Error("Wallet did not return a public signature.");
   await consume(signature);
  }catch(e){setStatus(e instanceof Error?e.message:"Wallet message signature rejected.");}
 }
 const identity=data?.previewIdentity;
 const evidencePayload={kind,evidenceHash:evidenceHash.trim(),evidenceUrl:evidenceUrl.trim(),
  auditor:auditor.trim().toLowerCase(),signedAt};
 const evidenceMessage=identity?[
  "Looke M23 external evidence countersignature",
  "Origin: "+identity.origin,
  "Preview Commit: "+identity.sha,
  "Kind: "+kind,
  "Evidence SHA-256: "+evidencePayload.evidenceHash,
  "Evidence URL: "+evidencePayload.evidenceUrl,
  "Auditor Wallet: "+evidencePayload.auditor,
  "Signed At: "+evidencePayload.signedAt,
  "Scope: evidence-reference-only; NOT evidence-content validation or beta activation.",
 ].join("\n"):"";
 const validEvidence=Boolean(identity&&/^https:\/\//.test(evidenceUrl)&&
  /^[a-f0-9]{64}$/.test(evidenceHash)&&/^0x[0-9a-fA-F]{40}$/.test(auditor)&&signedAt);
 function checkAsset(){
  const params=new URLSearchParams();
  params.set("assetKind",assetMode);
  if(assetMode==="token"){params.set("factory",factory.trim());params.set("tx",tx.trim());}
  else{params.set("nativeOwner",nativeOwner.trim());params.set("factoryId",factoryId.trim());params.set("tokenId",tokenId.trim());}
  void load(params);
 }
 return <section className="social-card lk-m23">
  <header><small>M23 · CONTROLLED TESTNET ACCEPTANCE</small>
   <h2>Evidence and wallet acceptance</h2>
   <p>Moderator-only operator tools. A real one-use cryptographic signature, an external auditor signature or an on-chain RPC response never automatically authorizes public beta.</p></header>
  {status&&<p role="status">{status}</p>}
  <div className="lk-m23-controls"><button type="button" disabled={busy} onClick={()=>void load()}>Refresh real records</button>
   <button type="button" disabled={busy} onClick={()=>void load(new URLSearchParams({live:"true"}))}>Recheck read-only provider and chain evidence</button>
  </div>
  {data&&<>
   <div className="lk-m23-metrics">
    <div><small>Public beta</small><strong>NO-GO</strong></div>
    <div><small>Verified nonce / wallet pairs</small><strong>{data.distinctWalletsWithConsumedNonce}</strong></div>
    <div><small>Visible creator posts</small><strong>{data.reports.visiblePosts}</strong></div>
    <div><small>Pending media / reports</small><strong>{data.reports.pendingMedia} / {data.reports.openReports}</strong></div>
    <div><small>Points checked</small><strong>{data.pointsReconciliation.scanned}/{data.pointsReconciliation.totalApproved}</strong></div>
    <div><small>Manual risk reviews</small><strong>{data.reports.riskReviews}</strong></div>
   </div>
   <p className="lk-m23-warning">Beta remains closed. Real two-wallet HUMAN acceptance, independent audited restores, provider moderation and operator launch approval have not been certified by this dashboard.</p>
   <h3>One-use signed-wallet acceptance</h3>
   <p>Only an already registered unsuspended Testnet creator wallet can receive a challenge. The operator cannot sign their own challenge. The wallet holder must approve a personal message, not a financial transaction. The server consumes the nonce atomically before recording an acceptance-only proof.</p>
   <label>Real creator wallet address<input placeholder="0x…" value={target} onChange={e=>setTarget(e.target.value)}/></label>
   <button type="button" disabled={busy||!data.acceptanceWritesEnabled} onClick={()=>void issue()}>Issue wallet challenge (5 minutes)</button>
   {!data.acceptanceWritesEnabled&&<p role="status">Acceptance-only operator writes are disabled by default in this Preview. Social posting and media uploads remain off regardless.</p>}
   {issued&&<div className="lk-m23-evidence">
    <strong>Challenge {issued.challengeId}</strong>
    <small>Expires {new Date(issued.expiresAt).toLocaleString()} · exact Preview commit {issued.challenge.previewCommit.slice(0,9)}</small>
    <textarea readOnly rows={9} value={issued.message}/>
    <div className="lk-m23-controls"><button type="button" onClick={()=>void navigator.clipboard.writeText(issued.message)}>Copy public signing message</button>
     <button type="button" disabled={busy} onClick={()=>void signWithWallet()}>Sign personal message with browser wallet</button></div>
    <label>Alternatively paste the wallet holder's public EIP-191 signature<input value={manualSig} onChange={e=>setManualSig(e.target.value)} placeholder="0x…"/></label>
    <button type="button" disabled={busy||!manualSig.trim()} onClick={()=>void consume(manualSig.trim())}>Verify signature and consume nonce</button>
   </div>}
   {recordedWallet&&<p role="status">Cryptographic one-use signature accepted for {recordedWallet}; independent human acceptance and app-login session remain unverified.</p>}
   <h3>Recorded acceptance-only proofs</h3>
   {data.operatorWalletProofs.length===0?<p>No real signed, consumed wallet challenges yet.</p>:data.operatorWalletProofs.map(x=>
    <div key={x.wallet+":"+x.verified_at} className="lk-m23-evidence">
     <strong>{x.wallet}</strong><small>Verified {new Date(x.verified_at).toLocaleString()} · Acceptance-only session, no social login</small>
    </div>)}
   <p>Two distinct cryptographic wallets: {data.twoWalletCryptographicProof?"observed":"not yet observed"}. Independent two-person witnessing: <strong>NOT ACCEPTED</strong>.</p>
   <h3>Independent Testnet creator asset proofs</h3>
   <div className="lk-m23-controls">
    <button type="button" onClick={()=>setAssetMode("token")}>Ultra EVM creator coin</button>
    <button type="button" onClick={()=>setAssetMode("uniq")}>Native Uniq</button></div>
   {assetMode==="token"?<div className="lk-m23-fields">
    <label>Deployed factory address<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x…"/></label>
    <label>Actual CoinCreated transaction hash<input value={tx} onChange={e=>setTx(e.target.value)} placeholder="0x…"/></label>
   </div>:<div className="lk-m23-fields">
    <label>Native Ultra Testnet owner<input value={nativeOwner} onChange={e=>setNativeOwner(e.target.value)}/></label>
    <label>Factory ID<input value={factoryId} onChange={e=>setFactoryId(e.target.value)}/></label>
    <label>Uniq ID<input value={tokenId} onChange={e=>setTokenId(e.target.value)}/></label>
   </div>}
   <button type="button" disabled={busy} onClick={checkAsset}>Independently inspect real chain proof (read-only)</button>
   {data.independentAssetProof&&<p className="lk-m23-evidence">{data.independentAssetProof.status}: {data.independentAssetProof.note} {data.independentAssetProof.source&&" / "+data.independentAssetProof.source}</p>}
   <h3>Actual hosted-media and moderation</h3>
   <p>Attached upload references: {data.reports.realMediaUploads}. Media pending human review: {data.reports.pendingMedia}. {data.independentlyCheckedMediaProvider?
    "Independent provider inspection: "+data.independentlyCheckedMediaProvider.status+" — "+data.independentlyCheckedMediaProvider.reason:
    "Independent provider inspection has not run; the presence of an upload row does not prove the media exists at the host."}</p>
   <h3>Points / anti-sybil integrity</h3>
   <p>{data.pointsReconciliation.scanned} approved ledger entries checked from {data.pointsReconciliation.totalApproved}. {data.pointsReconciliation.issues.length} evidence mismatches. Manual risk reviews: {data.reports.riskReviews}. No automated human-uniqueness verdict or token claim is made.</p>
   <h3>External recovery, audit and operator countersignatures</h3>
   <p>Provide a SHA-256 digest and externally hosted immutable artifact. A separately allowlisted external auditor or release signer must sign the exact public message. Its signature can be recorded, but evidence contents, real backup restoration, independent audit and go-live decision still require independent validation.</p>
   <div className="lk-m23-fields">
    <label>Type<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}>
     <option value="restore">Restore report</option><option value="security">Security audit</option><option value="operator">Operator release review</option></select></label>
    <label>Evidence SHA-256<input value={evidenceHash} onChange={e=>setEvidenceHash(e.target.value)} placeholder="64 lowercase hex characters"/></label>
    <label>Evidence HTTPS link<input value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} placeholder="https://…"/></label>
    <label>Auditor/release-signer wallet<input value={auditor} onChange={e=>setAuditor(e.target.value)} placeholder="0x…"/></label>
   </div>
   <button type="button" onClick={()=>setSignedAt(new Date().toISOString())}>Prepare a five-minute evidence message</button>
   {validEvidence&&<div className="lk-m23-evidence"><textarea readOnly rows={10} value={evidenceMessage}/>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(evidenceMessage)}>Copy to independent external reviewer</button>
    <label>Reviewer EIP-191 signature<input value={auditSignature} onChange={e=>setAuditSignature(e.target.value)} placeholder="0x…"/></label>
    <button type="button" disabled={busy||!data.acceptanceWritesEnabled||!auditSignature.trim()}
     onClick={()=>void operatorAction({action:"record_evidence",...evidencePayload,signature:auditSignature.trim()})}>Verify and record external countersignature</button></div>}
   {data.countersignatures.length===0?<p>No separately signed evidence recorded yet.</p>:data.countersignatures.map(a=>
    <div key={a.kind+":"+a.evidence_sha256} className="lk-m23-evidence">
     <strong>{a.kind} · {a.auditor}</strong>
     <small>SHA-256: {a.evidence_sha256} · {new Date(a.recorded_at).toLocaleString()}</small>
     <small>External document contents NOT independently verified by this acceptance endpoint.</small>
    </div>)}
   <p className="lk-m23-warning">External security audit approved: NO · Witnessed database restore approved: NO · Operator public beta release approved: NO. Even a verified auditor signature cannot change these gates.</p>
  </>}
 </section>;
}
