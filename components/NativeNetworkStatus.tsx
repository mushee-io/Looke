"use client";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export function NativeNetworkStatus() {
  const [status,setStatus] = useState<{ online: boolean; headBlock?: number; error?: string } | null>(null);
  useEffect(()=>{
    let active=true;
    fetch("/api/native-network",{cache:"no-store"}).then(async r=>{
      const result=await r.json() as {online:boolean;headBlock?:number;error?:string};
      return result;
    }).then(data=>{if(active)setStatus(data);}).catch(()=>{if(active)setStatus({online:false,error:"Native testnet RPC unreachable"});});
    return()=>{active=false;};
  },[]);
  return <div role="status" style={{margin:"12px 0",display:"flex",alignItems:"center",gap:8,fontSize:12}}>
    <Activity size={15} color={status?.online?"#21be77":"#a3a3a3"}/>
    {!status ? "Checking native Ultra testnet…" :
      status.online ? `Native Ultra testnet RPC online · block ${status.headBlock}` :
      status.error ?? "Native Ultra testnet RPC unavailable"}
  </div>;
}
