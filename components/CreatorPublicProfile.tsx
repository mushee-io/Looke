"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, UserRound, Users } from "lucide-react";

type Creator = {
  id: string; handle:string; display_name:string|null;bio:string|null;created_at:string;
  followers:number;following:number;post_count:number;viewer_follows:boolean;
};
type Post = {id:string;text:string;created_at:string;likes:number};
type PublicProfile = {creator:Creator;posts:Post[];ownProfile:boolean};

export function CreatorPublicProfile({handle}:{handle:string}) {
  const [profile,setProfile]=useState<PublicProfile|null>(null);
  const [authenticated,setAuthenticated]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load() {
    const response=await fetch("/api/creators/"+encodeURIComponent(handle),{cache:"no-store"});
    const data=await response.json() as PublicProfile & {error?:string};
    if(!response.ok)throw new Error(data.error||"Creator profile unavailable");
    setProfile(data);
  }
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");setProfile(null);
    Promise.all([
      fetch("/api/creators/"+encodeURIComponent(handle),{cache:"no-store"}).then(async r=>{
        const d=await r.json();
        if(!r.ok)throw new Error(d.error||"Creator profile unavailable");
        return d as PublicProfile;
      }),
      fetch("/api/auth/me",{cache:"no-store"}).then(r=>r.json()).catch(()=>({authenticated:false}))
    ]).then(([data,session])=>{
      if(active){setProfile(data);setAuthenticated(session.authenticated===true);setLoading(false);}
    }).catch(e=>{if(active){setError(e instanceof Error?e.message:"Creator profile unavailable");setLoading(false);}});
    return()=>{active=false;};
  },[handle]);

  async function toggleFollow() {
    if(!profile||busy)return;
    if(!authenticated){setNotice("Sign in with your Ultra EVM wallet on Looke first.");return;}
    setBusy(true);setNotice("");
    try {
      const response=await fetch("/api/follows",{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({profileId:profile.creator.id,follow:!profile.creator.viewer_follows}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||"Could not change follow status");
      await load();
    }catch(e){setNotice(e instanceof Error?e.message:"Follow failed");}
    finally{setBusy(false);}
  }
  return <div className="creator-public-page">
    <div className="creator-public-shell">
      <a className="creator-back" href="/#feed"><ArrowLeft size={16}/> Back to Looke</a>
      {loading?<p role="status" className="creator-loading">Loading creator profile…</p>:
       error?<div role="alert" className="creator-not-found"><h1>Creator unavailable</h1><p>{error}</p><a href="/#explore">Explore Looke</a></div>:
       profile&&<>
         <div className="creator-cover" aria-hidden="true"><span/><span/></div>
         <div className="creator-head">
           <div className="creator-public-avatar" aria-hidden="true">{(profile.creator.display_name||profile.creator.handle)[0]?.toUpperCase()}</div>
           {!profile.ownProfile && <button className="creator-follow-button" type="button" disabled={busy} onClick={()=>void toggleFollow()}>
             {profile.creator.viewer_follows?<><Check size={16}/> Following</>:<><Users size={16}/> Follow</>}
           </button>}
           {profile.ownProfile && <a className="creator-follow-button" href="/#profile">Edit profile</a>}
         </div>
         <h1>{profile.creator.display_name||profile.creator.handle}</h1>
         <p className="creator-handle">@{profile.creator.handle}</p>
         <p className="creator-public-bio">{profile.creator.bio||"Building something on Ultra."}</p>
         <div className="creator-public-stats">
           <span><strong>{profile.creator.post_count}</strong> posts</span>
           <span><strong>{profile.creator.followers}</strong> followers</span>
           <span><strong>{profile.creator.following}</strong> following</span>
         </div>
         <p className="creator-member">Member since {new Date(profile.creator.created_at).toLocaleDateString(undefined,{month:"long",year:"numeric"})} · Real social activity; no token or NFT launch implied</p>
         {notice&&<p role="status" className="creator-notice">{notice} {!authenticated&&<a href="/#profile">Go to Looke</a>}</p>}
         <section aria-label="Creator's visible posts" className="creator-posts">
           <h2>Posts</h2>
           {profile.posts.length?profile.posts.map(post=><article className="creator-post" key={post.id}>
             <div className="creator-post-byline"><UserRound size={18}/><span>@{profile.creator.handle}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time></div>
             <p>{post.text}</p><small>{post.likes} likes · Social post, not a traded token</small>
           </article>):<p className="creator-empty">No public posts from this creator yet.</p>}
         </section>
       </>}
    </div>
  </div>;
}
