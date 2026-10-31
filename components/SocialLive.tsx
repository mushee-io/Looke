"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Heart, Plus, Send, UserRound, Wallet, Loader2, Check } from "lucide-react";

type LivePost = {id:string;text:string;author:string;author_id:string;evm_address:string;created_at:string;likes:number;user_liked?:boolean;user_following?:boolean};
async function jsonOrError(response: Response) {
  const data = await response.json();
  if(!response.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}
export function SocialLive({ authenticated, onRequireLogin }: { authenticated: boolean; onRequireLogin:()=>void }) {
  const [posts,setPosts]=useState<LivePost[]>([]);
  const [unavailable,setUnavailable]=useState(false);
  const [text,setText]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function refresh() {
    try {
      const result=await jsonOrError(await fetch("/api/posts",{cache:"no-store"}));
      setPosts(result.posts);setUnavailable(false);
    } catch {setUnavailable(true);}
  }
  useEffect(()=>{void refresh();},[authenticated]);
  async function publish(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!text.trim() || busy)return;
    setBusy(true);setNotice("");
    try {
      await jsonOrError(await fetch("/api/posts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text})}));
      setText("");setNotice("Published to Looke social feed (not tokenized).");await refresh();
    } catch(e){setNotice(e instanceof Error ? e.message : "Could not publish");}
    finally{setBusy(false);}
  }
  async function interact(post:LivePost,kind:"like"|"follow") {
    if(!authenticated){onRequireLogin();return;}
    try {
      const response=await fetch(kind==="like"?"/api/likes":"/api/follows",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify(kind==="like"?{postId:post.id,liked:!post.user_liked}:{profileId:post.author_id,follow:!post.user_following})
      });
      await jsonOrError(response);await refresh();
    }catch(e){setNotice(e instanceof Error?e.message:"Action failed");}
  }
  return <section aria-label="Persistent Looke social feed" style={{margin:"24px 0 30px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12}}>
      <div><strong style={{fontSize:19}}>Looke Social</strong><div style={{fontSize:12,opacity:.65}}>Authenticated posts · separate from coin launch</div></div>
      <span style={{fontSize:11,background:"#f0f0f0",borderRadius:30,padding:"5px 10px"}}>{unavailable?"Backend offline":"Persistent feed"}</span>
    </div>
    {authenticated?<form onSubmit={publish} style={{border:"1px solid #e9e9e9",borderRadius:14,padding:16,marginBottom:14}}>
      <textarea aria-label="Write a post" style={{width:"100%",border:"none",minHeight:70,resize:"vertical",font:"inherit",outline:"none"}} required minLength={1} maxLength={1200} placeholder="What's happening on Ultra?" value={text} onChange={e=>setText(e.target.value)}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <span style={{fontSize:12,opacity:.65}}>{text.length}/1200 · Text only, no token created</span>
        <button disabled={busy||!text.trim()||unavailable} className="primary-button" type="submit">{busy?<Loader2 size={15}/>:<Send size={15}/>} Publish</button>
      </div>
    </form>:<button type="button" className="subtle-cta" onClick={onRequireLogin}><Wallet size={16}/> Sign in with Ultra EVM to publish</button>}
    {notice&&<p role="status" style={{fontSize:13,margin:"12px 0"}}>{notice}</p>}
    {unavailable?<p style={{fontSize:13,opacity:.65,marginTop:14}}>Live social publishing is not configured. Set up the database and apply the migration. The sample feed below remains available.</p>
    :posts.length?posts.map(post=><article key={post.id} style={{border:"1px solid #eee",borderRadius:14,padding:16,marginTop:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{display:"inline-flex",width:32,height:32,alignItems:"center",justifyContent:"center",background:"#f1f1f1",borderRadius:99}}><UserRound size={17}/></span>
        <div style={{flex:1,minWidth:0}}><strong>{post.author}</strong><div style={{fontSize:11,opacity:.62}}>{new Date(post.created_at).toLocaleString()}</div></div>
        <button type="button" onClick={()=>void interact(post,"follow")} style={{fontSize:12,padding:8}}><Plus size={13}/> {post.user_following?"Following":"Follow"}</button>
      </div>
      <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",lineHeight:1.55}}>{post.text}</p>
      <button type="button" onClick={()=>void interact(post,"like")} style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,opacity:.8}} aria-label="Like post"><Heart size={16} fill={post.user_liked?"currentColor":"none"}/>{post.likes}</button>
    </article>):<p style={{fontSize:13,opacity:.65,marginTop:14}}>No live posts yet. Be the first creator.</p>}
  </section>;
}
export function ProfileEditor({authenticated,onLogin}:{authenticated:boolean;onLogin:()=>void}) {
  const [handle,setHandle]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [bio,setBio]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!authenticated)return;
    fetch("/api/profile",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{
      if(d?.profile){setHandle(d.profile.handle||"");setDisplayName(d.profile.display_name||"");setBio(d.profile.bio||"");}
    }).catch(()=>{});
  },[authenticated]);
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setNotice("");
    try{
      await jsonOrError(await fetch("/api/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({handle,displayName,bio})}));
      setNotice("Creator profile saved.");
    }catch(e){setNotice(e instanceof Error?e.message:"Could not save profile");}
    finally{setBusy(false);}
  }
  if(!authenticated)return <p style={{fontSize:13,opacity:.7,margin:"20px 0"}}>Sign in with an Ultra EVM testnet wallet to activate your persistent creator profile. <button onClick={onLogin}>Sign in</button></p>;
  return <form onSubmit={save} style={{border:"1px solid #eee",borderRadius:16,padding:20,margin:"24px 0",display:"grid",gap:12}}>
    <strong>Edit your on-platform creator profile</strong>
    <label>Handle <input required pattern="[a-z][a-z0-9_]{2,29}" maxLength={30} value={handle} onChange={e=>setHandle(e.target.value)} placeholder="yourhandle"/></label>
    <label>Display name <input maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/></label>
    <label>Bio <textarea maxLength={280} rows={3} value={bio} onChange={e=>setBio(e.target.value)} placeholder="Tell creators about yourself"/></label>
    <button className="primary-button" disabled={busy} type="submit"><Check size={15}/> Save creator profile</button>
    {notice&&<small role="status">{notice}</small>}
  </form>;
}
