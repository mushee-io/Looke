"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getAddress, isAddress } from "viem";
import "./social.css";

type Wallet = {request:(args:{method:string;params?:unknown[]})=>Promise<unknown>};
type User = {address:string;handle:string;suspended:boolean};
type Profile = {address:string;handle:string;display_name:string;bio:string;avatar_url:string|null;created_at:string;follower_count?:number;following_count?:number;is_following?:boolean};
type Post = {id:string;author:string;body:string;asset_chain:string|null;asset_type:string|null;asset_id:string|null;created_at:string;handle:string;display_name:string;avatar_url:string|null;comment_count:number;follower_count:number};
type Comment = {id:string;post_id:string;author:string;body:string;created_at:string;handle:string;display_name:string};
type Tab = "feed"|"discover"|"profile"|"messages";

function injected():Wallet|null {return typeof window==="undefined"?null:((window as Window&{ethereum?:Wallet}).ethereum??null);}
function errText(error:unknown){return error instanceof Error?error.message:"Request failed. Try again.";}
async function get<T>(params:Record<string,string>){
  const res=await fetch(`/api/social?${new URLSearchParams(params)}`,{cache:"no-store"});
  const body=await res.json() as T&{error?:string};
  if(!res.ok)throw new Error(body.error||"Social network is unavailable.");
  return body;
}
async function post<T>(endpoint:"social"|"auth",body:Record<string,unknown>){
  const res=await fetch(endpoint==="social"?"/api/social":"/api/social/auth",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),
    credentials:"same-origin",cache:"no-store",
  });
  const data=await res.json() as T&{error?:string};
  if(!res.ok)throw new Error(data.error||"Social action could not be completed.");
  return data;
}
function dateLabel(raw:string){const d=new Date(raw);return Number.isNaN(d.getTime())?"Unknown date":d.toLocaleString();}
function abbrev(wallet:string){return wallet.length>14?`${wallet.slice(0,7)}…${wallet.slice(-5)}`:wallet;}
function AssetBadge({item}:{item:Post}){
  if(!item.asset_type||!item.asset_id)return null;
  const label=item.asset_type==="token"?"Ultra EVM · Creator token":"Ultra native · Uniq NFT";
  const url=item.asset_type==="token"?`https://evmexplorer.testnet.ultra.io/address/${item.asset_id}`:null;
  return <div className="social-asset"><span>◇ {label}</span><strong>{item.asset_type==="uniq"?`#${item.asset_id}`:abbrev(item.asset_id)}</strong>
    {url&&<a href={url} rel="noopener noreferrer" target="_blank">View reference ↗</a>}
    <small>Community reference only · Ownership and price not verified by this post</small></div>;
}

export default function SocialPage(){
  const [user,setUser]=useState<User|null>(null);
  const [tab,setTab]=useState<Tab>("feed");
  const [mode,setMode]=useState<"global"|"following">("global");
  const [working,setWorking]=useState(false);
  const [notice,setNotice]=useState("");
  const [backendStatus,setBackendStatus]=useState<"checking"|"online"|"unconfigured">("checking");
  const [feed,setFeed]=useState<Post[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [directory,setDirectory]=useState<Profile[]>([]);
  const [focused,setFocused]=useState<Profile|null>(null);
  const [myProfile,setMyProfile]=useState<Profile|null>(null);
  const [draftHandle,setDraftHandle]=useState("");
  const [draftName,setDraftName]=useState("");
  const [draftBio,setDraftBio]=useState("");
  const [draftAvatar,setDraftAvatar]=useState("");
  const [newPost,setNewPost]=useState("");
  const [assetType,setAssetType]=useState<"none"|"token"|"uniq">("none");
  const [assetId,setAssetId]=useState("");
  const [commentFor,setCommentFor]=useState("");
  const [comments,setComments]=useState<Comment[]>([]);
  const [commentText,setCommentText]=useState("");

  const refreshMe=useCallback(async()=>{
    const response=await fetch("/api/social/auth",{cache:"no-store"});
    const data=await response.json() as {authenticated:boolean;user:User|null;error?:string};
    if(response.ok){setUser(data.user);setBackendStatus("online");}
    else {setBackendStatus("unconfigured");throw new Error(data.error||"Social API unavailable.");}
    if(data.user){
      try{
        const result=await get<{profile:Profile}>({action:"me"});
        setMyProfile(result.profile);
        setDraftHandle(result.profile?.handle||"");setDraftName(result.profile?.display_name||"");
        setDraftBio(result.profile?.bio||"");setDraftAvatar(result.profile?.avatar_url||"");
      }catch(e){setNotice(errText(e));}
    }else{setMyProfile(null);}
  },[]);

  const loadFeed=useCallback(async(append=false,nextCursor?:string|null)=>{
    const params:Record<string,string>={action:"feed",scope:mode};
    if(append&&nextCursor)params.cursor=nextCursor;
    try{
      const data=await get<{posts:Post[];nextCursor:string|null}>(params);
      setFeed(previous=>append?[...previous,...data.posts.filter(p=>!previous.some(x=>x.id===p.id))]:data.posts);
      setCursor(data.nextCursor);
      setBackendStatus("online");
    }catch(error){if(!append){setFeed([]);setCursor(null);}setBackendStatus("unconfigured");setNotice(errText(error));}
  },[mode]);

  const lookupDirectory=useCallback(async(value:string)=>{
    try{
      const r=await get<{profiles:Profile[]}>({action:"directory",search:value});
      setDirectory(r.profiles);
    }catch(e){setNotice(errText(e));}
  },[]);

  useEffect(()=>{void refreshMe().catch(e=>setNotice(errText(e)));},[refreshMe]);
  useEffect(()=>{void loadFeed();},[loadFeed]);
  useEffect(()=>{if(tab==="discover")void lookupDirectory(search);},[tab,lookupDirectory,search]);

  async function signIn(){
    const wallet=injected();
    if(!wallet){setNotice("An injected EVM wallet is required for Looke social sign-in.");return;}
    setWorking(true);setNotice("");
    try{
      const accounts=await wallet.request({method:"eth_requestAccounts"}) as string[];
      if(!accounts?.[0]||!isAddress(accounts[0]))throw new Error("Wallet did not provide an EVM account.");
      let chain=String(await wallet.request({method:"eth_chainId"})).toLowerCase();
      if(chain!=="0x49c1"){
        try{await wallet.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x49c1"}]});}
        catch(e){
          if((e as {code?:number})?.code!==4902)throw e;
          await wallet.request({method:"wallet_addEthereumChain",params:[{
            chainId:"0x49c1",chainName:"Ultra EVM Testnet",rpcUrls:["https://evm.test.ultra.eosusa.io"],
            nativeCurrency:{name:"Ultra",symbol:"UOS",decimals:18},
          }]});
        }
        chain=String(await wallet.request({method:"eth_chainId"})).toLowerCase();
      }
      if(chain!=="0x49c1")throw new Error("Ultra EVM Testnet is required for this social sign-in.");
      const walletAddress=getAddress(accounts[0]);
      const challenge=await post<{challengeId:string;message:string}>("auth",{action:"challenge",address:walletAddress});
      const signature=await wallet.request({method:"personal_sign",params:[challenge.message,walletAddress]});
      if(typeof signature!=="string")throw new Error("Wallet did not sign the challenge.");
      await post("auth",{action:"verify",challengeId:challenge.challengeId,signature});
      await refreshMe();
      await loadFeed();
      setNotice("Wallet sign-in verified. No token approval or blockchain transaction was performed.");
    }catch(e){setNotice(errText(e));}
    finally{setWorking(false);}
  }

  async function signOut(){
    setWorking(true);setNotice("");
    try{await post("auth",{action:"logout"});setUser(null);setMyProfile(null);setFocused(null);setNotice("Signed out.");}
    catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  async function updateProfile(e:FormEvent){
    e.preventDefault();if(!user)return;
    setWorking(true);setNotice("");
    try{
      await post("social",{action:"profile",handle:draftHandle,displayName:draftName,bio:draftBio,avatarUrl:draftAvatar});
      await refreshMe();setNotice("Profile saved to Looke social database.");
    }catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  async function publish(e:FormEvent){
    e.preventDefault();if(!user)return;
    setWorking(true);setNotice("");
    try{
      const asset=assetType==="none"?null:assetType==="token"
        ?{assetType:"token",assetChain:"ultra-evm",assetId}
        :{assetType:"uniq",assetChain:"ultra-native",assetId};
      await post("social",{action:"post",body:newPost,asset});
      setNewPost("");setAssetType("none");setAssetId("");
      setMode("global");await loadFeed();setNotice("Post published.");
    }catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  async function viewComments(postId:string){
    setNotice("");setCommentFor(postId);setCommentText("");
    try{const data=await get<{comments:Comment[]}>({action:"comments",postId});setComments(data.comments);}
    catch(e){setNotice(errText(e));setComments([]);}
  }

  async function addComment(e:FormEvent){
    e.preventDefault();if(!commentFor||!user)return;
    setWorking(true);
    try{
      await post("social",{action:"comment",postId:commentFor,body:commentText});
      setCommentText("");await viewComments(commentFor);await loadFeed();
      setNotice("Comment published.");
    }catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  async function followUser(target:string,action:"follow"|"unfollow"|"block"){
    if(!user)return;
    setWorking(true);setNotice("");
    try{
      await post("social",{action,target});
      if(action==="block"){setFocused(null);setNotice("User blocked. Their posts and replies are excluded from your feed.");}
      else setNotice(action==="follow"?"Following profile.":"Unfollowed profile.");
      if(focused)await openProfile(focused.handle);
      await loadFeed();
    }catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  async function openProfile(profileHandle:string){
    try{
      const r=await get<{profile:Profile}>({action:"profile",handle:profileHandle});
      setFocused(r.profile);setTab("profile");setNotice("");
    }catch(e){setFocused(null);setNotice(errText(e));}
  }

  async function reportPost(id:string){
    if(!user){setNotice("Sign in to report content.");return;}
    const reason=window.prompt("Report reason: spam, scam, harassment, impersonation, or other","spam");
    if(!reason)return;
    setWorking(true);
    try{
      await post("social",{action:"report",targetType:"post",targetId:id,reason:reason.toLowerCase()});
      setNotice("Report recorded for moderator review. Reports do not automatically delete content.");
    }catch(e){setNotice(errText(e));}finally{setWorking(false);}
  }

  return <main className="social-shell">
    <header className="social-top"><Link href="/" className="social-logo">✳ looke<span>.</span><small> / social</small></Link>
      <div className="social-topnote"><span className="social-dot"/> ULTRA EVM TESTNET · SOCIAL</div>
      {user?<button onClick={()=>void signOut()} disabled={working} className="social-wallet">{abbrev(user.address)} · Sign out</button>
        :<button onClick={()=>void signIn()} disabled={working} className="social-wallet">{working?"Waiting for wallet…":"Sign in with wallet ↗"}</button>}
    </header>
    <div className="social-layout">
      <aside className="social-aside">
        <span className="social-eyebrow">LOOKE COMMUNITY</span>
        <nav>
          {([["feed","⌂ Feed"],["discover","◇ Discover"],["profile","◎ Profile"],["messages","▤ Messages"]] as const)
            .map(([key,label])=><button key={key} type="button" className={tab===key?"selected":""} onClick={()=>{setTab(key);setFocused(null);}}>{label}<span>↗</span></button>)}
        </nav>
        <div className="social-sidefoot"><strong>For the creators.</strong><p>Follow projects, talk about tokens and Uniq NFTs, and build real communities.</p>
          <p>Posts reference assets; they do not verify holdings or represent investment advice.</p></div>
      </aside>
      <section className="social-main">
        <div className="social-overline">M5 / SOCIAL NETWORK FOUNDATION</div>
        <div className="social-hero"><h1>{tab==="feed"?"People. Ideas. Culture.":tab==="discover"?"Find your people.":tab==="messages"?"Conversations.":"Your identity."}</h1>
          <p>Share what you create. Discover the people shaping Ultra. All displayed activity comes from the Looke social database.</p></div>
        {backendStatus==="unconfigured"&&<div className="social-warning"><strong>Backend not ready.</strong> Social database or sign-in configuration is unavailable. No demo profiles or fake posts are shown.</div>}
        {notice&&<div className="social-notice" role="status">{notice}</div>}
        {tab==="feed"&&<>
          {user&&<form className="social-card social-composer" onSubmit={e=>void publish(e)}>
            <div className="social-eyebrow">NEW POST · @{user.handle}</div>
            <textarea aria-label="Write a Looke post" required maxLength={1000} placeholder="What are you creating on Ultra?" value={newPost} onChange={e=>setNewPost(e.target.value)}/>
            <div className="social-compose-bottom">
              <select aria-label="Reference an asset" value={assetType} onChange={e=>{setAssetType(e.target.value as "none"|"token"|"uniq");setAssetId("");}}>
                <option value="none">No asset reference</option><option value="token">Share Ultra EVM token</option><option value="uniq">Share native Uniq NFT</option>
              </select>
              {assetType!=="none"&&<input aria-label="Asset identifier" required placeholder={assetType==="token"?"0x creator token address":"Native Uniq token ID"} value={assetId} onChange={e=>setAssetId(e.target.value)}/>}
              <button type="submit" disabled={working||!newPost.trim()}>Publish →</button>
            </div>
            <small>Public, plain-text posts · No financial transaction or signature required after sign-in.</small>
          </form>}
          {!user&&<div className="social-signin-note">Sign in with your Ultra EVM Testnet wallet to create a profile, post, comment or follow creators.</div>}
          <div className="social-list-heading"><h2>Community feed</h2><div className="social-tabs">
            <button className={mode==="global"?"chosen":""} onClick={()=>setMode("global")}>Latest</button>
            <button className={mode==="following"?"chosen":""} disabled={!user} onClick={()=>setMode("following")}>Following</button></div></div>
          {feed.length===0?<div className="social-empty">No real posts to show yet. New posts will appear after a creator publishes and the backend is enabled.</div>
            :feed.map(item=><article key={item.id} className="social-card social-post">
              <div className="social-post-top"><div className="social-avatar">{(item.display_name||item.handle).slice(0,1).toUpperCase()}</div><div>
                <button onClick={()=>void openProfile(item.handle)} className="social-handle">{item.display_name||item.handle} <span>@{item.handle}</span></button>
                <small>{dateLabel(item.created_at)} · {abbrev(item.author)}</small></div></div>
              <p className="social-post-body">{item.body}</p>
              <AssetBadge item={item}/>
              <div className="social-post-actions">
                <button onClick={()=>void viewComments(item.id)}>◉ {item.comment_count} comments</button>
                <button disabled={!user||user.address===item.author||working} onClick={()=>void reportPost(item.id)}>⚑ Report</button>
                <span>Public post · Real account</span>
              </div>
              {commentFor===item.id&&<section className="social-comments">
                <strong>Comments</strong>
                {comments.length===0&&<p className="social-muted">No visible replies.</p>}
                {comments.map(c=><div key={c.id} className="social-comment"><strong>@{c.handle}</strong><p>{c.body}</p></div>)}
                {user&&<form onSubmit={e=>void addComment(e)}><input required maxLength={500} placeholder="Write a reply..." value={commentText} onChange={e=>setCommentText(e.target.value)}/><button disabled={working||!commentText.trim()}>Reply</button></form>}
                <button className="social-hide" onClick={()=>setCommentFor("")}>Close replies</button>
              </section>}
            </article>)}
          {cursor&&<button className="social-load-more" onClick={()=>void loadFeed(true,cursor)}>Load older posts →</button>}
        </>}
        {tab==="discover"&&<div className="social-card">
          <div className="social-card-title"><h2>Discover creators</h2><span>REAL DATABASE PROFILES</span></div>
          <input className="social-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search handle or display name" aria-label="Search creators"/>
          {directory.length===0?<div className="social-empty">No matching public profiles.</div>:directory.map(p=><div className="social-directory" key={p.address}>
            <div className="social-avatar">{p.display_name?.slice(0,1).toUpperCase()||"L"}</div>
            <div><strong>{p.display_name}</strong><small>@{p.handle} · {abbrev(p.address)}</small></div>
            <button onClick={()=>void openProfile(p.handle)}>View profile ↗</button>
          </div>)}
        </div>}
        {tab==="profile"&&(focused?<div className="social-card social-profile">
          <div className="social-profile-avatar">{(focused.display_name||focused.handle).slice(0,1).toUpperCase()}</div>
          <h2>{focused.display_name}</h2><span>@{focused.handle}</span><p>{focused.bio||"This creator hasn't written a bio yet."}</p>
          <div className="social-stats"><strong>{focused.follower_count??0} followers</strong><strong>{focused.following_count??0} following</strong></div>
          {user&&user.address!==focused.address&&<div className="social-profile-actions">
            <button onClick={()=>void followUser(focused.address,focused.is_following?"unfollow":"follow")} disabled={working}>{focused.is_following?"Unfollow":"Follow"} ↗</button>
            <button className="social-block" onClick={()=>void followUser(focused.address,"block")} disabled={working}>Block account</button>
          </div>}
          <button className="social-hide" onClick={()=>setFocused(null)}>Back to my profile</button>
        </div>:user&&myProfile?<form className="social-card social-edit-profile" onSubmit={e=>void updateProfile(e)}>
          <h2>Creator profile</h2><p>Connected wallet: {user.address}. Only a signed-in wallet can change its own profile.</p>
          <label>Handle<input value={draftHandle} required maxLength={24} onChange={e=>setDraftHandle(e.target.value)}/></label>
          <label>Display name<input value={draftName} required maxLength={60} onChange={e=>setDraftName(e.target.value)}/></label>
          <label>Bio<textarea maxLength={240} value={draftBio} onChange={e=>setDraftBio(e.target.value)}/></label>
          <label>Avatar HTTPS URL (optional)<input value={draftAvatar} maxLength={500} onChange={e=>setDraftAvatar(e.target.value)}/></label>
          <button disabled={working}>Save profile →</button>
        </form>:<div className="social-empty">Sign in with your wallet to create a real creator profile.</div>)}
        {tab==="messages"&&<div className="social-card social-messages">
          <div className="social-message-icon">▤</div><h2>Private conversations are in development.</h2>
          <p>The database foundation reserves encrypted envelopes and per-user public keys, but end-to-end encryption, key registration, device recovery, blocking checks, and security review are not complete.</p>
          <p><strong>Sending and receiving DMs are intentionally disabled.</strong> Looke will not store plaintext private messages or advertise unverified encryption.</p>
          <span>FOUNDATION ONLY · NO LIVE MESSAGES</span>
        </div>}
        <footer className="social-footer">Looke social · No fake followers, posts, rewards or messages · Ultra-first creator platform <Link href="/">Back to Looke ↗</Link></footer>
      </section>
      <aside className="social-right"><span className="social-eyebrow">BUILD WITH PURPOSE</span><h3>Ultra culture,<br/>together.</h3>
        <p>Share a creator coin or a native Uniq reference in a public post. Verify token ownership and value independently before acting.</p>
        <div className="social-divider"/><strong>COMMUNITY SAFETY</strong>
        <p>Signed wallet identities, rate-limited posting, blocking, reporting, and audited moderator actions.</p>
        <div className="social-divider"/><Link href="/trade">Explore trading terminal ↗</Link>
      </aside>
    </div>
  </main>;
}
