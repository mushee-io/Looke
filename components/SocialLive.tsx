"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Heart, Plus, Send, UserRound, Wallet, Loader2, Check, Pencil, Trash2, Flag } from "lucide-react";
import { PostInteractions } from "@/components/PostInteractions";

type LivePost = {
  id:string;text:string;author:string;author_handle?:string|null;author_id:string;
  created_at:string;edited_at?:string|null;likes:number;comments:number;reposts:number;is_owner?:boolean;user_reposted?:boolean;
  user_liked?:boolean;user_following?:boolean;
};
type FeedResult={posts:LivePost[];nextCursor:string|null};
async function jsonOrError(response:Response) {
 const data=await response.json();
 if(!response.ok)throw new Error(data?.error??"Request failed");
 return data;
}

export function SocialLive({ authenticated, onRequireLogin }:{authenticated:boolean;onRequireLogin:()=>void}) {
 const [posts,setPosts]=useState<LivePost[]>([]);
 const [cursor,setCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(false);
 const [loadingMore,setLoadingMore]=useState(false);
 const [unavailable,setUnavailable]=useState(false);
 const [text,setText]=useState("");
 const [draftReady,setDraftReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [mutationBusy,setMutationBusy]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [editText,setEditText]=useState("");
 const [pendingDelete,setPendingDelete]=useState<string|null>(null);
 const [reportId,setReportId]=useState<string|null>(null);
 const [reportReason,setReportReason]=useState("spam");
 const [notice,setNotice]=useState("");

 useEffect(()=>{
   try{setText(window.localStorage.getItem("looke:social-draft")??"");}
   catch{setText("");}
   setDraftReady(true);
 },[]);
 useEffect(()=>{
   if(!draftReady)return;
   try{window.localStorage.setItem("looke:social-draft",text);}
   catch{/* Browser may have storage disabled. */}
 },[text,draftReady]);

 async function fetchFeed(next:string|null=null,append=false) {
   if(append)setLoadingMore(true);else setLoading(true);
   try {
     const path="/api/posts"+(next?"?cursor="+encodeURIComponent(next):"");
     const data=await jsonOrError(await fetch(path,{cache:"no-store"})) as FeedResult;
     let list=data.posts;
     if(!append && typeof window!=="undefined") {
       const requested=new URLSearchParams(window.location.search).get("post");
       if(requested && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(requested) &&
          !list.some(p=>p.id.toLowerCase()===requested.toLowerCase())) {
         try {
           const single=await jsonOrError(await fetch("/api/posts/"+encodeURIComponent(requested),{cache:"no-store"}));
           list=[single.post as LivePost,...list];
         }catch {/* Missing or moderated shared post: show the public feed only. */}
       }
     }
     setPosts(current=>append ? [...current,...list.filter(x=>!current.some(p=>p.id===x.id))] : list);
     setCursor(data.nextCursor);
     setUnavailable(false);
   }catch(e){
     if(!append){setPosts([]);setCursor(null);setUnavailable(true);}
     setNotice(e instanceof Error?e.message:"Feed unavailable");
   }finally{setLoading(false);setLoadingMore(false);}
 }
 useEffect(()=>{void fetchFeed();},[authenticated]);

 async function publish(event:FormEvent<HTMLFormElement>) {
   event.preventDefault();
   if(!text.trim()||busy||unavailable)return;
   setBusy(true);setNotice("");
   try{
     await jsonOrError(await fetch("/api/posts",{
       method:"POST",headers:{"content-type":"application/json"},
       body:JSON.stringify({text})
     }));
     setText("");
     setNotice("Published a text post to Looke. No coin or NFT was created.");
     await fetchFeed();
   }catch(e){setNotice(e instanceof Error?e.message:"Could not publish");}
   finally{setBusy(false);}
 }
 async function interact(post:LivePost,kind:"like"|"follow") {
   if(!authenticated){onRequireLogin();return;}
   setMutationBusy(true);setNotice("");
   try{
     const response=await fetch(kind==="like"?"/api/likes":"/api/follows",{
       method:"POST",headers:{"content-type":"application/json"},
       body:JSON.stringify(kind==="like"?{postId:post.id,liked:!post.user_liked}:{profileId:post.author_id,follow:!post.user_following})
     });
     await jsonOrError(response);
     await fetchFeed();
   }catch(e){setNotice(e instanceof Error?e.message:"Action failed");}
   finally{setMutationBusy(false);}
 }
 async function saveEdit(event:FormEvent<HTMLFormElement>,post:LivePost) {
   event.preventDefault();
   if(mutationBusy||!post.is_owner)return;
   setMutationBusy(true);setNotice("");
   try{
     await jsonOrError(await fetch("/api/posts/"+encodeURIComponent(post.id),{
       method:"PATCH",headers:{"content-type":"application/json"},
       body:JSON.stringify({text:editText})
     }));
     setEditingId(null);setNotice("Post updated.");await fetchFeed();
   }catch(e){setNotice(e instanceof Error?e.message:"Could not edit post");}
   finally{setMutationBusy(false);}
 }
 async function removePost(post:LivePost) {
   if(!post.is_owner||pendingDelete!==post.id||mutationBusy)return;
   setMutationBusy(true);setNotice("");
   try{
     await jsonOrError(await fetch("/api/posts/"+encodeURIComponent(post.id),{method:"DELETE"}));
     setPendingDelete(null);setNotice("Your post was permanently deleted.");await fetchFeed();
   }catch(e){setNotice(e instanceof Error?e.message:"Could not delete post");}
   finally{setMutationBusy(false);}
 }
 async function reportPost(event:FormEvent<HTMLFormElement>,post:LivePost) {
   event.preventDefault();
   if(!authenticated){onRequireLogin();return;}
   if(post.is_owner||mutationBusy)return;
   setMutationBusy(true);setNotice("");
   try{
     await jsonOrError(await fetch("/api/posts/"+encodeURIComponent(post.id)+"/report",{
       method:"POST",headers:{"content-type":"application/json"},
       body:JSON.stringify({reason:reportReason})
     }));
     setReportId(null);
     setNotice("Report submitted for moderator review. The post has not been automatically removed.");
   }catch(e){setNotice(e instanceof Error?e.message:"Could not submit report");}
   finally{setMutationBusy(false);}
 }

 return <section aria-label="Persistent Looke social feed" style={{margin:"24px 0 30px"}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12}}>
   <div><strong style={{fontSize:19}}>Looke Social</strong>
     <div style={{fontSize:12,opacity:.65}}>Real text posts · no token creation · creator-controlled publishing</div></div>
   <span style={{fontSize:11,background:"#f0f0f0",borderRadius:30,padding:"5px 10px"}}>{unavailable?"Backend offline":"Persistent feed"}</span>
  </div>
  {authenticated?<form onSubmit={publish} style={{border:"1px solid #e9e9e9",borderRadius:14,padding:16,marginBottom:14}}>
   <textarea aria-label="Write a text post" style={{width:"100%",border:"none",minHeight:70,resize:"vertical",font:"inherit",outline:"none"}}
     required minLength={1} maxLength={1200} placeholder="What's happening on Ultra?"
     value={text} onChange={e=>setText(e.target.value)}/>
   <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
     <span style={{fontSize:12,opacity:.65}}>{Array.from(text).length}/1200 · Draft saved in this browser</span>
     <button disabled={busy||!text.trim()||unavailable} className="primary-button" type="submit">
      {busy?<Loader2 size={15}/>:<Send size={15}/>} Publish text
     </button>
   </div>
   <p style={{fontSize:11,color:"#888",margin:"10px 0 0"}}>Image/video uploads will be enabled only after storage, safety screening and moderator review are configured.</p>
  </form>:<button type="button" className="subtle-cta" onClick={onRequireLogin}><Wallet size={16}/> Sign in with Ultra EVM to publish</button>}
  {notice&&<p role="status" style={{fontSize:13,margin:"12px 0",overflowWrap:"anywhere"}}>{notice}</p>}
  {unavailable?<p style={{fontSize:13,opacity:.65,marginTop:14}}>Live social publishing is unavailable until the database and feed migration are configured. Sample posts remain below.</p>
   :loading?<p role="status" style={{fontSize:13,opacity:.65}}>Loading creator posts…</p>
   :posts.length?posts.map(post=><article key={post.id} style={{border:"1px solid #eee",borderRadius:14,padding:16,marginTop:12}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <span style={{display:"inline-flex",width:32,height:32,alignItems:"center",justifyContent:"center",background:"#f1f1f1",borderRadius:99}}><UserRound size={17}/></span>
      <div style={{flex:1,minWidth:0}}>
        {post.author_handle?<a href={"/creators/"+encodeURIComponent(post.author_handle)} style={{fontWeight:700,textDecoration:"underline"}}>{post.author}</a>:<strong>{post.author}</strong>}
        <div style={{fontSize:11,opacity:.62}}>{new Date(post.created_at).toLocaleString()}{post.edited_at?" · Edited":""}</div>
      </div>
      {!post.is_owner&&<button type="button" disabled={mutationBusy} onClick={()=>void interact(post,"follow")} style={{fontSize:12,padding:8,display:"inline-flex",alignItems:"center",gap:5}}><Plus size={13}/> {post.user_following?"Following":"Follow"}</button>}
    </div>
    {editingId===post.id?<form onSubmit={e=>void saveEdit(e,post)}>
      <textarea aria-label="Edit your post" required maxLength={1200} rows={4} style={{width:"100%",border:"1px solid #ddd",borderRadius:8,padding:12}} value={editText} onChange={e=>setEditText(e.target.value)}/>
      <div style={{display:"flex",gap:10,marginTop:10}}>
        <button type="submit" className="primary-button" disabled={mutationBusy||!editText.trim()}>Save edit</button>
        <button type="button" className="subtle-cta" onClick={()=>setEditingId(null)}>Cancel</button>
      </div>
    </form>:<p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.55}}>{post.text}</p>}
    <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:10}}>
      <button type="button" disabled={mutationBusy} onClick={()=>void interact(post,"like")}
        style={{display:"inline-flex",alignItems:"center",gap:6,opacity:.8,fontSize:12}} aria-label={post.user_liked?"Unlike post":"Like post"}>
        <Heart size={16} fill={post.user_liked?"currentColor":"none"}/>{post.likes}
      </button>
      {post.is_owner?<>
        <button type="button" disabled={mutationBusy} onClick={()=>{setEditingId(post.id);setEditText(post.text);setPendingDelete(null);}} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
          <Pencil size={15}/> Edit
        </button>
        {pendingDelete!==post.id?
          <button type="button" disabled={mutationBusy} onClick={()=>setPendingDelete(post.id)} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}><Trash2 size={15}/> Delete</button>:
          <span style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12,flexWrap:"wrap"}}>Delete permanently?
            <button type="button" disabled={mutationBusy} onClick={()=>void removePost(post)} style={{color:"#b42546",fontWeight:700}}>Confirm</button>
            <button type="button" onClick={()=>setPendingDelete(null)}>Cancel</button>
          </span>}
      </>:<button type="button" disabled={mutationBusy} onClick={()=>{if(!authenticated){onRequireLogin();return;}setReportId(reportId===post.id?null:post.id);}} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
        <Flag size={15}/> Report
      </button>}
    </div>
    {reportId===post.id&&!post.is_owner&&<form onSubmit={e=>void reportPost(e,post)} style={{marginTop:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <label style={{fontSize:12}}>Reason <select aria-label="Report reason" value={reportReason} onChange={e=>setReportReason(e.target.value)}>
        <option value="spam">Spam</option><option value="harassment">Harassment</option>
        <option value="impersonation">Impersonation</option><option value="illegal_content">Illegal content</option>
        <option value="other">Other</option>
      </select></label>
      <button className="subtle-cta" type="submit" disabled={mutationBusy}>Submit report</button>
      <button type="button" onClick={()=>setReportId(null)}>Cancel</button>
    </form>}
    <PostInteractions post={post} authenticated={authenticated} onRequireLogin={onRequireLogin}
      onChanged={()=>fetchFeed()} onNotice={setNotice}/>
   </article>):<p style={{fontSize:13,opacity:.65,marginTop:14}}>No public posts yet. Be the first creator.</p>}
  {cursor&&!unavailable&&<button className="subtle-cta" style={{marginTop:16}} disabled={loadingMore} onClick={()=>void fetchFeed(cursor,true)}>
    {loadingMore?"Loading…":"Load more posts"}
  </button>}
 </section>;
}

export function ProfileEditor({authenticated,onLogin}:{authenticated:boolean;onLogin:()=>void}) {
  const [handle,setHandle]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [bio,setBio]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [publicHandle,setPublicHandle]=useState("");
  useEffect(()=>{
    if(!authenticated){setPublicHandle("");return;}
    fetch("/api/profile",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{
      if(d?.profile){setHandle(d.profile.handle||"");setPublicHandle(d.profile.handle||"");setDisplayName(d.profile.display_name||"");setBio(d.profile.bio||"");}
    }).catch(()=>{});
  },[authenticated]);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setNotice("");
    try{
      const result=await jsonOrError(await fetch("/api/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({handle,displayName,bio})}));
      setPublicHandle(result.profile?.handle||"");
      setHandle(result.profile?.handle||handle);
      setNotice("Creator profile saved.");
    }catch(e){setNotice(e instanceof Error?e.message:"Could not save profile");}
    finally{setBusy(false);}
  }
  if(!authenticated)return <p style={{fontSize:13,opacity:.7,margin:"20px 0"}}>Sign in with an Ultra EVM testnet wallet to activate your persistent creator profile. <button onClick={onLogin}>Sign in</button></p>;
  return <form onSubmit={save} style={{border:"1px solid #eee",borderRadius:16,padding:20,margin:"24px 0",display:"grid",gap:12}}>
    <strong>Edit your on-platform creator profile</strong>
    {publicHandle&&<a href={"/creators/"+encodeURIComponent(publicHandle)} style={{fontSize:12,fontWeight:700,textDecoration:"underline"}}>View your public creator profile (@{publicHandle})</a>}
    <label>Handle <input required pattern="[a-z][a-z0-9_]{2,29}" maxLength={30} value={handle} onChange={e=>setHandle(e.target.value)} placeholder="yourhandle"/></label>
    <small style={{color:"#888"}}>3–30 lowercase characters, starting with a letter. Admin, official and other reserved handles are unavailable.</small>
    <label>Display name <input maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/></label>
    <label>Bio <textarea maxLength={280} rows={3} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell creators about yourself"/></label>
    <button className="primary-button" disabled={busy} type="submit"><Check size={15}/> Save creator profile</button>
    {notice&&<small role="status">{notice}</small>}
  </form>;
}
