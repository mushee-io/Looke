"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Repeat2, Share2, Trash2 } from "lucide-react";
import { sharePostPath } from "@/lib/social-interactions.mjs";

type Comment = {
 id:string;text:string;created_at:string;author:string;
 author_handle:string|null;is_owner:boolean;
};
type PostSummary = {
 id:string;comments:number;reposts:number;is_owner?:boolean;user_reposted?:boolean;
};
async function requestJson(response:Response) {
 const result=await response.json();
 if(!response.ok)throw new Error(result?.error??"Request failed");
 return result;
}

/**
 * DB-backed comment/repost/share widgets for a visible post.
 * Share uses a URL; it does not invoke blockchain spending or impersonate a repost.
 */
export function PostInteractions({post,authenticated,onRequireLogin,onChanged,onNotice}:{
 post:PostSummary;
 authenticated:boolean;
 onRequireLogin:()=>void;
 onChanged:()=>Promise<void>;
 onNotice:(message:string)=>void;
}) {
 const [expanded,setExpanded]=useState(false);
 const [items,setItems]=useState<Comment[]>([]);
 const [commentText,setCommentText]=useState("");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");

 async function loadComments() {
  setLoading(true);setError("");
  try {
   const result=await requestJson(await fetch("/api/posts/"+encodeURIComponent(post.id)+"/comments",{cache:"no-store"}));
   setItems(result.comments as Comment[]);
  }catch(e){setError(e instanceof Error?e.message:"Comments unavailable");}
  finally{setLoading(false);}
 }
 useEffect(()=>{
  if(expanded)void loadComments();
 },[expanded,authenticated,post.id]);

 async function toggleRepost() {
  if(!authenticated){onRequireLogin();return;}
  if(post.is_owner){onNotice("You cannot repost your own post.");return;}
  if(busy)return;
  setBusy(true);setError("");
  try {
   await requestJson(await fetch("/api/posts/"+encodeURIComponent(post.id)+"/repost",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({repost:!post.user_reposted})
   }));
   onNotice(post.user_reposted?"Removed from your reposts.":"Reposted. This is a social action, not a token trade.");
   await onChanged();
  }catch(e){setError(e instanceof Error?e.message:"Repost failed");}
  finally{setBusy(false);}
 }
 async function submitComment(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if(!authenticated){onRequireLogin();return;}
  if(!commentText.trim()||busy)return;
  setBusy(true);setError("");
  try {
   await requestJson(await fetch("/api/posts/"+encodeURIComponent(post.id)+"/comments",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({text:commentText}),
   }));
   setCommentText("");
   await Promise.all([loadComments(),onChanged()]);
   onNotice("Comment posted.");
  }catch(e){setError(e instanceof Error?e.message:"Could not comment");}
  finally{setBusy(false);}
 }
 async function deleteComment(id:string) {
  if(busy)return;
  setBusy(true);setError("");
  try{
   await requestJson(await fetch("/api/comments/"+encodeURIComponent(id),{method:"DELETE"}));
   await Promise.all([loadComments(),onChanged()]);
   onNotice("Comment removed.");
  }catch(e){setError(e instanceof Error?e.message:"Cannot remove comment");}
  finally{setBusy(false);}
 }
 async function share() {
  const url=window.location.origin+sharePostPath(post.id);
  try{
   if(typeof navigator.share==="function")await navigator.share({title:"Looke post",url});
   else await navigator.clipboard.writeText(url);
   onNotice("Post link shared or copied.");
  }catch(e){
   if(e instanceof Error && e.name==="AbortError")return;
   setError("Sharing isn't available; copy the URL from this page.");
  }
 }
 return <section aria-label="Post interactions" style={{marginTop:14}}>
  <div style={{display:"flex",alignItems:"center",gap:15,flexWrap:"wrap"}}>
   <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}
     style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
     <MessageCircle size={16}/> {post.comments} comments
   </button>
   <button type="button" aria-pressed={!!post.user_reposted} disabled={busy||!!post.is_owner}
     onClick={()=>void toggleRepost()} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12,color:post.user_reposted?"#16875e":undefined}}>
     <Repeat2 size={16}/> {post.reposts} reposts
   </button>
   <button type="button" onClick={()=>void share()}
     style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
     <Share2 size={16}/> Share
   </button>
  </div>
  {error&&<p role="alert" style={{fontSize:12,color:"#b42546",marginTop:8}}>{error}</p>}
  {expanded&&<div style={{borderTop:"1px solid #eee",paddingTop:13,marginTop:13}}>
   {authenticated?<form onSubmit={e=>void submitComment(e)}>
     <label style={{fontSize:12,fontWeight:700}} htmlFor={"comment-"+post.id}>Add a comment</label>
     <textarea id={"comment-"+post.id} value={commentText} onChange={e=>setCommentText(e.target.value)}
       maxLength={500} rows={2} placeholder="Write a respectful reply…"
       style={{width:"100%",marginTop:8,padding:10,border:"1px solid #ddd",borderRadius:8,font:"inherit",resize:"vertical"}}/>
     <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
       <small style={{color:"#777"}}>{Array.from(commentText).length}/500</small>
       <button type="submit" className="subtle-cta" disabled={busy||!commentText.trim()}>Post comment</button>
     </div>
   </form>:<button type="button" className="subtle-cta" onClick={onRequireLogin}>Sign in to comment</button>}
   {loading?<p role="status" style={{fontSize:12}}>Loading comments…</p>:
     items.length?items.map(comment=><article key={comment.id} style={{padding:"12px 0",borderBottom:"1px solid #eee"}}>
       <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:12}}>
         {comment.author_handle?<a href={"/creators/"+encodeURIComponent(comment.author_handle)}
           style={{fontWeight:700,textDecoration:"underline"}}>{comment.author}</a>:<strong>{comment.author}</strong>}
         <time dateTime={comment.created_at} style={{color:"#888",fontSize:11}}>{new Date(comment.created_at).toLocaleString()}</time>
       </div>
       <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",margin:"8px 0",fontSize:13,lineHeight:1.55}}>{comment.text}</p>
       {comment.is_owner&&<button type="button" disabled={busy} onClick={()=>void deleteComment(comment.id)}
         style={{display:"inline-flex",gap:5,alignItems:"center",fontSize:11,color:"#a83c57"}}>
         <Trash2 size={12}/> Remove my comment
       </button>}
     </article>):<p style={{fontSize:12,color:"#888",marginTop:12}}>No comments yet.</p>}
  </div>}
 </section>;
}
