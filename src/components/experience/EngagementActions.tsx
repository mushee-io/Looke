"use client";
import {useEffect,useState} from "react";
import Link from "next/link";

export type EngagementState={
 like_count?:number;repost_count?:number;
 liked_by_me?:boolean;reposted_by_me?:boolean;bookmarked_by_me?:boolean;
};
export function EngagementActions({postId,initial,authenticated,onChanged}:{
 postId:string;initial:EngagementState;authenticated:boolean;onChanged?:()=>void;
}){
 const [engagement,setEngagement]=useState({
  like_count:initial.like_count??0,repost_count:initial.repost_count??0,
  liked_by_me:initial.liked_by_me??false,reposted_by_me:initial.reposted_by_me??false,
  bookmarked_by_me:initial.bookmarked_by_me??false,
 });
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{
  setEngagement({
   like_count:initial.like_count??0,repost_count:initial.repost_count??0,
   liked_by_me:initial.liked_by_me??false,reposted_by_me:initial.reposted_by_me??false,
   bookmarked_by_me:initial.bookmarked_by_me??false,
  });
 },[postId,initial.like_count,initial.repost_count,
    initial.liked_by_me,initial.reposted_by_me,initial.bookmarked_by_me]);
 async function change(kind:"like"|"repost"|"bookmark"){
  if(!authenticated||busy)return;
  const selected=kind==="like"?engagement.liked_by_me:
    kind==="repost"?engagement.reposted_by_me:engagement.bookmarked_by_me;
  const action=selected?({like:"unlike",repost:"unrepost",bookmark:"unbookmark"} as const)[kind]:kind;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/social/engagement",{
     method:"POST",headers:{"content-type":"application/json"},
     body:JSON.stringify({action,postId}),credentials:"same-origin",cache:"no-store",
   });
   const data=await response.json() as {engagement?:typeof engagement;error?:string};
   if(!response.ok||!data.engagement)throw new Error(data.error||"Engagement could not be saved.");
   setEngagement(data.engagement);onChanged?.();
  }catch(e){setError(e instanceof Error?e.message:"Engagement unavailable.");}
  finally{setBusy(false);}
 }
 return <div className="lk-m17-engagement">
  <button type="button" disabled={!authenticated||busy} aria-pressed={engagement.liked_by_me}
    onClick={()=>{void change("like");}} aria-label="Like or unlike this creator post">
    {engagement.liked_by_me?"♥":"♡"} {engagement.like_count} likes</button>
  <button type="button" disabled={!authenticated||busy} aria-pressed={engagement.reposted_by_me}
    onClick={()=>{void change("repost");}} aria-label="Repost or undo repost">
    ↻ {engagement.repost_count} reposts</button>
  <button type="button" disabled={!authenticated||busy} aria-pressed={engagement.bookmarked_by_me}
    onClick={()=>{void change("bookmark");}} aria-label="Save or remove private bookmark">
    {engagement.bookmarked_by_me?"▣ Saved":"▢ Save"}</button>
  {!authenticated&&<Link href="/social">Sign in to engage</Link>}
  {error&&<small role="status">{error}</small>}
 </div>;
}
