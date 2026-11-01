"use client";
import {useEffect,useState,type FormEvent} from "react";
import {Coins,RefreshCw,ShieldAlert,ReceiptText,Trash2,Calculator,ExternalLink} from "lucide-react";
type Allocation={kind:string;receiver:string;basisPoint:number;rawUos:string};
type Projection={
 factoryId:string;tokenId:string;listingSeller:string;
 projectedDistribution:{listedPrice:string;totalRawUos:string;
 allocations:Allocation[];warning:string;earningsCredited:false};
 previewForAccount:{account:string;rawUos:string;allocations:Allocation[];
 nativeWalletControlVerified:false};
 promoterAssumption:string;nonAtomicSnapshot:true;actualSaleVerified:false;
 earningsCredited:false;payoutsVerified:false;error?:string;reason?:string;
};
type RecordRow={
 id:string;nativeAccount:string;txId:string;factoryId:string|null;
 kind:"resale_royalty"|"resale_seller_proceeds"|"other_creator_transfer";
 status:"unverified";submittedAt:string;
};
type EvidenceList={evidence:RecordRow[];creditedEarningsRawUos:null;
 realizedEarningsVerified:false;warning:string;error?:string};
const field={display:"block",width:"100%",padding:"11px 12px",marginTop:6,
 borderRadius:9,border:"1px solid #dfdce8",font:"inherit"};
function formatUos(raw:string) {
 try{
  const text=BigInt(raw);
  const fraction=(text%100000000n).toString().padStart(8,"0");
  return (text/100000000n).toString()+"."+fraction+" UOS";
 }catch{return "unavailable";}
}
/** Read-only native royalty policy plus an offchain private reconciliation queue. */
export function CreatorEarnings({authenticated,onLogin,nativeAccount}:{
 authenticated:boolean;onLogin:()=>void;nativeAccount:string|null;
}){
 const [account,setAccount]=useState(nativeAccount??"");
 const [factoryId,setFactoryId]=useState("");
 const [tokenId,setTokenId]=useState("");
 const [projection,setProjection]=useState<Projection|null>(null);
 const [rows,setRows]=useState<RecordRow[]>([]);
 const [txId,setTxId]=useState("");
 const [evidenceKind,setEvidenceKind]=useState<RecordRow["kind"]>("resale_royalty");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [note,setNote]=useState("");
 const [removing,setRemoving]=useState<string|null>(null);
 useEffect(()=>{if(nativeAccount)setAccount(nativeAccount);},[nativeAccount]);
 useEffect(()=>{setProjection(null);},[factoryId,tokenId,account]);
 async function refresh(){
  if(!authenticated){setRows([]);return;}
  setLoading(true);
  try{
   const response=await fetch("/api/creator-earnings/evidence",{cache:"no-store"});
   const data=await response.json() as EvidenceList;
   if(!response.ok)throw Error(data.error??"Evidence inbox unavailable");
   setRows(data.evidence??[]);
  }catch(e){setRows([]);setError(e instanceof Error?e.message:"Evidence inbox unavailable");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[authenticated]);
 async function inspectPolicy(e:FormEvent){
  e.preventDefault();if(busy)return;
  setError("");setNote("");setProjection(null);setBusy(true);
  try{
   const query=new URLSearchParams({account,factoryId,tokenId});
   const response=await fetch("/api/creator-earnings/policy?"+query,{cache:"no-store"});
   const data=await response.json() as Projection&{error?:string;previewAvailable?:boolean;reason?:string};
   if(!response.ok)throw Error(data.error??"Native policy unavailable");
   if(data.previewAvailable===false) {
    setNote(data.reason??"No current resale record to preview.");return;
   }
   setProjection(data);
  }catch(e){setError(e instanceof Error?e.message:"Royalty policy read failed");}
  finally{setBusy(false);}
 }
 async function submitEvidence(e:FormEvent) {
  e.preventDefault();if(busy)return;
  if(!authenticated){onLogin();return;}
  setError("");setNote("");setBusy(true);
  try{
   const response=await fetch("/api/creator-earnings/evidence",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({nativeAccount:account,txId,kind:evidenceKind,factoryId})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error??"Evidence not saved");
   setTxId("");
   setNote("Submitted as UNVERIFIED. Nothing has been credited or paid.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Evidence submission failed");}
  finally{setBusy(false);}
 }
 async function removeEvidence(id:string){
  if(removing!==id||busy)return;
  setBusy(true);setError("");setNote("");
  try{
   const res=await fetch("/api/creator-earnings/evidence?id="+encodeURIComponent(id),{method:"DELETE"});
   const data=await res.json() as {error?:string};
   if(!res.ok)throw Error(data.error??"Could not remove entry");
   setRemoving(null);
   setNote("Unverified reference removed. No onchain asset was affected.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Deletion failed");}
  finally{setBusy(false);}
 }
 return <section aria-label="Native Ultra creator royalties and payout evidence" style={{
   border:"1px solid #e5e1ed",background:"#fbfaff",borderRadius:16,padding:20,margin:"26px 0"
 }}>
  <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
   <Coins size={23}/><h2 style={{fontSize:20,margin:0}}>Creator earnings review</h2>
   <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#7a688d"}}>M17 · NO PAYOUTS</span>
  </div>
  <p style={{fontSize:12,color:"#777",lineHeight:1.65,margin:"12px 0 18px"}}>
   Inspect the current Ultra native testnet resale-share policy for a listed Uniq
   and save private transaction references for later independent reconciliation.
   A potential royalty is <strong>not earned or paid income</strong>; no withdrawable
   balance is created.
  </p>
  <div style={{padding:14,borderRadius:11,background:"#f1eff8",fontSize:12,display:"flex",gap:16,flexWrap:"wrap"}}>
   <div><strong>Realized creator earnings:</strong> Not independently verified</div>
   <div><strong>Withdrawable balance:</strong> Unavailable</div>
   <div><strong>Automatic payouts:</strong> Disabled</div>
  </div>
  <form onSubmit={e=>void inspectPolicy(e)} style={{background:"#fff",border:"1px solid #e7e4ee",
    borderRadius:12,padding:15,marginTop:17,display:"grid",gap:10}}>
   <strong style={{fontSize:14}}><Calculator size={17} style={{display:"inline",verticalAlign:"middle"}}/> Native royalty policy preview</strong>
   <p style={{fontSize:11,color:"#777",margin:0}}>
    Based on a real currently listed Uniq, factory.b, global.share and second-hand promoter config.
    Uses exact integer UOS basis points but reads non-atomic snapshots.
   </p>
   <label style={{fontSize:12,fontWeight:700}}>Account to inspect (not ownership proof)
    <input style={field} required value={account} maxLength={12} onChange={e=>setAccount(e.target.value)} placeholder="creatoracct1"/>
   </label>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
    <label style={{fontSize:12,fontWeight:700}}>Existing native factory ID
     <input style={field} required value={factoryId} inputMode="numeric" onChange={e=>setFactoryId(e.target.value)}/></label>
    <label style={{fontSize:12,fontWeight:700}}>Listed native Uniq token ID
     <input style={field} required value={tokenId} inputMode="numeric" onChange={e=>setTokenId(e.target.value)}/></label>
   </div>
   <button type="submit" className="subtle-cta" disabled={busy}>
    <RefreshCw size={14}/> {busy?"Checking current policy…":"Read projected distribution — no settlement"}
   </button>
   {projection&&<div role="status" style={{padding:13,borderRadius:10,background:"#f4f2fa",fontSize:12}}>
    <strong>Listed price: {projection.projectedDistribution.listedPrice}</strong>
    <p style={{margin:"8px 0"}}>If this listing sold under this configuration, the selected account's
     hypothetical allocation would be <strong>{formatUos(projection.previewForAccount.rawUos)}</strong>.</p>
    <p style={{margin:"8px 0",color:"#8c6d82"}}>Not realized revenue. No payout receipts verified.</p>
    <div style={{display:"grid",gap:5}}>
     {projection.projectedDistribution.allocations.map((a,i)=><div key={i}
      style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"space-between",fontSize:11}}>
       <span>{a.kind.replaceAll("_"," ")} · {a.receiver} · {a.basisPoint} bps</span>
       <strong>{formatUos(a.rawUos)}</strong>
      </div>)}
    </div>
    <p style={{fontSize:11,margin:"10px 0 0",color:"#8c6780"}}>{projection.promoterAssumption}</p>
   </div>}
  </form>
  <form onSubmit={e=>void submitEvidence(e)} style={{
    background:"#fff",padding:15,marginTop:16,border:"1px solid #e7e4ee",
    borderRadius:12,display:"grid",gap:10
  }}>
   <strong style={{fontSize:14}}><ReceiptText size={17} style={{display:"inline",verticalAlign:"middle"}}/> Private payout evidence inbox</strong>
   <p style={{fontSize:11,color:"#777",margin:0}}>
    You may submit a native testnet transaction ID for future reconciliation. This is not
    verified onchain yet; the form cannot credit income or release funds.
   </p>
   <label style={{fontSize:12,fontWeight:700}}>Native testnet transaction hash (64 hex characters)
    <input style={field} required minLength={64} maxLength={64} value={txId}
      onChange={e=>setTxId(e.target.value)} placeholder="64-character transaction ID"/></label>
   <label style={{fontSize:12,fontWeight:700}}>Evidence category (self-reported)
    <select value={evidenceKind} style={field} onChange={e=>setEvidenceKind(e.target.value as RecordRow["kind"])}>
     <option value="resale_royalty">Factory resale royalty</option>
     <option value="resale_seller_proceeds">Seller proceeds</option>
     <option value="other_creator_transfer">Other creator transfer</option>
    </select>
   </label>
   <button type="submit" className="subtle-cta" disabled={busy||!authenticated}>
    Save unverified transaction reference
   </button>
   {!authenticated&&<button type="button" className="subtle-cta" onClick={onLogin}>Sign in to save private references</button>}
   {loading?<p role="status" style={{fontSize:12}}>Loading your private evidence…</p>:
    !rows.length?<p style={{fontSize:12,color:"#777"}}>No submitted transaction references.</p>:
    <div style={{display:"grid",gap:8}}>
     {rows.map(row=><article key={row.id} style={{padding:12,border:"1px solid #eeebf5",borderRadius:10}}>
      <strong style={{fontSize:12}}>Unverified · {row.kind.replaceAll("_"," ")}</strong>
      <p style={{overflowWrap:"anywhere",fontSize:11,color:"#777",margin:"7px 0"}}>
       Native account: {row.nativeAccount} · Factory: {row.factoryId??"unspecified"}
      </p>
      <p style={{overflowWrap:"anywhere",fontSize:11,margin:"7px 0"}}>{row.txId}</p>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
       <a href={"https://explorer.testnet.ultra.io/tx/"+row.txId}
         target="_blank" rel="noreferrer" style={{fontSize:11,display:"inline-flex",alignItems:"center",gap:4}}>
         Inspect native testnet explorer <ExternalLink size={12}/>
       </a>
       {removing===row.id?<span style={{fontSize:11,display:"inline-flex",gap:8,alignItems:"center"}}>
         Remove? <button type="button" disabled={busy} onClick={()=>void removeEvidence(row.id)}>Confirm</button>
         <button type="button" onClick={()=>setRemoving(null)}>Cancel</button>
        </span>:<button type="button" className="subtle-cta" onClick={()=>setRemoving(row.id)}>
         <Trash2 size={13}/> Remove reference
        </button>}
      </div>
     </article>)}
    </div>}
  </form>
  {error&&<p role="alert" style={{fontSize:12,color:"#a62b49",marginTop:12}}>{error}</p>}
  {note&&<p role="status" style={{fontSize:12,color:"#326d4a",marginTop:12}}>{note}</p>}
  <p style={{fontSize:11,color:"#8b687b",lineHeight:1.55,marginTop:15}}>
   <ShieldAlert size={14} style={{display:"inline",verticalAlign:"middle"}}/>
   Looke EVM sign-in does not prove native Ultra account ownership. A receipt reference can be fake,
   wrong-chain, unrelated or unpaid. Independent finalized native transaction traces and
   recipient-level transfer reconciliation are required before recognizing earnings.
  </p>
 </section>;
}
