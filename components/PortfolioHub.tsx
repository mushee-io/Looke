"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {Wallet,Layers3,RefreshCw,ExternalLink,Activity,ShieldAlert,ArrowRight,ArrowLeft} from "lucide-react";
import {formatUnits} from "viem";

type TokenBalance={address:string;symbol:string;decimals:number;balanceRaw:string;
 source:string;independentlyAudited:false};
type Assets={network:string;chainId:number;address:string;observedBlock:string;
 observedBlockHash:string;native:{symbol:string;decimals:number;balanceRaw:string};
 tokens:TokenBalance[];tokenAllowlistConfigured:boolean;coverage:string;
 tokenPriceAvailable:false;portfolioUsdValue:null;realizedPnl:null;warning:string;error?:string};
type NativeUniq={tokenId:string;factoryId:string;serialNumber:string};
type NativePage={account:string;uniqs:NativeUniq[];nextCursor:string|null;
 pageItemCount:number;allHoldingsLoaded:boolean;headBlock:string|null;
 lastIrreversibleBlock:string|null;warning:string;error?:string};
type Transfer={token:string;from:string;to:string;txHash:string;blockNumber:string;
 logIndex:number;valueRaw:string;direction:"in"|"out"|"self"};
type CreatorEvent={txHash:string;blockNumber:string;coinAddress:string;kind:number};
type History={address:string;fromBlock:string;toBlock:string;confirmationDepth:number;
 transfers:Transfer[];creatorEvents:CreatorEvent[];creatorEventStatus:string;
 transferHistoryStatus:string;completeHistory:false;note:string;error?:string};

function humanAmount(raw:string,decimals:number) {
 try{
  const value=formatUnits(BigInt(raw),decimals);
  return value.length>38?value.slice(0,38)+"…":value;
 }catch{return "unavailable";}
}
const inputStyle={width:"100%",padding:"11px 12px",border:"1px solid #e5e2ee",
 borderRadius:10,font:"inherit",marginTop:7};
const area={padding:15,borderRadius:12,border:"1px solid #e7e4ee",background:"#fff"};
async function json<T>(url:string):Promise<T>{
 const r=await fetch(url,{cache:"no-store"});
 const v=await r.json() as T&{error?:string};
 if(!r.ok)throw Error(v.error??"Portfolio source unavailable");
 return v;
}
/** Public read-only source dashboard. Entering an account does not prove ownership. */
export function PortfolioHub({evmAddress,nativeAccount}:{
 evmAddress:string|null;nativeAccount:string|null;
}){
 const [evm,setEvm]=useState(evmAddress??"");
 const [native,setNative]=useState(nativeAccount??"");
 const [assets,setAssets]=useState<Assets|null>(null);
 const [history,setHistory]=useState<History|null>(null);
 const [nfts,setNfts]=useState<NativePage|null>(null);
 const [evmError,setEvmError]=useState("");
 const [historyError,setHistoryError]=useState("");
 const [nativeError,setNativeError]=useState("");
 const [evmBusy,setEvmBusy]=useState(false);
 const [nativeBusy,setNativeBusy]=useState(false);
 const [nativePages,setNativePages]=useState<(string|null)[]>([null]);
 const [nativeIndex,setNativeIndex]=useState(0);
 const evmGeneration=useRef(0);
 const nativeGeneration=useRef(0);
 const nativeCursor=nativePages[nativeIndex]??null;

 useEffect(()=>{if(evmAddress!==null){setEvm(evmAddress);setAssets(null);setHistory(null);evmGeneration.current++;}},[evmAddress]);
 useEffect(()=>{if(nativeAccount!==null){setNative(nativeAccount);setNfts(null);nativeGeneration.current++;setNativePages([null]);setNativeIndex(0);}},[nativeAccount]);

 async function loadEvm(account:string){
  if(!account.trim()){setEvmError("Enter an Ultra EVM testnet address.");return;}
  const generation=++evmGeneration.current;
  setEvmBusy(true);setEvmError("");setHistoryError("");
  setAssets(null);setHistory(null);
  const encoded=encodeURIComponent(account.trim());
  const [a,h]=await Promise.allSettled([
   json<Assets>("/api/portfolio/assets?address="+encoded),
   json<History>("/api/portfolio/activity?address="+encoded)
  ]);
  if(generation!==evmGeneration.current)return;
  if(a.status==="fulfilled")setAssets(a.value);
  else setEvmError(a.reason instanceof Error?a.reason.message:"EVM balances unavailable");
  if(h.status==="fulfilled")setHistory(h.value);
  else setHistoryError(h.reason instanceof Error?h.reason.message:"Transfer activity unavailable");
  setEvmBusy(false);
 }
 async function loadNative(account:string,cursor:string|null){
  if(!account.trim()){setNativeError("Enter a native Ultra testnet account.");return;}
  const generation=++nativeGeneration.current;
  setNativeBusy(true);setNativeError("");setNfts(null);
  try{
   const q=new URLSearchParams({account:account.trim()});
   if(cursor)q.set("cursor",cursor);
   const result=await json<NativePage>("/api/portfolio/native?"+q);
   if(generation===nativeGeneration.current)setNfts(result);
  }catch(e){if(generation===nativeGeneration.current)
   setNativeError(e instanceof Error?e.message:"Native Uniq holdings unavailable");}
  finally{if(generation===nativeGeneration.current)setNativeBusy(false);}
 }
 useEffect(()=>{if(evmAddress)void loadEvm(evmAddress);},[evmAddress]);
 useEffect(()=>{if(nativeAccount)void loadNative(nativeAccount,null);},[nativeAccount]);

 function submitEvm(e:FormEvent<HTMLFormElement>){e.preventDefault();void loadEvm(evm);}
 function submitNative(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setNativePages([null]);setNativeIndex(0);void loadNative(native,null);
 }
 function nextNative(){
  if(!nfts?.nextCursor||nativeBusy)return;
  const cursor=nfts.nextCursor;
  setNativePages(p=>p.slice(0,nativeIndex+1).concat(cursor));
  setNativeIndex(p=>p+1);void loadNative(native,cursor);
 }
 function prevNative(){
  if(nativeIndex===0||nativeBusy)return;
  const index=nativeIndex-1;
  setNativeIndex(index);void loadNative(native,nativePages[index]??null);
 }
 const tokenNames=new Map(assets?.tokens.map(t=>[t.address.toLowerCase(),t])??[]);
 return <section aria-label="Ultra EVM and native Uniq portfolio" style={{
  border:"1px solid #e3e0ed",background:"#fcfbff",padding:20,borderRadius:16,margin:"25px 0"
 }}>
  <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
   <Layers3 size={22}/><h2 style={{fontSize:20,margin:0}}>Portfolio and onchain history</h2>
   <span style={{marginLeft:"auto",fontSize:11,color:"#76628f",fontWeight:700}}>M18 · READ ONLY</span>
  </div>
  <p style={{fontSize:12,lineHeight:1.65,color:"#777",margin:"12px 0 16px"}}>
   View sourced Ultra EVM testnet balances and native Ultra Uniq ownership in separate networks.
   Values are never combined across tokens or interpreted as USD, PnL, realized revenue or available trading funds.
   Public address lookups do <strong>not</strong> verify that you control an account.
  </p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:14}}>
   <div style={area}>
    <strong style={{fontSize:14}}><Wallet size={17} style={{display:"inline",verticalAlign:"middle"}}/> Ultra EVM assets (18881)</strong>
    <form onSubmit={submitEvm} style={{margin:"13px 0",display:"grid",gap:10}}>
     <label style={{fontSize:12,fontWeight:700}}>Public EVM wallet address
      <input style={inputStyle} value={evm} placeholder="0x…" onChange={e=>{evmGeneration.current++;setEvm(e.target.value);setAssets(null);setHistory(null);setEvmBusy(false);}} required/>
     </label>
     <button type="submit" className="subtle-cta" disabled={evmBusy}>
      <RefreshCw size={14}/> {evmBusy?"Reading testnet…":"Load EVM balances and confirmed transfers"}
     </button>
    </form>
    {evmError&&<p role="alert" style={{fontSize:12,color:"#ac3151"}}>{evmError}</p>}
    {assets&&<div style={{fontSize:12}}>
     <p style={{color:"#777",margin:"8px 0"}}>Observed block <strong>{assets.observedBlock}</strong> · Same-block RPC snapshot</p>
     <strong style={{fontSize:20,overflowWrap:"anywhere"}}>
      {humanAmount(assets.native.balanceRaw,18)} UOS
     </strong>
     <p style={{fontSize:11,color:"#888",margin:"7px 0"}}>Native UOS on Ultra <strong>EVM</strong> (not native Ultra chain UOS). No USD conversion.</p>
     {assets.tokens.length?assets.tokens.map(token=><div key={token.address}
      style={{borderTop:"1px solid #eae7f0",padding:"10px 0"}}>
       <strong>{humanAmount(token.balanceRaw,token.decimals)} {token.symbol}</strong>
       <div style={{fontSize:11,color:"#888",overflowWrap:"anywhere"}}>{token.address}</div>
       <div style={{fontSize:11,color:"#92849c"}}>Configured token; contract audit not independently verified</div>
      </div>):<p style={{color:"#888",margin:"12px 0"}}>
       No ERC-20 portfolio token sources configured. This does not mean the wallet holds zero ERC-20 assets.
      </p>}
     <a href={"https://evmexplorer.testnet.ultra.io/address/"+assets.address}
      target="_blank" rel="noreferrer" style={{fontSize:11,display:"inline-flex",gap:5,alignItems:"center",marginTop:8}}>
      Inspect EVM testnet address <ExternalLink size={13}/>
     </a>
    </div>}
   </div>
   <div style={area}>
    <strong style={{fontSize:14}}><Layers3 size={17} style={{display:"inline",verticalAlign:"middle"}}/> Ultra Native Uniq holdings</strong>
    <form onSubmit={submitNative} style={{margin:"13px 0",display:"grid",gap:10}}>
     <label style={{fontSize:12,fontWeight:700}}>Public native testnet account
      <input style={inputStyle} value={native} placeholder="nativeacct11" required maxLength={12}
       onChange={e=>{nativeGeneration.current++;setNative(e.target.value);setNfts(null);setNativeBusy(false);setNativePages([null]);setNativeIndex(0);}}/>
     </label>
     <button type="submit" className="subtle-cta" disabled={nativeBusy}>
      <RefreshCw size={14}/> {nativeBusy?"Reading token.b…":"Load native Uniqs"}
     </button>
    </form>
    {nativeError&&<p role="alert" style={{fontSize:12,color:"#a9314d"}}>{nativeError}</p>}
    {nfts&&<div style={{fontSize:12}}>
     <p style={{color:"#7b7285",margin:"8px 0"}}>Native testnet account: <strong>{nfts.account}</strong> · owner-scoped token.b</p>
     <p style={{fontSize:11,color:"#928a99"}}>Last irreversible block reported by RPC: {nfts.lastIrreversibleBlock??"unknown"}. Individual table rows are not an immutable snapshot.</p>
     {nfts.uniqs.length?nfts.uniqs.map(item=><div key={item.tokenId}
       style={{borderTop:"1px solid #ebe8f2",padding:"9px 0"}}>
       <strong>Uniq #{item.tokenId}</strong>
       <div style={{fontSize:11,color:"#888"}}>Factory {item.factoryId} · serial {item.serialNumber}</div>
      </div>):<p style={{color:"#777"}}>No native Uniqs found on this page; legacy assets or other networks may not be covered.</p>}
     <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
      <button type="button" className="subtle-cta" disabled={nativeIndex===0||nativeBusy}
       onClick={prevNative}><ArrowLeft size={14}/> Previous</button>
      <span style={{fontSize:11}}>Page {nativeIndex+1}</span>
      <button type="button" className="subtle-cta" disabled={!nfts.nextCursor||nativeBusy}
       onClick={nextNative}>Next <ArrowRight size={14}/></button>
     </div>
     <p style={{fontSize:11,color:"#917488",marginTop:9}}>Page size: 20 · Not a native NFT valuation · Native chain balance is not merged with EVM UOS.</p>
    </div>}
   </div>
  </div>
  <div style={{...area,marginTop:15}}>
   <strong style={{fontSize:14}}><Activity size={16} style={{display:"inline",verticalAlign:"middle"}}/> Confirmed EVM activity (limited history)</strong>
   {historyError&&<p role="alert" style={{fontSize:12,color:"#ad3152"}}>{historyError}</p>}
   {history&&<div style={{fontSize:12}}>
    <p style={{fontSize:11,color:"#777"}}>
     ERC-20 Transfer logs: blocks {history.fromBlock}–{history.toBlock}, 12-block confirmation delay,
     at most the last 250 blocks. Not complete transaction history, and excludes ordinary UOS transfers.
    </p>
    <p style={{fontSize:11,color:"#8c778f"}}>Transfer source: {history.transferHistoryStatus.replaceAll("_"," ")}</p>
    {history.transfers.length?history.transfers.map(x=>{
     const token=tokenNames.get(x.token);
     return <div key={x.token+":"+x.txHash+":"+x.logIndex}
      style={{borderTop:"1px solid #eae7f1",padding:"10px 0",display:"flex",alignItems:"center",gap:10,justifyContent:"space-between"}}>
      <div style={{minWidth:0}}>
       <strong>{x.direction==="in"?"Incoming":x.direction==="out"?"Outgoing":"Self-transfer"} ERC-20</strong>
       <p style={{margin:"4px 0",overflowWrap:"anywhere"}}>{token?
        humanAmount(x.valueRaw,token.decimals)+" "+token.symbol:
        x.valueRaw+" raw units of "+x.token}</p>
       <small>Block {x.blockNumber} · log {x.logIndex}</small>
      </div>
      <a href={"https://evmexplorer.testnet.ultra.io/tx/"+x.txHash}
       target="_blank" rel="noreferrer" aria-label="View ERC-20 Transfer evidence"><ExternalLink size={15}/></a>
     </div>;
    }):<p style={{color:"#888"}}>No curated token Transfer logs found in the scanned window. Older or non-ERC-20 activity is not covered.</p>}
    <p style={{fontSize:11,color:"#8a758c",marginTop:16}}>
     Indexed creator-coin creation events: {history.creatorEventStatus.replaceAll("_"," ")}
    </p>
    {history.creatorEvents.length?history.creatorEvents.map((x,i)=><div key={x.txHash+":"+i}
      style={{padding:"10px 0",borderTop:"1px solid #eae7f1",display:"flex",gap:9,justifyContent:"space-between",alignItems:"center"}}>
     <div style={{minWidth:0}}>
      <strong>{["Creator","Content","Trend"][x.kind]??"Coin"} token creation event</strong>
      <p style={{margin:"5px 0",overflowWrap:"anywhere",fontSize:11,color:"#777"}}>{x.coinAddress}</p>
      <small>Indexed block {x.blockNumber}; this does not prove current token balance.</small>
     </div>
     <a href={"https://evmexplorer.testnet.ultra.io/tx/"+x.txHash} target="_blank"
      rel="noreferrer" aria-label="View factory event transaction"><ExternalLink size={15}/></a>
    </div>):<p style={{fontSize:12,color:"#888"}}>No source-confirmed factory creation events available for this address.</p>}
   </div>}
   {!history&&!historyError&&<p style={{fontSize:12,color:"#888"}}>Choose an EVM testnet account above to inspect bounded recent event history.</p>}
  </div>
  <p style={{fontSize:11,color:"#99647a",lineHeight:1.6,margin:"16px 0 0"}}>
   <ShieldAlert size={14} style={{display:"inline",verticalAlign:"middle"}}/>
   EVM and native Ultra are separate blockchain account models. Addresses entered here are public lookups,
   not account-control proof. There is no asset spending, portfolio valuation, profit and loss calculation,
   cost basis, realized royalty balance, full UOS transaction history or verified native NFT trade history.
  </p>
 </section>;
}
