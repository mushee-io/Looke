"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {Store,RefreshCw,ShieldCheck,AlertTriangle,Wallet,Search,ArrowRight,ArrowLeft} from "lucide-react";

type Listing={
 tokenId:string;owner:string;factoryId:string;serialNumber:string;
 promoterBasisPoints:number;price:{amount:string;currency:string;amountRaw:string;decimals:number};
 nativeOwnerCrosschecked:boolean;assetPriceVerified:boolean;transactionEnabled:false;
};
type Page={
 listings:Listing[];nextCursor:string|null;checkedAt:string;
 headBlock:string|null;lastIrreversibleBlock:string|null;
 rowsScanned:number;ownerNotConfirmed:number;
 source:string;nonAtomicReadWarning:string;error?:string;
};
type Review={
 intent:"buy"|"cancel"|"list";tokenId:string;account:string;
 checkedAt:string;expiresAt:string;proposedPrice:string|null;
 listing:Listing|null;review:{
  conditionsMet:boolean;reasons:string[];executionEnabled:false;
  nativeFactoryFound:boolean;factoryStatus:unknown;feeDisclosureComplete:boolean;
  lockupAndTradingWindowVerified:boolean;
 };
 blockers:string[];warning:string;error?:string;
};

const field={padding:10,width:"100%",border:"1px solid #e2dfec",borderRadius:9,font:"inherit"};
/**
 * A native Ultra chain read-only board. No fake prices, server keys, signing,
 * orders, token transfers, resell/cancel or buy actions in this component.
 */
export function NativeUniqMarketplace({account}:{account:string|null}){
 const [pageIndex,setPageIndex]=useState(0);
 const [cursors,setCursors]=useState<(string|null)[]>([null]);
 const [market,setMarket]=useState<Page|null>(null);
 const [busy,setBusy]=useState(false);
 const [reviewBusy,setReviewBusy]=useState(false);
 const [error,setError]=useState("");
 const [reviewError,setReviewError]=useState("");
 const [result,setResult]=useState<Review|null>(null);
 const [listToken,setListToken]=useState("");
 const [listPrice,setListPrice]=useState("");
 const cursor=cursors[pageIndex]??null;
 const refresh=useCallback(async()=>{
  setBusy(true);
  try{
   const query=cursor?("?cursor="+encodeURIComponent(cursor)):"";
   const response=await fetch("/api/uniqs/marketplace"+query,{cache:"no-store"});
   const data=await response.json() as Page;
   if(!response.ok)throw Error(data.error??"Native marketplace read unavailable");
   setMarket(data);setError("");
  }catch(e){
   setMarket(null);setError(e instanceof Error?e.message:"Native marketplace read unavailable");
  }finally{setBusy(false);}
 },[cursor]);
 useEffect(()=>{
  void refresh();
  const id=window.setInterval(()=>{if(!document.hidden)void refresh();},45_000);
  return()=>window.clearInterval(id);
 },[refresh]);
 useEffect(()=>{setResult(null);setReviewError("");},[account,cursor]);
 function next(){
  if(!market?.nextCursor||busy)return;
  setCursors(old=>old.slice(0,pageIndex+1).concat(market.nextCursor));
  setPageIndex(i=>i+1);
 }
 async function inspect(intent:"buy"|"cancel"|"list",tokenId:string,price?:string){
  if(!account){setReviewError("Connect a native Ultra testnet wallet first for a public account-specific review.");return;}
  setReviewBusy(true);setReviewError("");setResult(null);
  try{
   const q=new URLSearchParams({intent,tokenId,account});
   if(intent==="list"&&price)q.set("price",price);
   const response=await fetch("/api/uniqs/marketplace/review?"+q.toString(),{cache:"no-store"});
   const data=await response.json() as Review;
   if(!response.ok)throw Error(data.error??"Marketplace preflight unavailable");
   setResult(data);
  }catch(e){setReviewError(e instanceof Error?e.message:"Marketplace preflight unavailable");}
  finally{setReviewBusy(false);}
 }
 function reviewListing(e:FormEvent<HTMLFormElement>){
  e.preventDefault();void inspect("list",listToken,listPrice);
 }
 return <section aria-label="Native Ultra testnet Uniq resale marketplace" style={{
  border:"1px solid #e6e2ef",borderRadius:16,padding:22,margin:"26px 0",background:"#fcfbff"
 }}>
  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
   <Store size={23}/><h2 style={{fontSize:20,margin:0}}>Uniq marketplace</h2>
   <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#7b688f"}}>M15 · READ ONLY</span>
  </div>
  <p style={{fontSize:12,color:"#777",lineHeight:1.65,margin:"12px 0 18px"}}>
   Discover real resale entries on <strong>Ultra Native Testnet</strong>, crosschecked against
   the current owner&apos;s <code>token.b</code> holdings. These are <strong>not guaranteed executable offers</strong>:
   prices and ownership can change between blockchain reads. Buying, resale listings and cancellation are disabled.
  </p>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",margin:"13px 0"}}>
   <strong style={{fontSize:14}}>Onchain resale records</strong>
   <button className="subtle-cta" type="button" onClick={()=>void refresh()} disabled={busy}>
    <RefreshCw size={14}/>{busy?"Checking chain…":"Refresh native listings"}
   </button>
  </div>
  {!account?<p style={{fontSize:12,color:"#8a8491"}}><Wallet size={14} style={{display:"inline"}}/> Connect a native Ultra wallet to review buying, listing and cancel eligibility. Browsing is public.</p>:<p style={{fontSize:12,color:"#777",overflowWrap:"anywhere"}}>
   <Wallet size={14} style={{display:"inline"}}/> Native wallet: <strong>{account}</strong>. A server-side account-name check is not cryptographic wallet proof.
  </p>}
  {error&&<p role="alert" style={{fontSize:12,color:"#b42a4c"}}>{error}</p>}
  {market&&<>
   <div style={{padding:12,borderRadius:10,background:"#f3f0fa",fontSize:11,display:"flex",gap:12,flexWrap:"wrap"}}>
    <span>Native testnet head: {market.headBlock??"unknown"}</span>
    <span>Last irreversible: {market.lastIrreversibleBlock??"unknown"}</span>
    <span>Rows examined: {market.rowsScanned}</span>
    <span>Not crosschecked: {market.ownerNotConfirmed}</span>
   </div>
   {!market.listings.length?<p style={{fontSize:12,color:"#777",padding:"14px 0"}}>
    No current listings passed the native ownership crosscheck on this page. No demo prices have been substituted.
   </p>:<div style={{display:"grid",gap:11,marginTop:14}}>
    {market.listings.map(item=><article key={item.tokenId}
      style={{border:"1px solid #e9e6f1",borderRadius:11,padding:14,background:"#fff"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:12,flexWrap:"wrap"}}>
       <div>
        <strong style={{fontSize:15}}>Native Uniq #{item.tokenId}</strong>
        <p style={{fontSize:12,color:"#777",margin:"6px 0"}}>Factory {item.factoryId} · Serial {item.serialNumber}</p>
       </div>
       <div style={{textAlign:"right"}}>
        <strong style={{fontSize:15}}>{item.price.amount}</strong>
        <p style={{fontSize:11,color:"#7d7188",margin:"6px 0"}}>Current resale table price</p>
       </div>
      </div>
      <p style={{fontSize:12,color:"#777",overflowWrap:"anywhere",margin:"8px 0"}}>
       Seller: <strong>{item.owner}</strong> · Promoter share: {item.promoterBasisPoints} bps
      </p>
      <p style={{fontSize:11,color:"#427452",margin:"7px 0"}}>
       <ShieldCheck size={14} style={{display:"inline",verticalAlign:"middle"}}/>
       Resale row matched to current token.b owner — non-atomic testnet RPC reads
      </p>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:11}}>
       <button type="button" className="subtle-cta" disabled={!account||reviewBusy||busy}
         onClick={()=>void inspect(account===item.owner?"cancel":"buy",item.tokenId)}>
         <Search size={14}/>{account===item.owner?"Review cancellation":"Review purchase"}
       </button>
      </div>
    </article>)}
   </div>}
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:11,marginTop:15}}>
    <button className="subtle-cta" type="button" disabled={pageIndex===0||busy}
      onClick={()=>setPageIndex(p=>Math.max(0,p-1))}><ArrowLeft size={14}/> Previous</button>
    <span style={{fontSize:11,color:"#888"}}>Source page {pageIndex+1}</span>
    <button className="subtle-cta" type="button" disabled={!market.nextCursor||busy}
      onClick={next}>Next <ArrowRight size={14}/></button>
   </div>
   <p style={{fontSize:11,color:"#896881",lineHeight:1.5,marginTop:12}}>{market.nonAtomicReadWarning}</p>
  </>}
  <form onSubmit={reviewListing} style={{marginTop:20,padding:15,border:"1px solid #e9e6f1",borderRadius:11,background:"#fff",display:"grid",gap:11}}>
   <strong style={{fontSize:14}}>Review listing your own Uniq</strong>
   <p style={{fontSize:12,color:"#85808c",margin:0}}>
    Checks whether an ID belongs to your native account and is absent from the native resale table.
    This does not create a listing or verify fees, factory resale policy or wallet authority.
   </p>
   <label style={{fontSize:12,fontWeight:700}}>Existing onchain native Uniq ID
    <input style={{...field,marginTop:7}} required value={listToken} inputMode="numeric"
      onChange={e=>setListToken(e.target.value)} placeholder="Native token ID"/>
   </label>
   <label style={{fontSize:12,fontWeight:700}}>Proposed resale price (exact UOS amount)
    <input style={{...field,marginTop:7}} required value={listPrice}
      onChange={e=>setListPrice(e.target.value)} placeholder="10.00000000 UOS"/>
   </label>
   <button className="subtle-cta" type="submit" disabled={!account||reviewBusy}>
    <Search size={14}/> Read-only listing eligibility check
   </button>
  </form>
  {reviewError&&<p role="alert" style={{fontSize:12,color:"#ac2f4b",marginTop:12}}>{reviewError}</p>}
  {reviewBusy&&<p role="status" style={{fontSize:12}}>Rechecking resale state, owner and factory…</p>}
  {result&&<div role="status" style={{marginTop:16,padding:14,borderRadius:11,background:"#f3f1f9",fontSize:12}}>
   <strong>Native {result.intent} review · Uniq #{result.tokenId}</strong>
   <p style={{margin:"8px 0",color:result.review.conditionsMet?"#27634b":"#af344c"}}>
    Ownership/resale table conditions: {result.review.conditionsMet?"Matching at time of check":"Failed — do not proceed"}
   </p>
   <p style={{margin:"8px 0"}}>Current seller: {result.listing?.owner??"not listed"} ·
    Price: {result.listing?.price.amount??result.proposedPrice??"not available"}</p>
   <p style={{margin:"8px 0"}}>Factory entry: {result.review.nativeFactoryFound?"Found":"Missing"} · Review expires {new Date(result.expiresAt).toLocaleTimeString()}</p>
   <strong style={{fontSize:12,color:"#a32b47"}}><AlertTriangle size={15} style={{display:"inline"}}/> Execution disabled</strong>
   <p style={{fontSize:11,lineHeight:1.6,color:"#8d6478",margin:"8px 0"}}>{result.blockers.join(" ")}</p>
   <small>{result.warning}</small>
  </div>}
  <p style={{fontSize:11,color:"#946a7b",lineHeight:1.6,marginTop:16}}>
   No buy, listing, cancellation or spending authorization is available here. An independently reviewed wallet signing flow, exact native fee and resale-policy checks, testnet receipts, and security validation are required before enabling marketplace transactions.
  </p>
 </section>;
}
