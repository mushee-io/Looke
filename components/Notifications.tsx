"use client";
import { useEffect,useState } from "react";
import { Heart, UserPlus } from "lucide-react";
type Alert={kind:"follow"|"like";actor:string;event_time:string;source_id:string};
export function Notifications({authenticated,onLogin}:{authenticated:boolean;onLogin:()=>void}){
 const [alerts,setAlerts]=useState<Alert[]>([]);
 const [message,setMessage]=useState("");
 useEffect(()=>{
   if(!authenticated){setAlerts([]);return;}
   let active=true;
   fetch("/api/notifications",{cache:"no-store"}).then(async r=>{
     const d=await r.json();if(!r.ok)throw Error(d.error||"Unavailable");return d;
   }).then(d=>{if(active){setAlerts(d.notifications||[]);setMessage("");}})
     .catch(e=>{if(active)setMessage(e.message);});
   return()=>{active=false;};
 },[authenticated]);
 if(!authenticated)return <p style={{fontSize:13,margin:"22px 0"}}>Sign in to view real social activity. <button onClick={onLogin}>Connect and sign in</button></p>;
 return <div style={{margin:"20px 0"}}>
  <h2 style={{fontSize:20}}>Your social notifications</h2>
  {message?<p>{message}</p>:alerts.length?alerts.map((a,i)=><div key={a.source_id+String(i)} style={{display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #eee",padding:"14px 0"}}>
    {a.kind==="follow"?<UserPlus size={19}/>:<Heart size={19}/>}
    <span><strong>{a.actor}</strong> {a.kind==="follow"?"followed you":"liked your post"}<small style={{display:"block",opacity:.6}}>{new Date(a.event_time).toLocaleString()}</small></span>
  </div>):<p style={{fontSize:13,opacity:.65,margin:"12px 0"}}>No notifications yet.</p>}
 </div>;
}
