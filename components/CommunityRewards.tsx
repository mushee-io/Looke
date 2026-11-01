"use client";
import {useEffect,useRef,useState} from "react";
import {HeartHandshake,RefreshCw,ShieldAlert,CalendarDays,ClipboardCheck,Users,CheckCircle2,LockKeyhole} from "lucide-react";

type Category={weight:number;maxPerDay:number};
type ScoredDay={day:string;points:number;counts:Record<string,{
 observed:number;counted:number;excludedByCap:number;points:number}>};
type Review={id:string;passed:boolean;label:string};
type Report={totalProvisionalPoints:number;activeDays:number;
 accountAgeDays:number;uniqueCounterpartCreators:number;dailyMaximum:number;
 daily:ScoredDay[];prerequisites:Review[];qualifiesForManualReview:boolean;
 status:"provisional_non_redeemable";creditedTokens:string;
 claimableRewards:false;distributionEnabled:false;warning:string};
type Saved={periodStart:string;periodEnd:string;policyVersion:number;
 provisionalPoints:number;revision:number;reviewStatus:string;
 digest:string;computedAt:string};
type Ledger={report:Report;categoryPolicy:Record<string,Category>;
 window:{startDay:string;endDay:string};savedSnapshots:Saved[];
 source:string;pointsTransferable:false;error?:string};
type Community={visiblePosts:number;activeCreators:number;visibleComments:number;
 period:string;leaderboardEnabled:false;rewardsAvailable:false;error?:string};
const labels:Record<string,string>={
 posts:"Visible posts",comments:"Comments to other creators",likes:"Likes of other creators",
 reposts:"Reposts of other creators",follows:"Creator follows"
};
export function CommunityRewards({authenticated,onLogin}:{
 authenticated:boolean;onLogin:()=>void;
}){
 const [ledger,setLedger]=useState<Ledger|null>(null);
 const [community,setCommunity]=useState<Community|null>(null);
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [communityError,setCommunityError]=useState("");
 const [note,setNote]=useState("");
 const generation=useRef(0);
 async function refresh(){
  const ticket=++generation.current;
  setBusy(true);
  setError("");setCommunityError("");
  const communityResult=fetch("/api/community/stats",{cache:"no-store"})
    .then(async r=>{const value=await r.json() as Community;
      if(!r.ok)throw Error(value.error??"Community data unavailable");return value;});
  const personalResult=authenticated?
    fetch("/api/community/rewards",{cache:"no-store"}).then(async r=>{
     const value=await r.json() as Ledger;
     if(!r.ok)throw Error(value.error??"Your participation ledger is unavailable");
     return value;
    }):Promise.resolve(null);
  const [c,p]=await Promise.allSettled([communityResult,personalResult]);
  if(ticket!==generation.current)return;
  if(c.status==="fulfilled")setCommunity(c.value);
  else{setCommunity(null);setCommunityError(c.reason instanceof Error?c.reason.message:"Community summary unavailable");}
  if(p.status==="fulfilled")setLedger(p.value);
  else{setLedger(null);setError(p.reason instanceof Error?p.reason.message:"Participation summary unavailable");}
  setBusy(false);
 }
 useEffect(()=>{setLedger(null);setNote("");void refresh();
  return()=>{generation.current++;};
 },[authenticated]);
 async function saveSnapshot(){
  if(!authenticated||saving)return;
  setSaving(true);setNote("");setError("");
  try{
   const response=await fetch("/api/community/rewards/snapshot",{method:"POST"});
   const saved=await response.json() as {error?:string;changed?:boolean;
    snapshot?:{revision:number};score?:number};
   if(!response.ok)throw Error(saved.error??"Could not save score snapshot");
   setNote(saved.changed?
    "Saved or reconciled an unverified participation snapshot. This is not a reward balance.":
    "An identical unverified snapshot already exists; nothing was issued.");
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Snapshot unavailable");}
  finally{setSaving(false);}
 }
 const activity=ledger?.report;
 return <section aria-label="Looke community and provisional participation review"
  style={{margin:"25px 0",border:"1px solid #e4e1ed",borderRadius:16,background:"#fcfbff",padding:20}}>
  <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
   <HeartHandshake size={22}/><h2 style={{fontSize:20,margin:0}}>Community participation</h2>
   <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:"#75628a"}}>M19 · NON-REDEEMABLE</span>
  </div>
  <p style={{fontSize:12,color:"#777",lineHeight:1.65,margin:"12px 0 16px"}}>
   Track moderated community activity over a rolling 14-day window. Scores are provisional,
   capped, and subject to manual anti-abuse review. <strong>These are not tokens, airdrop rights,
   earned cash, or guaranteed future rewards.</strong>
  </p>
  <div style={{display:"flex",gap:12,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
   <strong style={{fontSize:14}}><Users size={16} style={{display:"inline",verticalAlign:"middle"}}/> Community overview</strong>
   <button type="button" className="subtle-cta" disabled={busy||saving} onClick={()=>void refresh()}>
    <RefreshCw size={14}/> {busy?"Refreshing…":"Refresh activity"}
   </button>
  </div>
  {communityError&&<p role="alert" style={{fontSize:12,color:"#ac3350"}}>{communityError}</p>}
  {community&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginTop:12}}>
   {[
    {label:"Visible posts",value:community.visiblePosts},
    {label:"Active creators",value:community.activeCreators},
    {label:"Visible comments",value:community.visibleComments}
   ].map(item=><div key={item.label} style={{padding:12,background:"#f3f1fa",borderRadius:10}}>
    <strong style={{fontSize:20,display:"block"}}>{item.value.toLocaleString()}</strong>
    <span style={{fontSize:11,color:"#81798a"}}>{item.label} / 14 days</span>
   </div>)}
  </div>}
  {!authenticated?<div style={{marginTop:18,padding:15,borderRadius:11,border:"1px solid #e9e6ee",background:"#fff"}}>
   <strong style={{fontSize:13}}>Your private participation ledger</strong>
   <p style={{fontSize:12,color:"#777"}}>Sign in with Looke's EVM challenge to view your own social activity score. No public wallets, earnings or account rankings are exposed.</p>
   <button className="subtle-cta" type="button" onClick={onLogin}>Sign in to review participation</button>
  </div>:<>
   {error&&<p role="alert" style={{fontSize:12,color:"#ad2b48",marginTop:13}}>{error}</p>}
   {activity&&<div style={{marginTop:18}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11}}>
     <div style={{padding:15,borderRadius:11,background:"#f3f0fa"}}>
      <span style={{display:"block",fontSize:11,color:"#746b7d"}}>Provisional activity score</span>
      <strong style={{fontSize:27}}>{activity.totalProvisionalPoints}</strong>
      <p style={{fontSize:11,margin:"6px 0",color:"#8e6480"}}>Non-redeemable points · no tokens credited</p>
     </div>
     <div style={{padding:15,borderRadius:11,background:"#f3f0fa"}}>
      <span style={{display:"block",fontSize:11,color:"#746b7d"}}>Active days</span>
      <strong style={{fontSize:27}}>{activity.activeDays}/14</strong>
      <p style={{fontSize:11,margin:"6px 0",color:"#777"}}>Qualifying, currently visible actions</p>
     </div>
     <div style={{padding:15,borderRadius:11,background:"#f3f0fa"}}>
      <span style={{display:"block",fontSize:11,color:"#746b7d"}}>Other creators engaged</span>
      <strong style={{fontSize:27}}>{activity.uniqueCounterpartCreators}</strong>
      <p style={{fontSize:11,margin:"6px 0",color:"#777"}}>Distinct across the rolling window</p>
     </div>
    </div>
    <div style={{background:"#fff",padding:15,borderRadius:11,border:"1px solid #e8e4ee",marginTop:14}}>
     <strong style={{fontSize:14}}>Manual-review prerequisites</strong>
     <p style={{fontSize:12,color:"#777",margin:"7px 0 12px"}}>
      {activity.qualifiesForManualReview?"Basic conditions met, not approved or identity-verified.":
       "Basic conditions are not yet met. No rewards or payouts are available."}
     </p>
     {activity.prerequisites.map(x=><div key={x.id} style={{fontSize:12,display:"flex",gap:8,alignItems:"center",margin:"9px 0"}}>
      {x.passed?<CheckCircle2 size={15} color="#3a8a60"/>:<LockKeyhole size={15} color="#a36c7d"/>}
      {x.label}
     </div>)}
    </div>
    <div style={{marginTop:17,padding:15,borderRadius:11,border:"1px solid #e8e4ee",background:"#fff"}}>
     <strong style={{fontSize:14}}>Transparent scoring policy</strong>
     <p style={{fontSize:11,color:"#777",margin:"7px 0"}}>
      Post visibility and moderation affect counts. Non-self engagement is deduplicated by creator,
      category and UTC day. Caps apply daily; unreviewed reports do not automatically penalize accounts.
     </p>
     {Object.entries(ledger!.categoryPolicy).map(([name,rule])=><div key={name}
      style={{fontSize:12,display:"flex",justifyContent:"space-between",gap:9,borderTop:"1px solid #eee",padding:"8px 0"}}>
      <span>{labels[name]??name}</span><strong>{rule.weight} pts each · max {rule.maxPerDay}/day</strong>
     </div>)}
    </div>
    <div style={{marginTop:17}}>
     <strong style={{fontSize:14}}><CalendarDays size={16} style={{display:"inline",verticalAlign:"middle"}}/> Your daily activity ledger</strong>
     <p style={{fontSize:11,color:"#888",margin:"7px 0"}}>{ledger!.window.startDay} through {ledger!.window.endDay} UTC. Scores change when qualifying actions are removed or moderated.</p>
     {activity.daily.length?activity.daily.map(day=><details key={day.day} style={{
      padding:"11px 12px",border:"1px solid #ebe8f0",background:"#fff",
      borderRadius:9,marginTop:8
     }}>
      <summary style={{cursor:"pointer",display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",fontSize:13}}>
       <strong>{day.day}</strong><span>{day.points} provisional points</span>
      </summary>
      <div style={{marginTop:11}}>
       {Object.entries(day.counts).map(([kind,count])=><div key={kind}
        style={{display:"flex",gap:10,justifyContent:"space-between",fontSize:11,padding:"5px 0"}}>
        <span>{labels[kind]??kind}: {count.counted}/{count.observed} counted</span>
        <span>{count.points} pts{count.excludedByCap?" · cap excluded "+count.excludedByCap:""}</span>
       </div>)}
      </div>
     </details>):<p style={{fontSize:12,color:"#777",margin:"12px 0"}}>
      No qualifying social activity recorded in this period. Zero points have been assigned.
     </p>}
    </div>
    <div style={{marginTop:17,padding:15,borderRadius:11,background:"#f3f1fa"}}>
     <strong style={{fontSize:14}}>Historical provisional snapshots</strong>
     <p style={{fontSize:11,color:"#777"}}>
      Save the last 14 <em>completed</em> UTC days as an unverified accounting checkpoint.
      Scores can be revised after moderation. No rewards, claim keys or spending permissions are created.
     </p>
     <button type="button" className="subtle-cta" disabled={saving||busy} onClick={()=>void saveSnapshot()}>
      <ClipboardCheck size={14}/> {saving?"Saving…":"Save/reconcile provisional snapshot"}
     </button>
     {ledger!.savedSnapshots.length?ledger!.savedSnapshots.map((s,i)=><div key={s.periodStart+":"+i}
       style={{padding:"9px 0",borderTop:"1px solid #e0dce9",fontSize:11,marginTop:8}}>
       <strong>{s.periodStart}–{s.periodEnd} · {s.provisionalPoints} points · revision {s.revision}</strong>
       <p style={{margin:"4px 0",color:"#987087"}}>Unverified · checkpoint hash {s.digest.slice(0,16)}… (aggregate only)</p>
      </div>):<p style={{fontSize:11,color:"#85808b",marginTop:12}}>No saved provisional snapshots.</p>}
    </div>
   </div>}
  </>}
  {note&&<p role="status" style={{fontSize:12,color:"#2c704e",marginTop:13}}>{note}</p>}
  <p style={{fontSize:11,color:"#925e76",lineHeight:1.6,marginTop:16}}>
   <ShieldAlert size={14} style={{display:"inline",verticalAlign:"middle"}}/>
   A wallet profile is not a unique human. This system cannot yet prevent coordinated farming,
   multi-wallet abuse, or wash engagement; a score does not guarantee allocation or eligibility.
   Onchain rewards, token distribution and payouts are disabled.
  </p>
 </section>;
}
