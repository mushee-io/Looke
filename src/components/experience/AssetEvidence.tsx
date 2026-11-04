"use client";
import {useState} from "react";
import type {AssetProof} from "../../lib/experience/assets";
import {testnetAddressUrl} from "../../lib/ultra";

/** User-triggered, independent Testnet verification. Never equate an asset
 * mentioned in a post with ownership by its EVM author. */
export function AssetEvidence({kind,id}:{kind:"token"|"uniq";id:string}){
 const [nativeAccount,setNativeAccount]=useState("");
 const [proof,setProof]=useState<AssetProof|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function check(){
   setBusy(true);setError("");setProof(null);
   try{
     const params=new URLSearchParams({kind,id});
     if(kind==="uniq")params.set("account",nativeAccount);
     const r=await fetch("/api/experience/assets?"+params.toString(),{cache:"no-store"});
     const x=await r.json() as AssetProof&{error?:string};
     if(!r.ok)throw new Error(x.error||"Testnet verification is currently unavailable.");
     setProof(x);
   }catch(e){setError(e instanceof Error?e.message:"Asset evidence unavailable.");}
   finally{setBusy(false);}
 }
 return <div className="lk-m15-evidence">
   {kind==="uniq"&&<label>Native Ultra account to check
     <input type="text" maxLength={12} autoCapitalize="none" value={nativeAccount}
       onChange={e=>setNativeAccount(e.target.value)} placeholder="native account name"/></label>}
   <button type="button" onClick={()=>{void check();}} disabled={busy||(kind==="uniq"&&!nativeAccount.trim())}>
     {busy?"Checking on-chain evidence…":"Verify "+(kind==="uniq"?"Uniq holding":"creator token")+" ↗"}
   </button>
   {error&&<p role="status">{error}</p>}
   {proof&&<div className={proof.verified?"lk-m15-proof valid":"lk-m15-proof unavailable"}>
     <strong>{proof.verified?"Verified on Ultra Testnet":"Not independently verified"}</strong>
     <p>{proof.proof}</p>
     {proof.block&&<small>Observed on-chain reference: {proof.block}</small>}
     {proof.owner&&<small>Native account: {proof.owner} (not linked to an EVM wallet)</small>}
     {proof.kind==="token"&&proof.verified&&<a href={testnetAddressUrl(proof.id)}
       target="_blank" rel="noopener noreferrer">View contract ↗</a>}
   </div>}
 </div>;
}
export function ApprovedPostMedia({url,kind}:{url:string|null;kind:string|null}){
 if(!url||(kind!=="image"&&kind!=="video"))return null;
 let verified=false;
 try{const parsed=new URL(url);verified=parsed.protocol==="https:"&&!parsed.username&&!parsed.password;}
 catch{return null;}
 if(!verified)return null;
 return <figure className="lk-m15-media">
   {kind==="image"?<img src={url} alt="Approved creator post media" loading="lazy"/>:
     <video src={url} controls playsInline preload="none" aria-label="Approved creator video"/>}
   <figcaption>Approved external media · hosted by the creator&apos;s provider</figcaption>
 </figure>;
}
