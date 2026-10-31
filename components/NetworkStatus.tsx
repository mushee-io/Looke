"use client";
import { useEffect,useState } from "react";
import { Activity } from "lucide-react";
type Status={online:boolean;blockNumber?:number;network?:string};
export function NetworkStatus(){
 const [status,setStatus]=useState<Status|null>(null);
 useEffect(()=>{
  let active=true;
  fetch("/api/network",{cache:"no-store"}).then(r=>r.json()).then(d=>{if(active)setStatus(d);}).catch(()=>{if(active)setStatus({online:false});});
  return()=>{active=false;};
 },[]);
 return <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"12px 14px",border:"1px solid #eee",borderRadius:12,margin:"16px 0"}}>
  <Activity size={16} style={{color:status?.online?"#17a66d":"#aaa"}}/>
  <span>{!status?"Checking Ultra EVM testnet RPC...":status.online?"Ultra EVM testnet RPC available · block "+status.blockNumber:"Ultra EVM testnet RPC currently unavailable"}</span>
  <strong style={{marginLeft:"auto"}}>No trading</strong>
 </div>;
}
