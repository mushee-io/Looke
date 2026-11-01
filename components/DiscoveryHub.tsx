"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Search, Users, MessageSquareText } from "lucide-react";

type Creator = {
 id:string;handle:string;display_name:string|null;bio:string|null;followers:number;posts:number;
};
type Post = {
 id:string;text:string;author:string;author_handle:string|null;created_at:string;likes:number;comments:number;
};
type SearchResult={query:string;creators:Creator[];posts:Post[];error?:string};

/**
 * Full-text discovery backed by real public database rows, not demo market data.
 * Header search and local search both lead here; queries are never stored by Looke.
 */
export function DiscoveryHub({headerQuery}:{headerQuery:string}) {
 const [query,setQuery]=useState(headerQuery);
 const [results,setResults]=useState<SearchResult|null>(null);
 const [status,setStatus]=useState<"idle"|"searching"|"ready"|"error">("idle");
 const [error,setError]=useState("");
 useEffect(()=>{setQuery(headerQuery);},[headerQuery]);
 useEffect(()=>{
   const trimmed=query.trim();
   if(trimmed.length<2){setResults(null);setStatus("idle");setError("");return;}
   if(Array.from(trimmed).length>80){setResults(null);setStatus("error");setError("Search is limited to 80 characters.");return;}
   const controller=new AbortController();
   setStatus("searching");
   const delay=setTimeout(async()=>{
     try{
       const response=await fetch("/api/discovery/search?q="+encodeURIComponent(trimmed),{
         cache:"no-store",signal:controller.signal
       });
       const data=await response.json() as SearchResult;
       if(!response.ok)throw new Error(data.error||"Search unavailable");
       setResults(data);setStatus("ready");setError("");
     }catch(e){
       if(controller.signal.aborted)return;
       setResults(null);setStatus("error");setError(e instanceof Error?e.message:"Search unavailable");
     }
   },300);
   return()=>{controller.abort();clearTimeout(delay);};
 },[query]);

 return <section aria-label="Find real Looke creators and posts" style={{margin:"40px 0 25px",padding:"24px",border:"1px solid #ebebf0",borderRadius:15}}>
   <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}><Search size={19}/>
     <h2 style={{fontSize:21,margin:0}}>Search Looke creators & posts</h2>
   </div>
   <p style={{fontSize:12,color:"#888",margin:"5px 0 15px"}}>Search real public social content. Fictional demo coin prices above are not included.</p>
   <label style={{display:"block",fontSize:12,fontWeight:700}}>
     <span>Search creator names, handles or post text</span>
     <input value={query} onChange={e=>setQuery(e.target.value)} maxLength={81}
       placeholder="Try Ultra, gaming, or your favorite creator"
       style={{marginTop:8,width:"100%",padding:"13px 14px",border:"1px solid #dcdce4",borderRadius:9,font:"inherit"}}/>
   </label>
   {status==="idle"&&<p style={{fontSize:12,color:"#9696a0",marginTop:12}}>Enter at least two characters to search.</p>}
   {status==="searching"&&<p role="status" style={{fontSize:12,color:"#888",marginTop:12}}>Searching published content…</p>}
   {status==="error"&&<p role="alert" style={{fontSize:12,color:"#b42546",marginTop:12}}>{error}</p>}
   {status==="ready"&&results&&<div role="region" aria-label="Public discovery results">
     <div style={{marginTop:23}}><h3 style={{fontSize:15,marginBottom:11}}><Users size={16} style={{display:"inline",verticalAlign:"middle",marginRight:7}}/>Creators ({results.creators.length})</h3>
       {results.creators.length===0?<p style={{color:"#888",fontSize:12}}>No public creators match yet.</p>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(215px,1fr))",gap:10}}>
        {results.creators.map(c=><a key={c.id} href={"/creators/"+encodeURIComponent(c.handle)}
          style={{border:"1px solid #eee",borderRadius:11,padding:13,textDecoration:"none",overflowWrap:"anywhere"}}>
          <strong style={{fontSize:13,display:"block"}}>{c.display_name||c.handle} <ArrowUpRight size={13} style={{display:"inline"}}/></strong>
          <small style={{color:"#8379a4"}}>@{c.handle}</small>
          <p style={{fontSize:12,color:"#888",margin:"8px 0"}}>{c.bio||"Looke creator"}</p>
          <small style={{color:"#777"}}>{c.followers} followers · {c.posts} posts</small>
        </a>)}
        </div>}
     </div>
     <div style={{marginTop:24}}><h3 style={{fontSize:15,marginBottom:10}}><MessageSquareText size={16} style={{display:"inline",verticalAlign:"middle",marginRight:7}}/>Posts ({results.posts.length})</h3>
       {results.posts.length===0?<p style={{fontSize:12,color:"#888"}}>No visible public posts match yet.</p>:
       results.posts.map(p=><a key={p.id} href={"/?post="+encodeURIComponent(p.id)+"#feed"}
         style={{display:"block",borderTop:"1px solid #eee",padding:"14px 0",textDecoration:"none"}}>
         <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
           <strong style={{fontSize:12}}>{p.author}</strong>
           <small style={{fontSize:11,color:"#999"}}>{new Date(p.created_at).toLocaleDateString()}</small>
         </div>
         <p style={{margin:"7px 0",fontSize:13,whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.5}}>{p.text.length>240?p.text.slice(0,240)+"…":p.text}</p>
         <small style={{fontSize:11,color:"#888"}}>{p.likes} likes · {p.comments} comments</small>
       </a>)}
     </div>
     <p style={{fontSize:11,color:"#aaa",marginTop:17}}>Showing up to 12 matching creators and 20 matching posts; no search history is retained in Looke.</p>
   </div>}
 </section>;
}
