"use client";

import { useCallback,useEffect,useState,type FormEvent } from "react";
import { FileText, ShieldCheck, RefreshCw, Trash2, ArrowUpRight, AlertTriangle } from "lucide-react";

type Creator={handle:string|null;address:string};
type Post={id:string;text:string;createdAt:string;editedAt:string|null};
type Draft={
 postId:string;name:string;symbol:string;supplyTokens:string;metadataURI:string;
 contentRef:string;sourceTextHash:string;refVersion:string;sourceCurrent:boolean;
 status:"valid_offchain_snapshot"|"stale_or_hidden_source";
};
type Readiness={
 preview:{postId:string;contentRef:string;sourceCurrent:boolean;chainId:number;kind:number;issuanceEnabled:boolean};
 check:{status:string;factoryAddress?:string|null;existingCoin?:string|null;audited:boolean};
 warning:string;
};
type Workspace={creator:Creator;posts:Post[];drafts:Draft[];error?:string};

export function ContentCoinLab({authenticated,onRequireLogin}:{
 authenticated:boolean;onRequireLogin:()=>void;
}){
 const [posts,setPosts]=useState<Post[]>([]);
 const [drafts,setDrafts]=useState<Draft[]>([]);
 const [creator,setCreator]=useState<Creator|null>(null);
 const [selected,setSelected]=useState("");
 const [name,setName]=useState("");
 const [symbol,setSymbol]=useState("");
 const [supply,setSupply]=useState("1000000");
 const [metadata,setMetadata]=useState("");
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [confirmRemove,setConfirmRemove]=useState<string|null>(null);
 const [reviewed,setReviewed]=useState<{postId:string;data:Readiness}|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");

 const refresh=useCallback(async()=>{
  if(!authenticated){
   setPosts([]);setDrafts([]);setCreator(null);setReviewed(null);setSelected("");
   return;
  }
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/content-coins/drafts",{cache:"no-store"});
   const data=await response.json() as Workspace;
   if(!response.ok)throw new Error(data.error||"Content draft service unavailable");
   setPosts(data.posts);setDrafts(data.drafts);setCreator(data.creator);
   setReviewed(null);
   const requested=new URLSearchParams(window.location.search).get("contentPost");
   setSelected(previous=>{
     if(requested && data.posts.some(p=>p.id===requested))return requested;
     if(previous && data.posts.some(p=>p.id===previous))return previous;
     return data.posts[0]?.id??"";
   });
  }catch(e){setError(e instanceof Error?e.message:"Could not load content coin drafts");}
  finally{setLoading(false);}
 },[authenticated]);
 useEffect(()=>{void refresh();},[refresh]);

 function choosePost(postId:string){
  setSelected(postId);setReviewed(null);setError("");setNotice("");
  const existing=drafts.find(d=>d.postId===postId);
  setName(existing?.name??"");setSymbol(existing?.symbol??"");
  setSupply(existing?.supplyTokens??"1000000");
  setMetadata(existing?.metadataURI??"");
 }
 useEffect(()=>{
  if(!selected)return;
  const existing=drafts.find(d=>d.postId===selected);
  if(existing){
   setName(existing.name);setSymbol(existing.symbol);
   setSupply(existing.supplyTokens);setMetadata(existing.metadataURI);
  }
 },[selected,drafts]);

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selected||busy)return;
  setBusy(true);setError("");setNotice("");setReviewed(null);
  try{
   const response=await fetch("/api/content-coins/drafts",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({postId:selected,name,symbol,supplyTokens:supply,metadataURI:metadata})
   });
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||"Could not prepare content coin");
   setNotice("Post snapshot saved privately. No token, wallet signature, or liquidity has been created.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Cannot save content coin draft");}
  finally{setBusy(false);}
 }
 async function preflight(postId:string){
  setBusy(true);setError("");setReviewed(null);
  try{
   const response=await fetch("/api/content-coins/preflight?postId="+encodeURIComponent(postId),{cache:"no-store"});
   const data=await response.json() as Readiness&{error?:string};
   if(!response.ok && response.status!==409)throw new Error(data.error||"Content coin review unavailable");
   setReviewed({postId,data});
  }catch(e){setError(e instanceof Error?e.message:"Content coin review unavailable");}
  finally{setBusy(false);}
 }
 async function deleteDraft(postId:string){
  if(confirmRemove!==postId||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/content-coins/drafts?postId="+encodeURIComponent(postId),{method:"DELETE"});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw new Error(result.error||"Cannot delete proposal");
   setNotice("Private content coin proposal removed. No token was burned or transferred.");
   setConfirmRemove(null);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Cannot remove proposal");}
  finally{setBusy(false);}
 }
 const currentPost=posts.find(p=>p.id===selected);
 return <section aria-label="Content coin proposals" style={{margin:"28px 0",border:"1px solid #e3e5ef",borderRadius:16,padding:22,background:"#fbfcff"}}>
   <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
    <FileText size={22}/><h2 style={{fontSize:20,margin:0}}>Content coins</h2>
    <span style={{marginLeft:"auto",fontSize:11,color:"#725c91",fontWeight:700}}>M10 · PRIVATE PROPOSALS</span>
   </div>
   <p style={{fontSize:12,color:"#777",lineHeight:1.6,margin:"12px 0 18px"}}>
     Link a proposed fixed-supply token to a visible post you authored. Looke commits to the
     original text, post revision, and your EVM address. <strong>No tokens are minted or
     sold here.</strong> Content references are offchain proofs of a saved snapshot—not wallet signatures.
   </p>
   {!authenticated?<div>
     <p style={{fontSize:12,color:"#888"}}>Sign in with your Ultra EVM creator account to prepare content coin proposals.</p>
     <button className="subtle-cta" type="button" onClick={onRequireLogin}>Sign in</button>
   </div>:<>
     {creator&&!creator.handle&&<p role="status" style={{fontSize:12,color:"#945f43"}}>
       First choose a public creator handle in your Looke profile.
     </p>}
     <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
       <strong style={{fontSize:13}}>Your public posts · {posts.length} available</strong>
       <button type="button" className="subtle-cta" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button>
     </div>
     {posts.length===0?<p style={{fontSize:12,color:"#888",marginTop:14}}>
       No eligible published text posts yet. Create a post in the Feed first; hidden and deleted posts cannot be tokenized.
     </p>:<form onSubmit={e=>void save(e)} style={{display:"grid",gap:13,marginTop:14}}>
       <label style={{fontSize:12,fontWeight:700}}>
         Choose your own visible post
         <select value={selected} onChange={e=>choosePost(e.target.value)}
           style={{display:"block",width:"100%",padding:12,border:"1px solid #dddfec",borderRadius:8,marginTop:7}}>
           {posts.map(p=><option key={p.id} value={p.id}>
             {p.text.slice(0,65)} · {new Date(p.createdAt).toLocaleDateString()}
           </option>)}
         </select>
       </label>
       {currentPost&&<div style={{padding:12,borderRadius:10,background:"#f2f3fa"}}>
         <strong style={{fontSize:12}}>Post snapshot source</strong>
         <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12,lineHeight:1.5,margin:"8px 0"}}>{currentPost.text.slice(0,380)}{currentPost.text.length>380?"…":""}</p>
         <a href={"/?post="+encodeURIComponent(currentPost.id)+"#feed"} style={{fontSize:11,textDecoration:"underline"}}>
           Open original public post <ArrowUpRight size={12} style={{display:"inline"}}/>
         </a>
       </div>}
       <label style={{fontSize:12,fontWeight:700}}>Token name
         <input required maxLength={80} minLength={2} value={name} onChange={e=>setName(e.target.value)}
           placeholder="Creator post name" style={{display:"block",width:"100%",padding:11,border:"1px solid #ddd",borderRadius:8,marginTop:6}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Symbol (uppercase)
         <input required pattern="[A-Z0-9]{2,12}" maxLength={12} value={symbol} onChange={e=>setSymbol(e.target.value)}
           placeholder="POST" style={{display:"block",width:"100%",padding:11,border:"1px solid #ddd",borderRadius:8,marginTop:6}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Fixed supply (1–1,000,000,000 whole tokens)
         <input required inputMode="numeric" pattern="[1-9][0-9]*" value={supply} onChange={e=>setSupply(e.target.value)}
           style={{display:"block",width:"100%",padding:11,border:"1px solid #ddd",borderRadius:8,marginTop:6}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Pinned IPFS metadata URI
         <input required maxLength={256} value={metadata} onChange={e=>setMetadata(e.target.value)}
           placeholder="ipfs://CID/metadata.json" style={{display:"block",width:"100%",padding:11,border:"1px solid #ddd",borderRadius:8,marginTop:6}}/>
       </label>
       <button className="primary-button" disabled={busy||loading||!creator?.handle||!selected} type="submit">
         {busy?"Saving…":"Prepare private content coin draft"}
       </button>
     </form>}
     {drafts.length>0&&<div style={{marginTop:23,borderTop:"1px solid #e6e6ee",paddingTop:17}}>
       <h3 style={{fontSize:15,margin:"0 0 13px"}}>Saved proposals ({drafts.length}/20)</h3>
       {drafts.map(d=><div key={d.postId} style={{padding:13,marginTop:10,border:"1px solid #ebe9f2",borderRadius:10,background:"#fff"}}>
         <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap"}}>
           <strong style={{fontSize:13}}>{d.name} ({"$"+d.symbol})</strong>
           <span style={{fontSize:11,color:d.sourceCurrent?"#276548":"#aa3e4b"}}>
             {d.sourceCurrent?"Snapshot matches post":"Stale or hidden post"}
           </span>
         </div>
         <p style={{fontSize:11,color:"#89848f",overflowWrap:"anywhere",margin:"8px 0"}}>
           Source commitment: {d.contentRef}
         </p>
         <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
           <button type="button" className="subtle-cta" disabled={busy||loading} onClick={()=>void preflight(d.postId)}>
             <ShieldCheck size={14}/> Read-only preflight
           </button>
           {!confirmRemove||confirmRemove!==d.postId?
             <button type="button" className="subtle-cta" onClick={()=>setConfirmRemove(d.postId)}><Trash2 size={14}/> Remove draft</button>:
             <span style={{fontSize:12,display:"inline-flex",gap:8,alignItems:"center"}}>
               Remove this proposal?
               <button type="button" disabled={busy} onClick={()=>void deleteDraft(d.postId)} style={{color:"#b42b4b",fontWeight:700}}>Confirm</button>
               <button type="button" onClick={()=>setConfirmRemove(null)}>Cancel</button>
             </span>}
         </div>
         {reviewed?.postId===d.postId&&<div role="status" style={{marginTop:12,padding:12,borderRadius:9,background:"#f5f4fb"}}>
           <strong style={{fontSize:12}}>Factory read: {reviewed.data.check.status.replaceAll("_"," ")}</strong>
           <p style={{fontSize:12,overflowWrap:"anywhere"}}>Chain {reviewed.data.preview.chainId} · Factory {reviewed.data.check.factoryAddress||"not configured"}</p>
           <p style={{fontSize:12,overflowWrap:"anywhere"}}>Existing mapping: {reviewed.data.check.existingCoin||"none verified"}</p>
           <p style={{fontSize:11,color:"#895879"}}><AlertTriangle size={14} style={{display:"inline",verticalAlign:"middle"}}/> {reviewed.data.warning}</p>
         </div>}
       </div>)}
     </div>}
   </>}
   {loading&&<p role="status" style={{fontSize:12,color:"#888",marginTop:11}}>Checking your posts and drafts…</p>}
   {error&&<p role="alert" style={{fontSize:12,color:"#b52b4c",marginTop:11}}>{error}</p>}
   {notice&&<p role="status" style={{fontSize:12,color:"#287556",marginTop:11}}>{notice}</p>}
 </section>;
}
