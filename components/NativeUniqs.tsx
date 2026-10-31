"use client";
import { useEffect, useState } from "react";
import { Image as ImageIcon, ExternalLink } from "lucide-react";
type UniqRow={id:string;owner:string;serialNumber:string|number;type?:string;metadata?:{content?:{name?:string;description?:string}};resale?:{price?:{amount:string;currency?:{symbol?:string}}}};
export function NativeUniqs({account}:{account:string|null}){
 const [rows,setRows]=useState<UniqRow[]>([]);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!account){setRows([]);setMessage("");return;}
  let cancelled=false;setBusy(true);setMessage("");
  fetch("/api/uniqs?wallet="+encodeURIComponent(account),{cache:"no-store"}).then(async r=>{
    const data=await r.json();
    if(!r.ok)throw Error(data.error||"Uniqs unavailable");
    if(!cancelled){setRows(data.uniqs||[]);setMessage(data.network==="testnet"?"Native Ultra testnet holdings":"Native Ultra mainnet holdings");}
  }).catch((e)=>{if(!cancelled)setMessage(e instanceof Error?e.message:"Cannot load Uniqs");}).finally(()=>{if(!cancelled)setBusy(false);});
  return()=>{cancelled=true;};
 },[account]);
 return <section style={{margin:"30px 0",border:"1px solid #e6e6e6",padding:20,borderRadius:16}}>
   <h2 style={{fontSize:20,marginBottom:8}}>Your native Ultra Uniqs</h2>
   {!account?<p style={{opacity:.7,fontSize:13}}>Connect a native Ultra testnet wallet to view verified Uniq ownership. Sample collections below are illustrative.</p>
   :<><p style={{opacity:.7,fontSize:13}}>{busy?"Loading Uniqs...":message}</p><p style={{fontSize:12,overflowWrap:"anywhere"}}>Account: {account}</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:14}}>
     {rows.map(row=><div key={String(row.id)} style={{border:"1px solid #eee",padding:15,borderRadius:10}}>
        <ImageIcon size={22}/><h3 style={{fontSize:15,margin:"10px 0 4px"}}>{row.metadata?.content?.name||"Uniq #"+row.id}</h3>
        <p style={{fontSize:12}}>Uniq ID: {row.id} · {row.type||"Collectible"}</p>
        {row.resale?.price&&<p style={{fontSize:12}}>Resale: {row.resale.price.amount} {row.resale.price.currency?.symbol||""}</p>}
     </div>)}
   </div></>}
   <a href="https://developers.ultra.io/products/nft-api/introduction" target="_blank" rel="noreferrer" style={{fontSize:12,display:"inline-flex",gap:6,alignItems:"center",marginTop:12}}>About Ultra's native Uniq API <ExternalLink size={13}/></a>
 </section>;
}
