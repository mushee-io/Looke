"use client";
import {useCallback,useEffect,useState} from "react";
import {getAddress,isAddress} from "viem";
import "./m18.css";

type AnalyticsResult={
 authenticated:boolean;ownerScoped:boolean;source:string;periodDays:number;
 summary:{posts:number;pending_media:number;hidden_posts:number;followers:number;following:number;
   likes_received:number;reposts_received:number;comments_received:number};
 daily:{day:string;posts:number}[];
 topPosts:{id:string;body:string;created_at:string;likes:number;reposts:number;comments:number}[];
};
function errorText(e:unknown){return e instanceof Error?e.message:"Looke database is unavailable.";}
async function read<T>(path:string){
 const response=await fetch(path,{cache:"no-store",credentials:"same-origin"});
 const data=await response.json() as T&{error?:string};
 if(!response.ok)throw Error(data.error||"Creator data is unavailable.");
 return data;
}
async function submit(path:string,input:Record<string,unknown>){
 const response=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"content-type":"application/json"},body:JSON.stringify(input)});
 const data=await response.json() as {ok?:boolean;error?:string};
 if(!response.ok||data.ok!==true)throw Error(data.error||"Looke rejected this change.");
 return data;
}

export function CreatorAnalytics(){
 const [data,setData]=useState<AnalyticsResult|null>(null);
 const [status,setStatus]=useState("Loading verified creator records…");
 useEffect(()=>{
  let alive=true;
  void read<AnalyticsResult>("/api/social/analytics")
   .then(d=>{if(alive){setData(d);setStatus("");}})
   .catch(e=>{if(alive){setData(null);setStatus(errorText(e));}});
  return()=>{alive=false;};
 },[]);
 const items=data?([
  ["Visible posts",data.summary.posts],["Followers",data.summary.followers],
  ["Following",data.summary.following],["Likes received",data.summary.likes_received],
  ["Reposts received",data.summary.reposts_received],
  ["Visible replies",data.summary.comments_received],
  ["Media awaiting review",data.summary.pending_media],
  ["Hidden posts",data.summary.hidden_posts],
 ] as const):[];
 const max=Math.max(1,...(data?.daily.map(d=>d.posts)??[]));
 return <section className="social-card lk-m18-section">
  <h2>Creator analytics</h2>
  <p>Real engagement on your verified, visible posts. These figures are not impressions, unique viewers, volume or token valuations.</p>
  {!data?<p role="status">{status}</p>:<>
   <div className="lk-m18-metrics">
     {items.map(([title,value])=><div key={title}><small>{title}</small><strong>{value}</strong></div>)}
   </div>
   <h3>Published posts · past 14 days (UTC)</h3>
   <div className="lk-m18-plot" role="img"
     aria-label={"Actual daily published post counts: "+data.daily.map(x=>x.day+" "+x.posts).join(", ")}>
     {data.daily.map(x=><div className="lk-m18-day" key={x.day} title={x.day+": "+x.posts+" posts"}>
       <div className="lk-m18-bar" style={{height:Math.round(x.posts/max*100)+"%"}}/>
       <small>{x.day.slice(8)}</small></div>)}
   </div>
   <h3>Most engaged visible posts</h3>
   {data.topPosts.length===0?<p>No visible creator posts yet.</p>:
    data.topPosts.map(post=><article className="lk-m18-list" key={post.id}>
     <p>{post.body}</p>
     <small>{post.likes} likes · {post.reposts} reposts · {post.comments} comments</small>
    </article>)}
   <small>Source: actual Looke PostgreSQL records. Account-scoped and not cached.</small>
  </>}
 </section>;
}

type Preferences={follows:boolean;comments:boolean;likes:boolean;reposts:boolean};
type Muted={address:string;handle:string;display_name:string;created_at:string};
type Controls={preferences:Preferences;mutes:Muted[];authenticated:boolean;ownerScoped:boolean};
export function AccountControls({onChanged}:{onChanged?:()=>void}){
 const [data,setData]=useState<Controls|null>(null);
 const [target,setTarget]=useState("");
 const [status,setStatus]=useState("Checking signed-in controls…");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  try{const x=await read<Controls>("/api/social/controls");
   setData(x);setStatus("");}
  catch(e){setData(null);setStatus(errorText(e));}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function save(input:Record<string,unknown>){
  if(busy)return;setBusy(true);setStatus("");
  try{await submit("/api/social/controls",input);await load();
   setStatus("Account preferences saved for the signed-in wallet.");
   onChanged?.();
  }catch(e){setStatus(errorText(e));}finally{setBusy(false);}
 }
 async function muteTarget(){
  if(!isAddress(target)){setStatus("Enter a valid EVM wallet address.");return;}
  const selected=getAddress(target).toLowerCase();
  await save({action:"mute",target:selected});setTarget("");
 }
 return <section className="social-card lk-m18-section">
  <h2>Account controls</h2>
  <p>Your notification categories and muted creators are private to your signed-in wallet. Muted accounts are excluded from your feed, discovery and notifications, without blocking them for other people.</p>
  {status&&<p role="status">{status}</p>}
  {data&&<><fieldset className="lk-m18-settings"><legend>On-platform alerts</legend>
   {(["follows","comments","likes","reposts"] as const).map(kind=>
    <label key={kind}><input type="checkbox" checked={data.preferences[kind]}
      disabled={busy} onChange={e=>{setData(previous=>previous?{
       ...previous,preferences:{...previous.preferences,[kind]:e.target.checked}}:previous);}}/>
     {kind.charAt(0).toUpperCase()+kind.slice(1)}</label>)}
    <button type="button" disabled={busy} onClick={()=>{void save({
     action:"preferences",preferences:data.preferences,
    });}}>Save notification choices</button>
   </fieldset>
   <h3>Muted creators</h3>
   <form onSubmit={e=>{e.preventDefault();void muteTarget();}} className="lk-m18-inline">
    <input aria-label="Wallet to mute" placeholder="0x creator wallet to mute"
     value={target} onChange={e=>setTarget(e.target.value)} disabled={busy}/>
    <button type="submit" disabled={busy||!target.trim()}>Mute wallet</button>
   </form>
   {data.mutes.length===0?<p>No muted creators on this wallet.</p>:
    data.mutes.map(item=><div className="lk-m18-list lk-m18-inline" key={item.address}>
     <span>@{item.handle} <small>{item.display_name}</small></span>
     <button type="button" disabled={busy}
       onClick={()=>{void save({action:"unmute",target:item.address});}}>Unmute</button>
    </div>)}
  </>}
 </section>;
}

type Media={id:string;author:string;handle:string;body:string;media_url:string;
 media_kind:string;created_at:string};
type Report={id:string;target_type:"post"|"comment";target_id:string;reporter_handle:string;
 reason:string;details:string;created_at:string;target_body:string|null};
type Audit={action:string;target_id:string;created_at:string;reason:string};
type Queue={authorized:boolean;media:Media[];reports:Report[];recentActions:Audit[]};
export function ModerationConsole(){
 const [data,setData]=useState<Queue|null>(null);
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("Checking moderator authorization…");
 const load=useCallback(async()=>{
  try{const result=await read<Queue>("/api/social/moderation");
   setData(result);setStatus("");}
  catch(e){setData(null);setStatus(errorText(e));}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function apply(endpoint:string,input:Record<string,unknown>){
  if(!reason.trim()||reason.trim().length<8){setStatus("Give a review reason of at least 8 characters.");return;}
  setBusy(true);setStatus("");
  try{await submit(endpoint,endpoint==="/api/social/moderation"?input:
    {...input,reason:reason.trim()});
   setStatus("Decision recorded in the moderator audit trail.");await load();
  }catch(e){setStatus(errorText(e));}finally{setBusy(false);}
 }
 return <section className="social-card lk-m18-section">
  <h2>Moderator review queue</h2>
  <p>Restricted to operator-approved moderator wallets. Decisions require a reason and are recorded in PostgreSQL. No automatic media approval or synthetic reports.</p>
  {status&&<p role="status">{status}</p>}
  {data&&<>
   <label className="lk-m18-reason">Decision explanation (minimum 8 characters)
    <textarea value={reason} minLength={8} maxLength={500} disabled={busy}
     placeholder="Explain the verified moderation decision" onChange={e=>setReason(e.target.value)}/>
   </label>
   <h3>Unreviewed hosted media ({data.media.length})</h3>
   {data.media.length===0?<p>No media pending review.</p>:
    data.media.map(item=><article key={item.id} className="lk-m18-list">
     <strong>@{item.handle} · {item.media_kind} upload</strong>
     <p>{item.body}</p>
     <a href={item.media_url} target="_blank" rel="noopener noreferrer">Inspect provider-hosted file in new tab ↗</a>
     <small>{new Date(item.created_at).toLocaleString()}</small>
     <div className="lk-m18-inline">
      <button type="button" disabled={busy} onClick={()=>{void apply("/api/social",{
       action:"moderate",operation:"approve_media",targetId:item.id,
      });}}>Approve media</button>
      <button type="button" disabled={busy} onClick={()=>{void apply("/api/social",{
       action:"moderate",operation:"reject_media",targetId:item.id,
      });}}>Reject media</button>
     </div>
    </article>)}
   <h3>Unresolved community reports ({data.reports.length})</h3>
   {data.reports.length===0?<p>No unresolved reports.</p>:
    data.reports.map(item=><article key={item.id} className="lk-m18-list">
     <strong>{item.target_type} reported by @{item.reporter_handle}</strong>
     <p>{item.reason}{item.details?": "+item.details:""}</p>
     <p className="lk-m18-report-text">{item.target_body||"Reported target is unavailable."}</p>
     <div className="lk-m18-inline">
      <button type="button" disabled={busy} onClick={()=>{void apply("/api/social/moderation",{
       action:"resolve_report",reportId:item.id,decision:"dismissed",
       explanation:reason.trim(),
      });}}>Dismiss with audit</button>
      <button type="button" disabled={busy} onClick={()=>{void apply("/api/social/moderation",{
       action:"resolve_report",reportId:item.id,decision:"actioned",
       explanation:reason.trim(),
      });}}>Hide reported content</button>
     </div>
    </article>)}
   <h3>Recent moderation actions</h3>
   {data.recentActions.map((entry,i)=><div className="lk-m18-list" key={entry.target_id+entry.action+i}>
    <strong>{entry.action}</strong><small>{entry.reason} · {new Date(entry.created_at).toLocaleString()}</small>
   </div>)}
  </>}
 </section>;
}
