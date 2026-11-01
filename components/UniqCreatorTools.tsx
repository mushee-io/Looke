"use client";
import {useEffect,useState,type FormEvent} from "react";
import {FileDown,RefreshCw,Save,ClipboardCheck,Layers3,ShieldAlert} from "lucide-react";

type Collection={
 id:string;revision:number;name:string;description:string;imageURI:string;
 nativeAccount:string|null;factoryId:string|null;itemCount:number;
};
type Edition={
 id:string;collectionId:string;revision:number;name:string;description:string;
 imageURI:string;editionLimit:number;
};
type Bundle={
 json:string;sha256:string;itemCount:number;totalPlannedEditions:string;
 pinningVerified:false;issuedTokens:0;error?:string;
};
const input={width:"100%",padding:11,borderRadius:9,border:"1px solid #e2dfed",marginTop:7,font:"inherit"};
const label={fontSize:12,fontWeight:700} as const;
/** Metadata editing is attached to Looke's authenticated EVM profile, NOT a native wallet. */
export function UniqCreatorTools({authenticated,onLogin}:{
 authenticated:boolean;onLogin:()=>void;
}){
 const [collections,setCollections]=useState<Collection[]>([]);
 const [selected,setSelected]=useState("");
 const [items,setItems]=useState<Edition[]>([]);
 const [selectedItem,setSelectedItem]=useState("");
 const [collectionForm,setCollectionForm]=useState({name:"",description:"",imageURI:"",
   nativeAccount:"",factoryId:""});
 const [itemForm,setItemForm]=useState({name:"",description:"",imageURI:"",editionLimit:"1"});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const [exportHash,setExportHash]=useState("");
 const [exportCount,setExportCount]=useState("");
 const [loading,setLoading]=useState(false);
 const collection=collections.find(c=>c.id===selected);
 const item=items.find(i=>i.id===selectedItem);
 async function loadCollections(){
  if(!authenticated){setCollections([]);setSelected("");setItems([]);return;}
  setLoading(true);
  try{
   const response=await fetch("/api/uniq-drafts/collections",{cache:"no-store"});
   const result=await response.json() as {collections?:Collection[];error?:string};
   if(!response.ok)throw new Error(result.error??"Cannot load collections");
   setCollections(result.collections??[]);
   setSelected(previous=>(result.collections??[]).some(c=>c.id===previous)
     ?previous:(result.collections?.[0]?.id??""));
  }catch(e){setError(e instanceof Error?e.message:"Collection tools unavailable");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void loadCollections();},[authenticated]);
 useEffect(()=>{
  if(!collection){setCollectionForm({name:"",description:"",imageURI:"",nativeAccount:"",factoryId:""});return;}
  setCollectionForm({name:collection.name,description:collection.description,
   imageURI:collection.imageURI,nativeAccount:collection.nativeAccount??"",
   factoryId:collection.factoryId??""});
  setExportHash("");setExportCount("");
 },[collection?.id,collection?.revision]);
 useEffect(()=>{
  if(!selected||!authenticated){setItems([]);setSelectedItem("");return;}
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch("/api/uniq-drafts/items?collectionId="+encodeURIComponent(selected),{cache:"no-store"});
    const data=await response.json() as {items?:Edition[];error?:string};
    if(!response.ok)throw new Error(data.error??"Cannot load Uniq editions");
    if(active){
     setItems(data.items??[]);
     setSelectedItem(prev=>(data.items??[]).some(x=>x.id===prev)?prev:(data.items?.[0]?.id??""));
    }
   }catch(e){if(active){setItems([]);setError(e instanceof Error?e.message:"Could not load edition drafts");}}
  };
  void load();
  return()=>{active=false;};
 },[selected,authenticated,collection?.revision]);
 useEffect(()=>{
  if(!item){setItemForm({name:"",description:"",imageURI:"",editionLimit:"1"});return;}
  setItemForm({name:item.name,description:item.description,imageURI:item.imageURI,
    editionLimit:String(item.editionLimit)});
 },[item?.id,item?.revision]);
 async function reload(){
  setError("");setSuccess("");await loadCollections();
  // For an unchanged collection revision, force a fresh item load as well.
  if(selected){
   try{
    const res=await fetch("/api/uniq-drafts/items?collectionId="+encodeURIComponent(selected),{cache:"no-store"});
    const data=await res.json() as {items?:Edition[];error?:string};
    if(!res.ok)throw new Error(data.error??"Items unavailable");
    setItems(data.items??[]);
   }catch(e){setError(e instanceof Error?e.message:"Item refresh failed");}
  }
 }
 async function editCollection(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!collection||busy)return;
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch("/api/uniq-drafts/collections/"+encodeURIComponent(collection.id),{
    method:"PATCH",headers:{"content-type":"application/json"},
    body:JSON.stringify({...collectionForm,expectedRevision:collection.revision})
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Could not save collection");
   setSuccess("Collection metadata updated. Native tokens and factory state were not changed.");
   await loadCollections();
  }catch(e){setError(e instanceof Error?e.message:"Collection edit failed");}
  finally{setBusy(false);}
 }
 async function editItem(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!item||busy)return;
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch("/api/uniq-drafts/items/"+encodeURIComponent(item.id),{
    method:"PATCH",headers:{"content-type":"application/json"},
    body:JSON.stringify({
     ...itemForm,collectionId:item.collectionId,expectedRevision:item.revision
    })
   });
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Could not save edition");
   setSuccess("Edition draft updated. Existing native NFT editions are unchanged.");
   const reread=await fetch("/api/uniq-drafts/items?collectionId="+encodeURIComponent(selected),{cache:"no-store"});
   const listing=await reread.json() as {items?:Edition[];error?:string};
   if(!reread.ok)throw new Error(listing.error??"Could not reload editions");
   setItems(listing.items??[]);
   setExportHash("");
  }catch(e){setError(e instanceof Error?e.message:"Edition edit failed");}
  finally{setBusy(false);}
 }
 async function exportMetadata(){
  if(!selected||busy)return;
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch("/api/uniq-drafts/export?collectionId="+encodeURIComponent(selected),{cache:"no-store"});
   const data=await response.json() as Bundle;
   if(!response.ok)throw new Error(data.error??"Cannot export private collection metadata");
   const payload=JSON.stringify({bundle:JSON.parse(data.json),sha256:data.sha256},null,2)+"\n";
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json"}));
   try{
    const link=document.createElement("a");
    link.href=url;link.download="looke-uniq-drafts-"+selected+".json";
    document.body.appendChild(link);link.click();link.remove();
   }finally{URL.revokeObjectURL(url);}
   setExportHash(data.sha256);
   setExportCount(data.totalPlannedEditions);
   setSuccess("Exported versioned offchain metadata. Files and media were not pinned or issued.");
  }catch(e){setError(e instanceof Error?e.message:"Export failed");}
  finally{setBusy(false);}
 }
 const plannedTotal=items.reduce((total,entry)=>total+entry.editionLimit,0);
 return <section aria-label="Uniq creator editing and metadata export tools"
    style={{margin:"25px 0",padding:20,borderRadius:16,border:"1px solid #e5e1ef",background:"#fbfaff"}}>
   <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
    <Layers3 size={22}/><h2 style={{fontSize:20,margin:0}}>Creator metadata tools</h2>
    <span style={{marginLeft:"auto",fontSize:11,color:"#75638a",fontWeight:700}}>M16 · PRIVATE DRAFTS</span>
   </div>
   <p style={{fontSize:12,lineHeight:1.6,color:"#777",margin:"12px 0 18px"}}>
    Revise saved collections and editions, inspect planned supply, and export a portable metadata bundle.
    All edits are offchain. Version checks prevent silent stale-tab overwrites.
    This is not a native Uniq factory or live NFT ownership manager.
   </p>
   {!authenticated?<button className="subtle-cta" type="button" onClick={onLogin}>Sign in to manage Uniq drafts</button>:<>
    <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
     <strong style={{fontSize:13}}>Collections: {collections.length}/8</strong>
     <button type="button" className="subtle-cta" disabled={busy||loading} onClick={()=>void reload()}>
      <RefreshCw size={14}/> Refresh and resolve version conflicts
     </button>
    </div>
    {collections.length===0?<p style={{fontSize:12,marginTop:12,color:"#777"}}>
      Create a collection in the Uniq Creator Studio above, then edit or export it here.
    </p>:<>
     <label style={{...label,display:"block",marginTop:15}}>Choose collection to edit
      <select style={input} value={selected} onChange={e=>{setSelected(e.target.value);setError("");}}>
       {collections.map(c=><option key={c.id} value={c.id}>{c.name} · revision {c.revision}</option>)}
      </select>
     </label>
     {collection&&<>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:12,margin:"12px 0",color:"#777"}}>
       <span>Collection revision: {collection.revision}</span>
       <span>Uniq designs: {items.length}/50</span>
       <span>Total planned editions: {plannedTotal.toLocaleString()}</span>
      </div>
      <form onSubmit={e=>void editCollection(e)} style={{display:"grid",gap:11,padding:16,borderRadius:12,background:"#fff",border:"1px solid #eeeaf3"}}>
       <strong style={{fontSize:14}}>Edit collection metadata</strong>
       <label style={label}>Name
        <input style={input} required value={collectionForm.name} maxLength={80}
         onChange={e=>setCollectionForm(f=>({...f,name:e.target.value}))}/></label>
       <label style={label}>Description
        <textarea style={input} required value={collectionForm.description} maxLength={1000} rows={2}
         onChange={e=>setCollectionForm(f=>({...f,description:e.target.value}))}/></label>
       <label style={label}>Pinned artwork URI (offchain reference)
        <input style={input} required value={collectionForm.imageURI} maxLength={256}
         onChange={e=>setCollectionForm(f=>({...f,imageURI:e.target.value}))}/></label>
       <label style={label}>Planned native account (not proof of ownership)
        <input style={input} value={collectionForm.nativeAccount} maxLength={12}
         onChange={e=>setCollectionForm(f=>({...f,nativeAccount:e.target.value}))}/></label>
       <label style={label}>Planned factory ID
        <input style={input} value={collectionForm.factoryId} maxLength={20}
         onChange={e=>setCollectionForm(f=>({...f,factoryId:e.target.value}))}/></label>
       <button className="subtle-cta" disabled={busy||loading} type="submit"><Save size={15}/> Save collection revision</button>
      </form>
      <div style={{marginTop:18}}>
       <strong style={{fontSize:14}}>Edit Uniq edition draft</strong>
       {!items.length?<p style={{fontSize:12,color:"#777"}}>No editions drafted in this collection yet.</p>:<>
        <label style={{...label,display:"block",marginTop:12}}>Select edition
         <select value={selectedItem} style={input} onChange={e=>{setSelectedItem(e.target.value);setError("");}}>
          {items.map(x=><option key={x.id} value={x.id}>{x.name} · revision {x.revision}</option>)}
         </select>
        </label>
        {item&&<form onSubmit={e=>void editItem(e)} style={{display:"grid",gap:11,padding:16,background:"#fff",border:"1px solid #eeeaf3",borderRadius:12,marginTop:11}}>
         <label style={label}>Uniq title
          <input style={input} required value={itemForm.name} maxLength={80}
           onChange={e=>setItemForm(f=>({...f,name:e.target.value}))}/></label>
         <label style={label}>Description
          <textarea style={input} required value={itemForm.description} maxLength={1000} rows={2}
           onChange={e=>setItemForm(f=>({...f,description:e.target.value}))}/></label>
         <label style={label}>Pinned media URI
          <input style={input} required value={itemForm.imageURI} maxLength={256}
           onChange={e=>setItemForm(f=>({...f,imageURI:e.target.value}))}/></label>
         <label style={label}>Maximum planned editions (1–100,000)
          <input style={input} required inputMode="numeric" value={itemForm.editionLimit}
           onChange={e=>setItemForm(f=>({...f,editionLimit:e.target.value}))}/></label>
         <button className="subtle-cta" disabled={busy||loading} type="submit"><Save size={15}/> Save edition revision</button>
        </form>}
       </>}
      </div>
      <div style={{marginTop:20,padding:15,background:"#f2eff9",borderRadius:11}}>
       <strong style={{fontSize:14}}>Portable collection metadata</strong>
       <p style={{fontSize:12,lineHeight:1.5}}>
        Export deterministic, versioned collection and edition JSON with SHA-256 fingerprints.
        No asset is uploaded or minted; the SHA-256 does not prove a real IPFS pin.
       </p>
       <button type="button" className="subtle-cta" disabled={busy||loading} onClick={()=>void exportMetadata()}>
        <FileDown size={15}/> Export collection metadata JSON
       </button>
       {exportHash&&<p role="status" style={{fontSize:11,overflowWrap:"anywhere",marginTop:10}}>
        <ClipboardCheck size={13} style={{display:"inline"}}/> Export checksum: {exportHash}. Planned editions: {exportCount}.
       </p>}
      </div>
     </>}
    </>}
   </>}
   {error&&<p role="alert" style={{fontSize:12,color:"#b12d4d",marginTop:12}}>{error}</p>}
   {success&&<p role="status" style={{fontSize:12,color:"#21764e",marginTop:12}}>{success}</p>}
   <p style={{fontSize:11,color:"#946d7c",lineHeight:1.5,marginTop:15}}>
    <ShieldAlert size={14} style={{display:"inline",verticalAlign:"middle"}}/>
    Changing a draft does not update existing native Uniq metadata, rights, royalties, supply, or ownership.
    Requires real factory authorization, signed testnet receipts, and independent metadata/provenance review.
   </p>
 </section>;
}
