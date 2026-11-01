"use client";
import { useCallback, useEffect, useState } from "react";
import { Heart, UserPlus, MessageCircle, Repeat2, CheckCheck, RefreshCw } from "lucide-react";

type Alert = {
 kind:"follow"|"like"|"comment"|"repost";
 actor:string;actor_handle:string|null;source_id:string;
 post_id:string|null;event_time:string;unread:boolean;
};
type NotificationsResult={notifications:Alert[];unread:number};
function postUrl(postId:string) {return "/?post="+encodeURIComponent(postId)+"#feed";}

export function Notifications({authenticated,onLogin}:{authenticated:boolean;onLogin:()=>void}) {
 const [alerts,setAlerts]=useState<Alert[]>([]);
 const [unread,setUnread]=useState(0);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const refresh=useCallback(async () => {
  setLoading(true);
  try {
   const response=await fetch("/api/notifications",{cache:"no-store"});
   const data=await response.json() as NotificationsResult & {error?:string};
   if(!response.ok)throw new Error(data.error??"Notifications unavailable");
   setAlerts(data.notifications??[]);
   setUnread(data.unread??0);
   setMessage("");
  }catch(error){setMessage(error instanceof Error?error.message:"Notifications unavailable");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  if(!authenticated){setAlerts([]);setUnread(0);setMessage("");return;}
  void refresh();
 },[authenticated,refresh]);

 async function markRead() {
  if(busy)return;
  setBusy(true);setMessage("");
  try {
   const response=await fetch("/api/notifications",{method:"POST"});
   const data=await response.json() as {error?:string};
   if(!response.ok)throw new Error(data.error??"Could not mark notifications read");
   await refresh();
   setMessage("Notifications marked as read.");
  }catch(error){setMessage(error instanceof Error?error.message:"Could not mark notifications read");}
  finally{setBusy(false);}
 }
 if(!authenticated)return <p style={{fontSize:13,margin:"22px 0"}}>Sign in to view real social activity. <button onClick={onLogin}>Connect and sign in</button></p>;
 return <section aria-label="Your social notifications" style={{margin:"20px 0"}}>
  <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
    <h2 style={{fontSize:20,margin:0}}>Your social notifications {unread>0&&<span style={{fontSize:12,fontWeight:500,color:"#777"}}>({unread} unread)</span>}</h2>
    <div style={{display:"flex",gap:8}}>
      <button className="subtle-cta" type="button" disabled={loading||busy} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button>
      <button className="subtle-cta" type="button" disabled={busy||unread===0} onClick={()=>void markRead()}><CheckCheck size={14}/> Mark all read</button>
    </div>
  </div>
  {message&&<p role="status" style={{fontSize:12,marginTop:12}}>{message}</p>}
  {loading&&!alerts.length?<p role="status">Loading real notifications…</p>:
   alerts.length?alerts.map((alert,i)=>{
     const icon=alert.kind==="follow"?<UserPlus size={19}/>:
       alert.kind==="like"?<Heart size={19}/>:
       alert.kind==="comment"?<MessageCircle size={19}/>:<Repeat2 size={19}/>;
     const label=alert.kind==="follow"?"followed you":alert.kind==="like"?"liked your post":alert.kind==="comment"?"commented on your post":"reposted your post";
     const href=alert.post_id?postUrl(alert.post_id):alert.actor_handle?"/creators/"+encodeURIComponent(alert.actor_handle):null;
     return <div key={alert.kind+alert.source_id+String(i)}
       style={{display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #eee",padding:"14px 0",background:alert.unread?"#faf9ff":undefined}}>
       <span aria-hidden>{icon}</span>
       <span style={{flex:1}}>
         {href?<a href={href} style={{textDecoration:"none"}}>
           <strong>{alert.actor}</strong> {label}
         </a>:<><strong>{alert.actor}</strong> {label}</>}
         <small style={{display:"block",opacity:.65}}>{new Date(alert.event_time).toLocaleString()}</small>
       </span>
       {alert.unread&&<span aria-label="Unread" title="Unread" style={{width:7,height:7,borderRadius:7,background:"#836bd1"}}/>}
     </div>;
   }):<p style={{fontSize:13,opacity:.65,margin:"12px 0"}}>No social notifications yet.</p>}
  <p style={{fontSize:11,color:"#888",marginTop:13}}>Notifications reflect current database activity. Mobile push alerts are not yet configured.</p>
 </section>;
}
