"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {Coins,ShieldCheck,RefreshCw,FileWarning,Trash2} from "lucide-react";

type DraftRow={name:string;symbol:string;supply_tokens:string;metadata_uri:string;updated_at:string};
type CreatorInfo={handle:string|null;address:string};
type Preview={name:string;symbol:string;supplyTokens:number;chainId:number;creatorAddress:string;metadataURI:string};
type ChainCheck={status:string;factoryAddress:string|null;existingCreatorCoin:string|null;audited:boolean;issuanceEnabled:boolean;warning:string};
type Readiness={preview:Preview;check:ChainCheck};
const DEFAULT_SUPPLY="1000000";

/** This component only manages a private draft and read-only network checks. */
export function CreatorCoinLab({authenticated,onRequireLogin,connectedWalletAddress}:{
 authenticated:boolean;onRequireLogin:()=>void;connectedWalletAddress:string|null;
}){
 const [creator,setCreator]=useState<CreatorInfo|null>(null);
 const [name,setName]=useState("");
 const [symbol,setSymbol]=useState("");
 const [supply,setSupply]=useState(DEFAULT_SUPPLY);
 const [metadata,setMetadata]=useState("");
 const [saved,setSaved]=useState<DraftRow|null>(null);
 const [readiness,setReadiness]=useState<Readiness|null>(null);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [confirmDelete,setConfirmDelete]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");

 const refresh=useCallback(async()=>{
   if(!authenticated){setSaved(null);setCreator(null);setReadiness(null);return;}
   setLoading(true);setError("");
   try{
     const response=await fetch("/api/creator-coins/draft",{cache:"no-store"});
     const data=await response.json() as {creator?:CreatorInfo;draft?:DraftRow|null;error?:string};
     if(!response.ok)throw new Error(data.error||"Creator draft unavailable");
     setCreator(data.creator??null);setSaved(data.draft??null);
     setName(data.draft?.name??"");setSymbol(data.draft?.symbol??"");
     setSupply(data.draft?.supply_tokens??DEFAULT_SUPPLY);setMetadata(data.draft?.metadata_uri??"");
     setReadiness(null);
   }catch(e){setError(e instanceof Error?e.message:"Creator draft unavailable");}
   finally{setLoading(false);}
 },[authenticated]);
 useEffect(()=>{void refresh();},[refresh]);

 async function save(event:FormEvent<HTMLFormElement>){
   event.preventDefault();if(saving||loading||!authenticated)return;
   setSaving(true);setError("");setNotice("");setReadiness(null);
   try{
     const response=await fetch("/api/creator-coins/draft",{
       method:"PUT",headers:{"content-type":"application/json"},
       body:JSON.stringify({name,symbol,supplyTokens:supply,metadataURI:metadata}),
     });
     const data=await response.json() as {draft?:DraftRow;error?:string};
     if(!response.ok)throw new Error(data.error||"Cannot save coin draft");
     setSaved(data.draft??null);
     setNotice("Private creator coin draft saved. No token minted; no wallet signature requested.");
   }catch(e){setError(e instanceof Error?e.message:"Could not save draft");}
   finally{setSaving(false);}
 }
 async function runPreflight(){
   if(!saved||loading)return;
   setLoading(true);setError("");setReadiness(null);
   try{
     const response=await fetch("/api/creator-coins/preflight",{cache:"no-store"});
     const data=await response.json() as Readiness&{error?:string};
     if(!response.ok)throw new Error(data.error||"Cannot review creator coin");
     setReadiness(data);
   }catch(e){setError(e instanceof Error?e.message:"Preflight unavailable");}
   finally{setLoading(false);}
 }
 async function deleteDraft(){
   if(!confirmDelete||saving)return;
   setSaving(true);setError("");
   try{
     const response=await fetch("/api/creator-coins/draft",{method:"DELETE"});
     const data=await response.json() as {error?:string};
     if(!response.ok)throw new Error(data.error||"Could not delete draft");
     setSaved(null);setReadiness(null);setName("");setSymbol("");setMetadata("");
     setSupply(DEFAULT_SUPPLY);setConfirmDelete(false);
     setNotice("Private draft deleted; no blockchain transaction occurred.");
   }catch(e){setError(e instanceof Error?e.message:"Could not delete draft");}
   finally{setSaving(false);}
 }
 const walletMatches=!!connectedWalletAddress && creator?.address?.toLowerCase()===connectedWalletAddress.toLowerCase();
 return <section aria-label="Creator coin launch preparation" style={{margin:"28px 0",padding:23,border:"1px solid #e8e5f1",borderRadius:16,background:"#fcfbfe"}}>
   <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
     <Coins size={23}/><h2 style={{fontSize:20,margin:0}}>Creator coin — launch preparation</h2>
     <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#6b558c"}}>M9 · DRAFT ONLY</span>
   </div>
   <p style={{fontSize:12,lineHeight:1.6,color:"#726e7d",marginTop:12}}>
     Specify your fixed-supply Ultra EVM creator token and review its testnet configuration.
     This lab <strong>cannot issue tokens, move funds, create liquidity or ask for wallet signatures</strong>.
   </p>
   {!authenticated?<div style={{marginTop:16}}>
     <p style={{fontSize:13,color:"#777"}}>Sign in to your Looke creator account to manage a private coin draft.</p>
     <button type="button" className="subtle-cta" onClick={onRequireLogin}>Sign in with Ultra EVM</button>
   </div>:<>
     {creator && <div style={{fontSize:12,padding:12,borderRadius:10,background:"#f4f1fb",marginBottom:17}}>
       <strong>Creator identity</strong>
       <div style={{marginTop:4,overflowWrap:"anywhere"}}>{creator.handle?"@"+creator.handle:"No public handle yet"} · {creator.address}</div>
       <div style={{color:walletMatches?"#236e4a":"#8b687b",marginTop:6}}>
         {walletMatches?"Connected EVM wallet matches the signed-in account.":
          "The connected EVM wallet is absent or differs from this session; reverify before any future launch."}
       </div>
       {!creator.handle&&<a href="/#profile" style={{textDecoration:"underline",fontWeight:700}}>Save a creator handle first</a>}
     </div>}
     <form onSubmit={e=>void save(e)} style={{display:"grid",gap:13}}>
       <label style={{fontSize:12,fontWeight:700}}>Coin name
         <input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)}
           placeholder="Your creator coin name" style={{display:"block",width:"100%",marginTop:7,padding:12,border:"1px solid #dedce7",borderRadius:9}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Symbol (2–12 uppercase characters)
         <input required minLength={2} maxLength={12} pattern="[A-Z0-9]{2,12}" value={symbol} onChange={e=>setSymbol(e.target.value)}
           placeholder="CREATOR" style={{display:"block",width:"100%",marginTop:7,padding:12,border:"1px solid #dedce7",borderRadius:9}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Fixed token supply (whole tokens, maximum 1 billion)
         <input required inputMode="numeric" pattern="[1-9][0-9]*" value={supply} onChange={e=>setSupply(e.target.value)}
           style={{display:"block",width:"100%",marginTop:7,padding:12,border:"1px solid #dedce7",borderRadius:9}}/>
       </label>
       <label style={{fontSize:12,fontWeight:700}}>Pinned IPFS metadata URI
         <input required maxLength={256} value={metadata} onChange={e=>setMetadata(e.target.value)}
           placeholder="ipfs://CID/metadata.json" style={{display:"block",width:"100%",marginTop:7,padding:12,border:"1px solid #dedce7",borderRadius:9}}/>
         <small style={{fontSize:11,display:"block",marginTop:6,color:"#8a8292"}}>
           Provide a pinned CID. Looke does not upload or independently authenticate offchain metadata.
         </small>
       </label>
       <button className="primary-button" disabled={saving||loading||!creator?.handle} type="submit">
         {saving?"Saving…":"Save private launch draft"}
       </button>
     </form>
     {saved&&<div style={{padding:15,marginTop:18,border:"1px solid #e7e4ef",borderRadius:12,background:"#fff"}}>
       <div style={{display:"flex",alignItems:"center",gap:8}}><ShieldCheck size={18}/><strong style={{fontSize:13}}>Saved draft — not deployed</strong></div>
       <p style={{fontSize:12,margin:"10px 0",overflowWrap:"anywhere"}}>
         {saved.name} ({"$"+saved.symbol}), {Number(saved.supply_tokens).toLocaleString()} fixed tokens
       </p>
       <p style={{fontSize:11,color:"#888",overflowWrap:"anywhere"}}>Metadata: {saved.metadata_uri}</p>
       <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
         <button type="button" className="subtle-cta" disabled={loading} onClick={()=>void runPreflight()}><RefreshCw size={15}/> Read-only testnet check</button>
         {!confirmDelete?<button type="button" className="subtle-cta" onClick={()=>setConfirmDelete(true)}><Trash2 size={15}/> Delete draft</button>:
           <span style={{display:"inline-flex",gap:8,alignItems:"center",fontSize:12,flexWrap:"wrap"}}>
             Delete private draft?
             <button type="button" disabled={saving} onClick={()=>void deleteDraft()} style={{fontWeight:700,color:"#a52d4f"}}>Confirm</button>
             <button type="button" onClick={()=>setConfirmDelete(false)}>Cancel</button>
           </span>}
       </div>
     </div>}
     {readiness&&<div role="status" style={{marginTop:15,borderTop:"1px solid #ddd8e6",paddingTop:16}}>
       <strong style={{fontSize:13}}>Testnet-readiness read</strong>
       <p style={{fontSize:12,marginTop:9}}>Chain: {readiness.preview.chainId}. Factory: <strong>{readiness.check.status.replaceAll("_"," ")}</strong>.</p>
       <p style={{fontSize:12,overflowWrap:"anywhere"}}>Configured address: {readiness.check.factoryAddress||"None"}</p>
       <p style={{fontSize:12,overflowWrap:"anywhere"}}>Existing testnet creator coin: {readiness.check.existingCreatorCoin||"Not confirmed"}</p>
       <p style={{fontSize:11,color:"#8a5669"}}><FileWarning size={14} style={{display:"inline",verticalAlign:"middle"}}/> Audit unverified. Issuance disabled. No liquidity, price or creator revenue implied.</p>
       {readiness.check.existingCreatorCoin&&<a target="_blank" rel="noreferrer" style={{fontSize:12,textDecoration:"underline"}}
         href={"https://evmexplorer.testnet.ultra.io/address/"+readiness.check.existingCreatorCoin}>Inspect testnet address</a>}
     </div>}
   </>}
   {loading&&<p role="status" style={{fontSize:12,color:"#777",marginTop:10}}>Checking private draft and testnet…</p>}
   {error&&<p role="alert" style={{fontSize:12,color:"#b42546",marginTop:13}}>{error}</p>}
   {notice&&<p role="status" style={{fontSize:12,color:"#286e4e",marginTop:13}}>{notice}</p>}
 </section>;
}
