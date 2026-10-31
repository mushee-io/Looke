"use client";
import { useEffect, useState } from "react";
import { Wallet, ExternalLink } from "lucide-react";
type Balance={address:string;uosBalance:string;observedBlock:string;network:string};
export function EvmPortfolio({address}:{address:string|null}) {
  const [balance,setBalance]=useState<Balance|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!address){setBalance(null);setError("");return;}
    let active=true;
    fetch("/api/portfolio?address="+encodeURIComponent(address),{cache:"no-store"}).then(async r=>{
      const d=await r.json();if(!r.ok)throw Error(d.error||"Unavailable");return d as Balance;
    }).then(d=>{if(active){setBalance(d);setError("");}}).catch(e=>{if(active){setBalance(null);setError(e.message);}});
    return()=>{active=false;};
  },[address]);
  return <div style={{border:"1px solid #ececec",borderRadius:16,padding:18,margin:"18px 0"}}>
    <strong style={{display:"flex",alignItems:"center",gap:8}}><Wallet size={17}/> Ultra EVM Wallet</strong>
    {!address?<p style={{fontSize:13,opacity:.65}}>Connect Ultra EVM testnet wallet to read your UOS balance.</p>:
      <><p style={{fontSize:12,opacity:.65,overflowWrap:"anywhere"}}>{address}</p>
      {balance?<><strong style={{display:"block",fontSize:26,margin:"10px 0"}}>{Number(balance.uosBalance).toLocaleString(undefined,{maximumFractionDigits:6})} UOS</strong>
      <small>Live testnet balance at block {balance.observedBlock}. No coin PnL or portfolio valuation inferred.</small>
      <p><a href={"https://evmexplorer.testnet.ultra.io/address/"+address} target="_blank" rel="noreferrer" style={{display:"inline-flex",gap:6,fontSize:12,marginTop:12}}>Open Ultra EVM explorer <ExternalLink size={13}/></a></p></>
      :<p style={{fontSize:13,opacity:.65}}>{error||"Reading testnet balance..."}</p>}</>}
  </div>;
}
