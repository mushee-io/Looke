"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Users } from "lucide-react";
import { creatorProfilePath } from "@/lib/creator-profile.mjs";

type Creator = { id:string;handle:string;display_name:string|null;bio:string|null;followers:number;posts:number };

export function CreatorDirectory() {
  const [creators,setCreators]=useState<Creator[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"unavailable">("loading");
  useEffect(()=>{
    let active=true;
    fetch("/api/creators",{cache:"no-store"})
      .then(async response=>{
        const data=await response.json();
        if(!response.ok)throw new Error(data?.error??"Directory unavailable");
        return data.creators as Creator[];
      })
      .then(items=>{if(active){setCreators(items);setStatus("ready");}})
      .catch(()=>{if(active)setStatus("unavailable");});
    return()=>{active=false;};
  },[]);
  return <section aria-label="Real Looke creator directory" style={{margin:"45px 0 20px"}}>
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:15}}>
      <Users size={19}/><h2 style={{fontSize:21,margin:0}}>Meet the creators</h2>
      <span style={{marginLeft:"auto",fontSize:11,opacity:.6}}>Real profiles only</span>
    </div>
    {status==="loading"?<p style={{fontSize:12,opacity:.6}}>Loading creator profiles…</p>:
     status==="unavailable"?<p style={{fontSize:12,opacity:.6}}>Creator directory isn't available until the social database is connected.</p>:
     creators.length===0?<p style={{fontSize:12,opacity:.6}}>No public creator profiles yet. Sign in and choose a unique handle to be the first.</p>:
     <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
       {creators.slice(0,6).map(c=><a key={c.id} href={creatorProfilePath(c.handle)}
         style={{border:"1px solid #ececec",borderRadius:13,padding:16,minWidth:0,textDecoration:"none"}}>
         <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
           <span aria-hidden style={{display:"grid",placeItems:"center",width:36,height:36,borderRadius:50,background:"#f0edfc",color:"#6252b7",fontWeight:700}}>{(c.display_name||c.handle)[0]?.toUpperCase()}</span>
           <span style={{minWidth:0}}><strong style={{display:"block",overflow:"hidden",textOverflow:"ellipsis"}}>{c.display_name||c.handle}</strong>
             <small style={{color:"#898989"}}>@{c.handle}</small></span><ArrowUpRight size={14} style={{marginLeft:"auto"}}/>
         </div>
         <p style={{fontSize:12,color:"#888",lineHeight:1.5,minHeight:34,overflowWrap:"anywhere"}}>{c.bio||"Looke creator on Ultra"}</p>
         <small style={{color:"#747474"}}>{c.followers} followers · {c.posts} posts</small>
       </a>)}
     </div>}
  </section>;
}
