"use client";

import {useCallback,useEffect,useState} from "react";
import {Activity,RefreshCw,ShieldAlert,ExternalLink,BarChart3} from "lucide-react";
import {formatUnits} from "viem";

type PoolInfo={address:string;indexedThrough:string|null;hasCheckpoint:boolean;updatedAt:string|null};
type Overview={rpcStatus:string;head:string|null;confirmedThrough:string|null;
 factory:{configured:boolean;indexedThrough:string|null;hasCheckpoint:boolean};
 pools:PoolInfo[];warnings:string[];tradingEnabled:false};
type Token={address:string;symbol:string;decimals:number;reserveRaw:string};
type Swap={tx_hash:string;block_number:string;log_index:number;block_hash:string;
 amount0_in:string;amount1_in:string;amount0_out:string;amount1_out:string;
 direction:string};
type Market={
 pool:string;observedBlock:string;token0:Token;token1:Token;
 reserveAgeSeconds:number;reservesFresh:boolean;
 lastIndexedBlock:string|null;historyStatus:string;swaps:Swap[];warning:string;
};
function amount(raw:string,decimals:number){
 try{
  const formatted=formatUnits(BigInt(raw),decimals);
  return formatted.length>38?formatted.slice(0,38)+"…":formatted;
 }catch{return "unavailable";}
}
function swapText(s:Swap,t0:Token,t1:Token){
 if(s.direction==="token0_to_token1")
  return amount(s.amount0_in,t0.decimals)+" "+t0.symbol+" → "+
    amount(s.amount1_out,t1.decimals)+" "+t1.symbol;
 if(s.direction==="token1_to_token0")
  return amount(s.amount1_in,t1.decimals)+" "+t1.symbol+" → "+
    amount(s.amount0_out,t0.decimals)+" "+t0.symbol;
 return "Complex swap event — inspect transaction; no simplified direction assumed";
}

export function LiveMarkets(){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [selected,setSelected]=useState("");
 const [market,setMarket]=useState<Market|null>(null);
 const [loading,setLoading]=useState(true);
 const [fetching,setFetching]=useState(false);
 const [error,setError]=useState("");
 const [detailError,setDetailError]=useState("");
 const refreshOverview=useCallback(async()=>{
  const response=await fetch("/api/markets",{cache:"no-store"});
  const data=await response.json() as Overview&{error?:string};
  if(!response.ok)throw new Error(data.error??"Market index unavailable");
  return data;
 },[]);
 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const data=await refreshOverview();
    if(active){
     setOverview(data);setError("");
     setSelected(old=>data.pools.some(x=>x.address===old)?old:(data.pools[0]?.address??""));
    }
   }catch(e){if(active){setOverview(null);setError(e instanceof Error?e.message:"Market index unavailable");}}
   finally{if(active)setLoading(false);}
  }
  void load();
  const timer=setInterval(()=>{if(!document.hidden)void load();},30_000);
  return()=>{active=false;clearInterval(timer);};
 },[refreshOverview]);
 useEffect(()=>{
  if(!selected){setMarket(null);setDetailError("");return;}
  let active=true;
  async function load(){
   setFetching(true);
   try{
    const response=await fetch("/api/markets/pool?pool="+encodeURIComponent(selected),{cache:"no-store"});
    const data=await response.json() as Market&{error?:string};
    if(!response.ok)throw Error(data.error??"Pool data unavailable");
    if(active){setMarket(data);setDetailError("");}
   }catch(e){if(active){setMarket(null);setDetailError(e instanceof Error?e.message:"Pool data unavailable");}}
   finally{if(active)setFetching(false);}
  }
  void load();
  const timer=setInterval(()=>{if(!document.hidden)void load();},30_000);
  return()=>{active=false;clearInterval(timer);};
 },[selected]);
 const active=overview?.pools.find(p=>p.address===selected);
 return <section aria-label="Ultra EVM confirmed market monitor"
   style={{border:"1px solid #e8e6f0",borderRadius:16,background:"#fcfbff",padding:20,margin:"24px 0"}}>
   <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
     <BarChart3 size={21}/><h2 style={{fontSize:20,margin:0}}>Ultra testnet market monitor</h2>
     <span style={{fontSize:11,fontWeight:700,color:"#7b668e",marginLeft:"auto"}}>M13 · READ ONLY</span>
   </div>
   <p style={{fontSize:12,lineHeight:1.6,color:"#75717d",margin:"10px 0 16px"}}>
     Monitors explicitly configured V2-compatible Ultra EVM testnet contracts and
     confirmed onchain Swap logs. <strong>No invented coin prices, USD volumes, TVL, or simulated activity.</strong>
     Market sources are not independently audited and swaps cannot be placed here.
   </p>
   {loading?<p role="status" style={{fontSize:12}}>Checking testnet market sources…</p>:
    error?<p role="alert" style={{fontSize:12,color:"#a72a4d"}}>{error}</p>:
    overview&&<>
     <div style={{fontSize:12,padding:12,background:"#f4f1fa",borderRadius:10,display:"flex",gap:14,flexWrap:"wrap"}}>
       <span>RPC: <strong>{overview.rpcStatus==="connected"?"Connected":overview.rpcStatus}</strong></span>
       <span>Head: <strong>{overview.head??"unknown"}</strong></span>
       <span>12-block confirmation frontier: <strong>{overview.confirmedThrough??"unknown"}</strong></span>
       <span>Factory index: <strong>{overview.factory.hasCheckpoint?"Checkpoint recorded":"Unverified / not indexed"}</strong></span>
     </div>
     {!overview.pools.length?<p style={{fontSize:12,color:"#777",marginTop:16}}>
       No operator-verified testnet liquidity pools configured. Real reserves and Swap-event history will appear only after source review, allowlisting, database migration, and a running indexer.
     </p>:<>
      <label style={{display:"block",fontSize:12,fontWeight:700,marginTop:17}}>
        Select an operator-allowlisted testnet pool
        <select value={selected} onChange={e=>{setSelected(e.target.value);setMarket(null);}}
          style={{display:"block",padding:"11px",width:"100%",borderRadius:9,border:"1px solid #ddd",marginTop:8,font:"inherit"}}>
          {overview.pools.map(p=><option key={p.address} value={p.address}>{p.address}</option>)}
        </select>
      </label>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:12,fontSize:11,color:"#888"}}>
       <span>Last indexed block: {active?.indexedThrough??"not started"}</span>
       <span>Block-hash checkpoint: {active?.hasCheckpoint?"stored":"missing"}</span>
       <span>Updates checked about every 30 seconds while tab is visible</span>
      </div>
      {fetching&&!market&&<p role="status" style={{fontSize:12}}>Reading Ultra testnet pool at a pinned block…</p>}
      {detailError&&<p role="alert" style={{fontSize:12,color:"#b32648"}}>{detailError}</p>}
      {market&&<div style={{marginTop:15}}>
        <div style={{border:"1px solid #e6e4ed",borderRadius:12,padding:14,background:"#fff"}}>
          <strong style={{fontSize:14}}>Onchain V2 reserve snapshot</strong>
          <p style={{fontSize:11,color:"#999",margin:"7px 0"}}>Observed block {market.observedBlock}, not a verified liquidity audit or market valuation</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <div style={{fontSize:13}}>
              <strong>{market.token0.symbol}</strong>
              <p style={{overflowWrap:"anywhere",fontSize:11,color:"#888"}}>{market.token0.address}</p>
              <strong>{amount(market.token0.reserveRaw,market.token0.decimals)}</strong> <small>token reserve</small>
            </div>
            <div style={{fontSize:13}}>
              <strong>{market.token1.symbol}</strong>
              <p style={{overflowWrap:"anywhere",fontSize:11,color:"#888"}}>{market.token1.address}</p>
              <strong>{amount(market.token1.reserveRaw,market.token1.decimals)}</strong> <small>token reserve</small>
            </div>
          </div>
          <p style={{fontSize:11,margin:"10px 0 0",color:market.reservesFresh?"#577060":"#ac4461"}}>
            Last reserve update: {market.reserveAgeSeconds}s before observed block. {market.reservesFresh?"Within age threshold.":"STALE snapshot."}
          </p>
        </div>
        <div style={{marginTop:16}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><Activity size={16}/><strong style={{fontSize:14}}>Confirmed Swap event history</strong></div>
          <p style={{fontSize:11,color:"#888",margin:"6px 0"}}>
            Status: {market.historyStatus.replaceAll("_"," ")}. The indexer needs an authorized scheduler; no event is invented if it has not run.
          </p>
          {market.swaps.length?market.swaps.map((s,i)=><div key={s.tx_hash+":"+s.log_index+":"+i}
            style={{padding:"12px 0",borderTop:"1px solid #e9e7f0",display:"flex",gap:12,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{minWidth:0}}>
             <strong style={{fontSize:12}}>{swapText(s,market.token0,market.token1)}</strong>
             <div style={{fontSize:11,color:"#999",marginTop:5}}>Confirmed log · block {s.block_number} · log {s.log_index}</div>
            </div>
            <a href={"https://evmexplorer.testnet.ultra.io/tx/"+s.tx_hash} target="_blank" rel="noreferrer"
              aria-label="View transaction evidence in Ultra EVM testnet explorer"><ExternalLink size={16}/></a>
          </div>):<p style={{fontSize:12,color:"#8b8692",marginTop:10}}>
            No canonical, confirmed Swap logs indexed for this pool yet.
          </p>}
        </div>
      </div>}
     </>}
    </>}
   <p style={{fontSize:11,margin:"17px 0 0",color:"#a45b6b",lineHeight:1.5}}>
    <ShieldAlert size={14} style={{display:"inline",verticalAlign:"middle"}}/>
    Indexer confirmation depth reduces reorg risk but does not eliminate it. On a detected checkpoint mismatch, ingestion halts for operator reconciliation. Trading remains disabled.
   </p>
 </section>;
}
