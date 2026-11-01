"use client";

import {useEffect,useState,type FormEvent} from "react";
import {TrendingUp,ShieldCheck,Users,RefreshCw,ThumbsUp,FileSearch} from "lucide-react";
type Evidence={topic:string;posts:number;authors:number;eligibleForNomination:boolean;criterion:string};
type Proposal={
 id:string;topic:string;slug:string;trendRef:string;name:string;symbol:string;
 supplyTokens:string;createdAt:string;proposerName:string;proposerHandle:string|null;
 isOwner:boolean;endorsements:number;viewerEndorsed:boolean;
 evidencePosts:number;evidenceAuthors:number;evidenceCurrent:boolean;status:string;
};
type Preflight={check:{status:string;factoryAddress:string|null;existingCoin:string|null};warning:string};
type Results={proposals:Proposal[];error?:string};

/**
 * A social nomination board, not an exchange or onchain governance application.
 * No wallet signature, token issuance, approval or spending is requested.
 */
export function TrendGovernance({authenticated,onRequireLogin}:{
 authenticated:boolean;onRequireLogin:()=>void;
}){
 const [proposals,setProposals]=useState<Proposal[]>([]);
 const [topic,setTopic]=useState("");
 const [name,setName]=useState("");
 const [symbol,setSymbol]=useState("");
 const [supply,setSupply]=useState("1000000");
 const [metadata,setMetadata]=useState("");
 const [evidence,setEvidence]=useState<Evidence|null>(null);
 const [checking,setChecking]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [loading,setLoading]=useState(true);
 const [confirmWithdraw,setConfirmWithdraw]=useState<string|null>(null);
 const [preflight,setPreflight]=useState<{id:string;value:Preflight}|null>(null);

 async function refresh(){
  setLoading(true);
  try{
   const response=await fetch("/api/trend-coins/proposals",{cache:"no-store"});
   const data=await response.json() as Results;
   if(!response.ok)throw new Error(data.error??"Nominations are unavailable");
   setProposals(data.proposals??[]);
  }catch(e){setError(e instanceof Error?e.message:"Nominations are unavailable");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[authenticated]);

 async function checkEvidence(){
  setChecking(true);setError("");setEvidence(null);
  try{
   const response=await fetch("/api/trend-coins/evidence?topic="+encodeURIComponent(topic),{cache:"no-store"});
   const data=await response.json() as Evidence&{error?:string};
   if(!response.ok)throw new Error(data.error??"Evidence unavailable");
   setEvidence(data);
  }catch(e){setError(e instanceof Error?e.message:"Evidence unavailable");}
  finally{setChecking(false);}
 }
 async function nominate(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!authenticated){onRequireLogin();return;}
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/trend-coins/proposals",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({topic,name,symbol,supplyTokens:supply,metadataURI:metadata})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Could not nominate topic");
   setTopic("");setName("");setSymbol("");setSupply("1000000");setMetadata("");setEvidence(null);
   setMessage("Topic nominated for review. No coin was created and no governance decision was made.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Nomination unavailable");}
  finally{setBusy(false);}
 }
 async function endorse(p:Proposal){
  if(!authenticated){onRequireLogin();return;}
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/trend-coins/proposals/"+encodeURIComponent(p.id)+"/endorse",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({endorse:!p.viewerEndorsed})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Endorsement failed");
   setMessage(p.viewerEndorsed?"Endorsement removed.":"Endorsement recorded as a nonbinding community signal.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Endorsement failed");}
  finally{setBusy(false);}
 }
 async function withdraw(p:Proposal){
  if(confirmWithdraw!==p.id || busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/trend-coins/proposals/"+encodeURIComponent(p.id)+"/withdraw",{method:"POST"});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Withdrawal failed");
   setConfirmWithdraw(null);
   setMessage("Your nomination was withdrawn. Its topic remains reserved to prevent immediate re-nomination.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Withdrawal failed");}
  finally{setBusy(false);}
 }
 async function runPreflight(p:Proposal){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/trend-coins/preflight?id="+encodeURIComponent(p.id),{cache:"no-store"});
   const data=await response.json() as Preflight&{error?:string};
   if(!response.ok)throw new Error(data.error??"Preflight failed");
   setPreflight({id:p.id,value:data});
  }catch(e){setError(e instanceof Error?e.message:"Preflight unavailable");}
  finally{setBusy(false);}
 }

 return <section aria-label="Looke trend coin community nominations"
   style={{border:"1px solid #e5e2ef",borderRadius:18,padding:22,margin:"32px 0",background:"#fcfbff"}}>
   <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
     <TrendingUp size={23}/><h2 style={{fontSize:20,margin:0}}>Trend coin nominations</h2>
     <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#665295"}}>M11 · NONBINDING GOVERNANCE</span>
   </div>
   <p style={{fontSize:12,color:"#777",lineHeight:1.6,margin:"12px 0 20px"}}>
     Nominate topics backed by real public posts. Other signed-in creators may endorse a proposal.
     These are <strong>social interest signals, not verified human votes or permission to mint</strong>.
     Public token creation, financial trading and mainnet activity are disabled.
   </p>
   <form onSubmit={e=>void nominate(e)} style={{display:"grid",gap:11,padding:16,background:"#fff",border:"1px solid #eceaf3",borderRadius:12}}>
     <strong style={{fontSize:14}}>Suggest a trend</strong>
     <label style={{fontSize:12,fontWeight:700}}>Topic (3–48 letters, numbers, spaces or hyphens)
       <input required maxLength={48} value={topic}
         onChange={e=>{setTopic(e.target.value);setEvidence(null);}}
         placeholder="ultra gaming" style={{display:"block",width:"100%",padding:11,marginTop:6,borderRadius:8,border:"1px solid #ddd"}}/>
     </label>
     <button type="button" className="subtle-cta" disabled={!topic.trim()||checking}
       onClick={()=>void checkEvidence()}><FileSearch size={14}/> {checking?"Checking…":"Check real topic activity"}</button>
     {evidence&&<p role="status" style={{fontSize:12,color:evidence.eligibleForNomination?"#21734e":"#9e653d"}}>
       {evidence.posts} public posts · {evidence.authors} author accounts (14 days).
       {evidence.eligibleForNomination?" Topic activity threshold met.":" Needs at least 3 posts from 2 accounts."}
     </p>}
     <label style={{fontSize:12,fontWeight:700}}>Proposed coin name
       <input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}
         style={{display:"block",width:"100%",padding:11,marginTop:6,borderRadius:8,border:"1px solid #ddd"}}/>
     </label>
     <label style={{fontSize:12,fontWeight:700}}>Symbol (2–12 uppercase letters or digits)
       <input required pattern="[A-Z0-9]{2,12}" maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)}
         style={{display:"block",width:"100%",padding:11,marginTop:6,borderRadius:8,border:"1px solid #ddd"}}/>
     </label>
     <label style={{fontSize:12,fontWeight:700}}>Fixed token supply (whole tokens, maximum 1 billion)
       <input required inputMode="numeric" pattern="[1-9][0-9]*" value={supply} onChange={e=>setSupply(e.target.value)}
         style={{display:"block",width:"100%",padding:11,marginTop:6,borderRadius:8,border:"1px solid #ddd"}}/>
     </label>
     <label style={{fontSize:12,fontWeight:700}}>Pinned IPFS metadata URI
       <input required maxLength={256} placeholder="ipfs://CID/metadata.json" value={metadata}
         onChange={e=>setMetadata(e.target.value)}
         style={{display:"block",width:"100%",padding:11,marginTop:6,borderRadius:8,border:"1px solid #ddd"}}/>
     </label>
     <button type="submit" className="primary-button" disabled={busy||!authenticated}>
       {busy?"Working…":"Nominate for review (no mint)"}
     </button>
     {!authenticated&&<button type="button" className="subtle-cta" onClick={onRequireLogin}>Sign in to nominate</button>}
     <small style={{color:"#8b8794",lineHeight:1.5}}>At least three visible posts by two creator accounts in 14 days. Three nominations per account per 30 days. Evidence alone doesn't establish an independent community.</small>
   </form>
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:23,gap:8}}>
     <h3 style={{fontSize:16,margin:0}}>Open community nominations</h3>
     <button type="button" className="subtle-cta" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button>
   </div>
   {error&&<p role="alert" style={{fontSize:12,color:"#b73552",marginTop:10}}>{error}</p>}
   {message&&<p role="status" style={{fontSize:12,color:"#26724f",marginTop:10}}>{message}</p>}
   {loading?<p role="status" style={{fontSize:12,marginTop:15}}>Loading nominations…</p>:
     proposals.length===0?<p style={{fontSize:12,color:"#888",marginTop:15}}>No open nominations. Topics must meet the public activity threshold before nomination.</p>:
     proposals.map(p=><article key={p.id} style={{padding:16,border:"1px solid #e7e4f0",borderRadius:12,background:"#fff",marginTop:12}}>
       <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
         <strong style={{fontSize:14}}>{p.name} ({"$"+p.symbol})</strong>
         <span style={{fontSize:11,color:"#8d7cac"}}>Under review · no issuance</span>
       </div>
       <p style={{fontSize:12,margin:"8px 0"}}>Topic: <strong>#{p.slug}</strong> · Proposed by {p.proposerHandle?"@"+p.proposerHandle:p.proposerName}</p>
       <p style={{fontSize:12,color:"#777",margin:"8px 0",lineHeight:1.5}}>
         <Users size={14} style={{display:"inline",verticalAlign:"middle"}}/> {p.evidencePosts} visible posts by {p.evidenceAuthors} accounts ·
         {p.endorsements} endorsements · {p.evidenceCurrent?" Activity threshold currently met":" Activity threshold no longer met"}
       </p>
       <p style={{fontSize:11,color:"#9a93a3",overflowWrap:"anywhere"}}>Trend ref: {p.trendRef}</p>
       <div style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:12}}>
         <button type="button" className="subtle-cta" disabled={busy||p.isOwner||(!p.viewerEndorsed&&new Date(p.createdAt).getTime()+14*86400_000<=Date.now())}
           aria-pressed={p.viewerEndorsed} onClick={()=>void endorse(p)}>
           <ThumbsUp size={14}/> {p.viewerEndorsed?"Remove endorsement":"Endorse (nonbinding)"}
         </button>
         <button type="button" className="subtle-cta" disabled={busy} onClick={()=>void runPreflight(p)}>
           <ShieldCheck size={14}/> Read-only factory check
         </button>
         {p.isOwner&&(confirmWithdraw!==p.id?
           <button type="button" className="subtle-cta" onClick={()=>setConfirmWithdraw(p.id)}>Withdraw my nomination</button>:
           <span style={{display:"inline-flex",alignItems:"center",gap:9,fontSize:12}}>
             Confirm withdrawal? <button type="button" onClick={()=>void withdraw(p)} disabled={busy}>Confirm</button>
             <button type="button" onClick={()=>setConfirmWithdraw(null)}>Cancel</button>
           </span>)}
       </div>
       {preflight?.id===p.id&&<div role="status" style={{padding:12,borderRadius:8,background:"#f7f5fc",marginTop:11}}>
         <strong style={{fontSize:12}}>Factory: {preflight.value.check.status.replaceAll("_"," ")}</strong>
         <p style={{fontSize:11,overflowWrap:"anywhere"}}>Existing mapping: {preflight.value.check.existingCoin||"none confirmed"}</p>
         <p style={{fontSize:11,color:"#916681"}}>{preflight.value.warning}</p>
       </div>}
     </article>)}
   <p style={{fontSize:11,color:"#8b8894",marginTop:15}}>
     New endorsements close after a proposal's 14-day window; existing endorsements are not automatically deleted. Only authorized moderation and independently audited onchain controls can permit future issuance; no automated token launch is configured.
   </p>
 </section>;
}
