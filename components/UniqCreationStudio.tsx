"use client";

import {useCallback,useEffect,useState,type FormEvent} from "react";
import {ImagePlus,FileJson,ShieldCheck,Trash2,RefreshCw,Copy} from "lucide-react";
type Collection={id:string;name:string;description:string;imageURI:string;nativeAccount:string|null;
 factoryId:string|null;itemCount:number;createdAt:string};
type UniqItem={id:string;collectionId:string;name:string;description:string;imageURI:string;editionLimit:number};
type Preview={kind:string;manifest:string;sha256:string;byteLength:number;note:string};
type FactoryReview={factoryId:string;account:string;role:string;factoryStatus:number;
 mintedCount:number|null;eligibleForReview:boolean;reasons:string[];warning:string};
const inputStyle={display:"block",width:"100%",border:"1px solid #e2dfe9",borderRadius:9,
 padding:"10px 12px",marginTop:6,font:"inherit"};
const CID="ipfs://<pinned-CID>/artwork.png";

export function UniqCreationStudio({authenticated,onLogin,nativeAccount}:{
 authenticated:boolean;onLogin:()=>void;nativeAccount:string|null;
}){
 const [collections,setCollections]=useState<Collection[]>([]);
 const [items,setItems]=useState<UniqItem[]>([]);
 const [selected,setSelected]=useState("");
 const [collectionName,setCollectionName]=useState("");
 const [collectionDescription,setCollectionDescription]=useState("");
 const [collectionImage,setCollectionImage]=useState("");
 const [plannedAccount,setPlannedAccount]=useState("");
 const [factoryId,setFactoryId]=useState("");
 const [itemName,setItemName]=useState("");
 const [itemDescription,setItemDescription]=useState("");
 const [itemImage,setItemImage]=useState("");
 const [editionLimit,setEditionLimit]=useState("1");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [factoryReview,setFactoryReview]=useState<FactoryReview|null>(null);
 const [deleteId,setDeleteId]=useState<string|null>(null);
 const [deleteKind,setDeleteKind]=useState<"collection"|"item"|null>(null);
 const current=collections.find(c=>c.id===selected);
 const refresh=useCallback(async()=>{
  if(!authenticated){setCollections([]);setItems([]);setSelected("");setLoading(false);return;}
  setLoading(true);
  try{
   const response=await fetch("/api/uniq-drafts/collections",{cache:"no-store"});
   const body=await response.json() as {collections?:Collection[];error?:string};
   if(!response.ok)throw Error(body.error??"Uniq collections unavailable");
   setCollections(body.collections??[]);
   setSelected(old=>(body.collections??[]).some(c=>c.id===old)?old:(body.collections?.[0]?.id??""));
   setError("");
  }catch(e){setError(e instanceof Error?e.message:"Uniq collections unavailable");}
  finally{setLoading(false);}
 },[authenticated]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!selected){setItems([]);setPreview(null);setFactoryReview(null);return;}
  let active=true;
  async function load(){
   try{
    const response=await fetch("/api/uniq-drafts/items?collectionId="+encodeURIComponent(selected),{cache:"no-store"});
    const body=await response.json() as {items?:UniqItem[];error?:string};
    if(!response.ok)throw Error(body.error??"Uniq items unavailable");
    if(active)setItems(body.items??[]);
   }catch(e){if(active){setItems([]);setError(e instanceof Error?e.message:"Items unavailable");}}
  }
  void load();return()=>{active=false;};
 },[selected,collections]);

 async function createCollection(e:FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");setPreview(null);
  try{
   const response=await fetch("/api/uniq-drafts/collections",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({name:collectionName,description:collectionDescription,
      imageURI:collectionImage,nativeAccount:plannedAccount,factoryId})
   });
   const data=await response.json() as {draft?:{id:string};error?:string};
   if(!response.ok)throw Error(data.error??"Could not create collection draft");
   setCollectionName("");setCollectionDescription("");setCollectionImage("");setFactoryId("");
   setNotice("Collection metadata draft saved privately. No native factory was created or minted.");
   await refresh();
   if(data.draft?.id)setSelected(data.draft.id);
  }catch(err){setError(err instanceof Error?err.message:"Unable to create draft");}
  finally{setBusy(false);}
 }
 async function createItem(e:FormEvent){
  e.preventDefault();if(!selected)return;
  setBusy(true);setError("");setNotice("");setPreview(null);
  try{
   const response=await fetch("/api/uniq-drafts/items",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({collectionId:selected,name:itemName,description:itemDescription,
       imageURI:itemImage,editionLimit})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error??"Could not prepare Uniq");
   setItemName("");setItemDescription("");setItemImage("");setEditionLimit("1");
   setNotice("Uniq edition draft saved. Nothing has been uploaded or minted.");
   await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Unable to create Uniq draft");}
  finally{setBusy(false);}
 }
 async function readManifest(kind:"collection"|"uniq",id:string){
  setBusy(true);setError("");setPreview(null);
  try{
   const response=await fetch("/api/uniq-drafts/manifest?"+new URLSearchParams({kind,id}),{cache:"no-store"});
   const data=await response.json() as Preview&{error?:string};
   if(!response.ok)throw Error(data.error??"Metadata preview unavailable");
   setPreview(data);
  }catch(err){setError(err instanceof Error?err.message:"Metadata preview unavailable");}
  finally{setBusy(false);}
 }
 async function inspectFactory(){
  if(!current?.factoryId||!nativeAccount){setError("Connect a native wallet and choose a collection with a planned factory ID.");return;}
  setBusy(true);setError("");setFactoryReview(null);
  try{
   const response=await fetch("/api/uniqs/factory?"+new URLSearchParams({
     factoryId:current.factoryId,account:nativeAccount
   }),{cache:"no-store"});
   const data=await response.json() as FactoryReview&{error?:string};
   if(!response.ok)throw Error(data.error??"Factory verification unavailable");
   setFactoryReview(data);
  }catch(err){setError(err instanceof Error?err.message:"Factory verification unavailable");}
  finally{setBusy(false);}
 }
 async function removeDraft(){
  if(!deleteId||!deleteKind||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const path=deleteKind==="collection"?"collections":"items";
   const response=await fetch("/api/uniq-drafts/"+path+"?id="+encodeURIComponent(deleteId),{method:"DELETE"});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw Error(data.error??"Cannot remove draft");
   setDeleteId(null);setDeleteKind(null);setPreview(null);
   setNotice("Private draft removed. No native tokens were burned or altered.");
   await refresh();
  }catch(err){setError(err instanceof Error?err.message:"Could not remove draft");}
  finally{setBusy(false);}
 }
 return <section id="uniq-creation-studio" aria-label="Private Uniq creator studio"
   style={{border:"1px solid #e4e1ef",borderRadius:16,padding:22,margin:"25px 0",background:"#fcfbff"}}>
   <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
     <ImagePlus size={22}/><h2 style={{fontSize:20,margin:0}}>Uniq Creator Studio</h2>
     <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#786196"}}>M14 · METADATA DRAFTS</span>
   </div>
   <p style={{fontSize:12,lineHeight:1.6,color:"#777",margin:"12px 0 18px"}}>
     Prepare a collection and individually described Uniq editions for <strong>Ultra native testnet</strong>.
     These are private drafts stored under your Looke EVM login; this does not verify ownership of a separate native Ultra account.
     You must pin metadata independently before any future authorized factory action.
   </p>
   {!authenticated?<div><p style={{fontSize:12}}>Sign in to Looke with your EVM wallet to save private collection and Uniq drafts.</p>
     <button className="subtle-cta" type="button" onClick={onLogin}>Sign in to prepare drafts</button>
   </div>:<>
    <form onSubmit={e=>void createCollection(e)} style={{display:"grid",gap:11,padding:15,border:"1px solid #eae8f1",borderRadius:12,background:"#fff"}}>
     <strong style={{fontSize:14}}>Prepare a collection ({collections.length}/8)</strong>
     <label style={{fontSize:12,fontWeight:700}}>Collection name
       <input required minLength={2} maxLength={80} value={collectionName} onChange={e=>setCollectionName(e.target.value)}
         style={inputStyle} placeholder="Original Ultra collection"/></label>
     <label style={{fontSize:12,fontWeight:700}}>Description
       <textarea required maxLength={1000} value={collectionDescription} onChange={e=>setCollectionDescription(e.target.value)}
         style={inputStyle} rows={2}/></label>
     <label style={{fontSize:12,fontWeight:700}}>Pinned artwork IPFS URI
       <input required maxLength={256} value={collectionImage} onChange={e=>setCollectionImage(e.target.value)}
         style={inputStyle} placeholder={CID}/></label>
     <label style={{fontSize:12,fontWeight:700}}>Planned native Ultra testnet account (optional, not verified)
       <input maxLength={12} value={plannedAccount} onChange={e=>setPlannedAccount(e.target.value)}
         style={inputStyle} placeholder={nativeAccount??"nativeaccount"}/></label>
     <label style={{fontSize:12,fontWeight:700}}>Existing Uniq factory ID (optional, no factory created here)
       <input maxLength={20} inputMode="numeric" value={factoryId} onChange={e=>setFactoryId(e.target.value)}
         style={inputStyle} placeholder="Native testnet factory number"/></label>
     <button type="submit" className="primary-button" disabled={busy||loading}>Save collection draft — no mint</button>
    </form>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:22}}>
     <strong style={{fontSize:14}}>Your private collection drafts</strong>
     <button type="button" className="subtle-cta" disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button>
    </div>
    {!collections.length?<p style={{fontSize:12,color:"#888",marginTop:9}}>No collections drafted yet.</p>:
     <label style={{display:"block",fontSize:12,marginTop:10,fontWeight:700}}>Selected collection
       <select style={inputStyle} value={selected} onChange={e=>{setSelected(e.target.value);setPreview(null);setFactoryReview(null);}}>
        {collections.map(c=><option key={c.id} value={c.id}>{c.name} · {c.itemCount} Uniq drafts</option>)}
       </select>
     </label>}
    {current&&<>
      <div style={{padding:13,background:"#f4f2fa",borderRadius:10,fontSize:12,marginTop:13}}>
       <strong>{current.name}</strong>
       <p style={{margin:"6px 0",overflowWrap:"anywhere"}}>{current.description}</p>
       <p style={{fontSize:11,color:"#777",overflowWrap:"anywhere"}}>
         Media: {current.imageURI}. Planned native account: {current.nativeAccount??"not specified"}.
         Factory ID: {current.factoryId??"unassigned"}.
       </p>
       <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        <button className="subtle-cta" disabled={busy} type="button" onClick={()=>void readManifest("collection",current.id)}>
          <FileJson size={14}/> Review collection JSON/hash
        </button>
        <button className="subtle-cta" disabled={busy||!current.factoryId||!nativeAccount} type="button"
          onClick={()=>void inspectFactory()}><ShieldCheck size={14}/> Read native factory status</button>
        <button className="subtle-cta" type="button" onClick={()=>{setDeleteId(current.id);setDeleteKind("collection");}}>
          <Trash2 size={14}/> Remove draft
        </button>
       </div>
      </div>
      <form onSubmit={e=>void createItem(e)} style={{display:"grid",gap:11,padding:15,marginTop:17,border:"1px solid #eae8f1",borderRadius:12,background:"#fff"}}>
       <strong style={{fontSize:14}}>Add an original Uniq edition ({items.length}/50)</strong>
       <label style={{fontSize:12,fontWeight:700}}>Uniq title
         <input required minLength={2} maxLength={80} style={inputStyle} value={itemName}
           onChange={e=>setItemName(e.target.value)}/></label>
       <label style={{fontSize:12,fontWeight:700}}>Description
         <textarea required rows={2} maxLength={1000} style={inputStyle} value={itemDescription}
           onChange={e=>setItemDescription(e.target.value)}/></label>
       <label style={{fontSize:12,fontWeight:700}}>Pinned media URI (IPFS)
         <input required maxLength={256} style={inputStyle} placeholder={CID} value={itemImage}
           onChange={e=>setItemImage(e.target.value)}/></label>
       <label style={{fontSize:12,fontWeight:700}}>Planned maximum editions (1–100,000)
         <input required inputMode="numeric" pattern="[1-9][0-9]*" style={inputStyle} value={editionLimit}
           onChange={e=>setEditionLimit(e.target.value)}/></label>
       <button className="subtle-cta" disabled={busy} type="submit">Save private Uniq metadata — no mint</button>
      </form>
      <div style={{display:"grid",gap:10,marginTop:14}}>
       {items.map(item=><article key={item.id} style={{padding:12,border:"1px solid #eae7f0",borderRadius:10,background:"#fff"}}>
        <strong style={{fontSize:13}}>{item.name}</strong>
        <p style={{fontSize:12,color:"#888",margin:"7px 0"}}>Planned editions: {item.editionLimit} · Metadata not pinned or issued</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
         <button type="button" className="subtle-cta" disabled={busy} onClick={()=>void readManifest("uniq",item.id)}>
           <FileJson size={14}/> Review JSON/hash</button>
         <button type="button" className="subtle-cta" onClick={()=>{setDeleteId(item.id);setDeleteKind("item");}}>
           <Trash2 size={14}/> Remove</button>
        </div>
       </article>)}
      </div>
    </>}
    {factoryReview&&<div role="status" style={{padding:13,background:"#f1f3fa",borderRadius:10,marginTop:16,fontSize:12}}>
     <strong>Native factory read — {factoryReview.eligibleForReview?"eligible for controlled review":"not eligible to sign"}</strong>
     <p>Factory {factoryReview.factoryId} · Role {factoryReview.role} · Status {factoryReview.factoryStatus}</p>
     <p>Current minted total: {factoryReview.mintedCount??"unknown"}. This lookup does not verify native wallet control or approve issuance.</p>
     {!!factoryReview.reasons.length&&<p style={{color:"#a94560"}}>{factoryReview.reasons.join("; ")}</p>}
    </div>}
    {preview&&<div role="status" style={{padding:13,marginTop:16,borderRadius:10,background:"#f2f1f8",fontSize:12}}>
     <strong>Exact {preview.kind} metadata preview</strong>
     <p style={{overflowWrap:"anywhere",fontSize:11}}>SHA-256: {preview.sha256} · {preview.byteLength} UTF-8 bytes</p>
     <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11,margin:"10px 0"}}>{preview.manifest}</pre>
     <button className="subtle-cta" type="button" onClick={()=>void navigator.clipboard.writeText(preview.manifest)
       .then(()=>setNotice("Manifest copied. Pin and verify it independently before any authorized NFT action."))
       .catch(()=>setError("Could not copy manifest."))}><Copy size={14}/> Copy manifest JSON</button>
     <p style={{fontSize:11,color:"#99677b",margin:"10px 0 0"}}>{preview.note}</p>
    </div>}
    {deleteId&&<div role="alertdialog" aria-label="Confirm draft deletion" style={{marginTop:12,padding:13,border:"1px solid #e0cad4",borderRadius:10}}>
     <strong style={{fontSize:12}}>Remove this private {deleteKind} draft?</strong>
     <p style={{fontSize:11}}>Associated item drafts are deleted when removing the collection. This never changes native chain assets.</p>
     <div style={{display:"flex",gap:10}}>
      <button className="subtle-cta" type="button" disabled={busy} onClick={()=>void removeDraft()}>Confirm removal</button>
      <button className="subtle-cta" type="button" onClick={()=>{setDeleteId(null);setDeleteKind(null);}}>Cancel</button>
     </div>
    </div>}
   </>}
   {loading&&<p role="status" style={{fontSize:12}}>Loading Uniq drafts…</p>}
   {error&&<p role="alert" style={{fontSize:12,color:"#b52b48",marginTop:12}}>{error}</p>}
   {notice&&<p role="status" style={{fontSize:12,color:"#256b50",marginTop:12}}>{notice}</p>}
   <p style={{fontSize:11,color:"#8b8292",lineHeight:1.5,marginTop:16}}>
     Draft collection metadata is Looke's own offchain format, not an Ultra-issued factory.
     Ultra native NFT contract permissions and costs must be checked separately.
   </p>
 </section>;
}
