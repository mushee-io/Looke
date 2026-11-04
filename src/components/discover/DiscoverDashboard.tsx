"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {
  cleanDiscoveryQuery,compactOnChainNumber,selectDiscoverMarkets,
  type DiscoverFeed,type DiscoverSort,
} from "../../lib/discover";
import "./discover.css";
import "./market-first.css";

type NativeHead={chainId:string;headBlock:number;irreversibleBlock:number};
const TABS:{key:DiscoverSort;label:string}[]=[
  {key:"trending",label:"Trending"},{key:"top",label:"Top"},
  {key:"new",label:"New"},{key:"watchlist",label:"Watchlist"},
];
function shortHash(value:string){return value.length>14?value.slice(0,7)+"…"+value.slice(-4):value;}
function initials(value:string){return value.slice(0,2).toUpperCase();}
const reference=[{label:"Creator coins",detail:"Launch your token",href:"/trade",icon:"✳",tone:"blue"},
 {label:"Uniq NFTs",detail:"Native Ultra collectibles",href:"/uniqs",icon:"◈",tone:"lilac"},
 {label:"Communities",detail:"Posts and creator profiles",href:"/social",icon:"↗",tone:"mint"}] as const;

export default function DiscoverDashboard({onCreate}:{onCreate:()=>void}){
  const [tab,setTab]=useState<DiscoverSort>("trending");
  const [query,setQuery]=useState("");
  const [feed,setFeed]=useState<DiscoverFeed|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState<string[]>([]);
  const [native,setNative]=useState<NativeHead|null>(null);
  const [updated,setUpdated]=useState("");
  const searchRef=useRef<HTMLInputElement>(null);

  const refresh=useCallback(async()=>{
    try{
      const res=await fetch("/api/discover",{cache:"no-store"});
      if(!res.ok)throw new Error("The market indexer is not available yet.");
      const data=await res.json() as DiscoverFeed;
      if(data.chainId!==18881||data.source!=="verified-on-chain"||!Array.isArray(data.markets))
        throw new Error("Unverified market response. No listings will be shown.");
      setFeed(data);setUpdated(data.asOf);setError("");
    }catch(e){setFeed(null);setError(e instanceof Error?e.message:"Market data unavailable.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    try{
      const entry=window.localStorage.getItem("looke.m12.watchlist");
      if(entry){
        const parsed:unknown=JSON.parse(entry);
        if(Array.isArray(parsed))
          setSaved(parsed.filter((x):x is string=>typeof x==="string").slice(0,100));
      }
    }catch{/* Browser storage may be unavailable. */}
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},60_000);
    return ()=>window.clearInterval(timer);
  },[refresh]);
  useEffect(()=>{
    const update=async()=>{
      try{
        const r=await fetch("/api/uniqs?kind=status",{cache:"no-store"});
        if(!r.ok)throw new Error("Native RPC unavailable.");
        const next=await r.json() as NativeHead;
        if(Number.isSafeInteger(next.irreversibleBlock)&&next.irreversibleBlock>0)
          setNative(next);
        else setNative(null);
      }catch{setNative(null);}
    };
    void update();
    const timer=window.setInterval(()=>{void update();},120_000);
    return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      if(e.key==="/"&&!e.metaKey&&!e.ctrlKey&&target?.tagName!=="INPUT"&&target?.tagName!=="TEXTAREA"){
        e.preventDefault();searchRef.current?.focus();
      }
      if(e.key==="Escape"&&document.activeElement===searchRef.current)searchRef.current?.blur();
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[]);
  const watchlist=useMemo(()=>new Set(saved),[saved]);
  const rows=useMemo(()=>selectDiscoverMarkets(feed?.markets??[],tab,query,watchlist),
    [feed,tab,query,watchlist]);
  const hasMarkets=Boolean(feed?.markets.length);
  const toggleSaved=(id:string)=>{
    setSaved(curr=>{
      const next=curr.includes(id)?curr.filter(x=>x!==id):[...curr,id].slice(0,100);
      try{window.localStorage.setItem("looke.m12.watchlist",JSON.stringify(next));}
      catch{/* Watchlist is browser-only; no fake backend save. */}
      return next;
    });
  };
  const isSearching=cleanDiscoveryQuery(query).length>0;


  return (
    <div className="discover-v12 discover-market-first">
      <div className="discover-utility">
        <div className="discover-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></svg>
          <input ref={searchRef} type="search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Search creators, tokens or contract addresses"
            aria-label="Search verified creator markets" maxLength={64}/>
          <kbd>/</kbd>
        </div>
        <span className="discover-market-network"><span className="discover-live-dot"/> Ultra Testnet <span>18881</span></span>
      </div>

      <nav className="discover-categories" aria-label="Explore Looke">
        <div className="discover-categories-scroll">
          <button type="button" className="discover-category discover-category-selected"
            onClick={()=>{setTab("trending");setQuery("");}} aria-label="All verified creator coins">
            <span className="discover-category-dot">✳</span> All coins <span aria-hidden="true" className="discover-chevron">⌄</span>
          </button>
          <button type="button" className="discover-category" onClick={onCreate}>
            <span className="discover-category-dot purple">✦</span> Creator studio
          </button>
          <Link href="/uniqs" className="discover-category"><span className="discover-category-dot violet">◇</span> Uniq NFTs</Link>
          <Link href="/trade" className="discover-category"><span className="discover-category-dot mint">↗</span> Trading</Link>
          <Link href="/social" className="discover-category"><span className="discover-category-dot peach">◎</span> Communities</Link>
          <Link href="/beta" className="discover-category"><span className="discover-category-dot grey">✓</span> Beta status</Link>
        </div>
        <button type="button" className="discover-floating-create" onClick={onCreate}
          aria-label="Create a coin on Ultra Testnet" title="Create a coin">＋</button>
      </nav>

      <section className="discover-markets" aria-label="Ultra creator market rankings">
        <header className="discover-markets-header">
          <div className="discover-market-heading">
            <div className="discover-overline">DISCOVER / ULTRA EVM</div>
            <h1>Explore markets <span className="discover-header-period">.</span></h1>
            <p>Creator coins and verified on-chain activity.</p>
          </div>
          <div className="discover-header-right">
            <span className="discover-market-status"><span className="discover-live-dot"/>{hasMarkets?"Verified markets":"Indexer awaiting markets"}</span>
            <button className="discover-refresh" type="button" onClick={()=>{setLoading(true);void refresh();}} disabled={loading}
              aria-label="Refresh verified markets" title="Refresh verified markets">↻</button>
          </div>
        </header>
        <div className="discover-tabs" role="tablist" aria-label="Market rankings">
          {TABS.map(t=><button key={t.key} role="tab" aria-selected={tab===t.key}
            className={tab===t.key?"discover-tab is-active":"discover-tab"}
            onClick={()=>setTab(t.key)} type="button">
            {t.label}{t.key==="watchlist"&&saved.length>0?<span className="discover-tab-count">{saved.length}</span>:null}
          </button>)}
          <span className="discover-tab-spacer"/>
          <span className="discover-tab-network">{feed?.markets.length??0} verified creator markets</span>
        </div>
        <div className="discover-table">
          <div className="discover-table-head" aria-hidden="true">
            <span>Coin</span><span>Market cap</span><span>Observed vol*</span>
            <span>Holders</span><span>Age</span><span>Paired with</span><span>Past 24h</span><span>Save</span>
          </div>
          {rows.length>0&&tab!=="new"?rows.map(m=>(
            <div className="discover-row" key={m.id}>
              <div className="discover-row-name">
                <span className="discover-token-icon" aria-hidden="true">{initials(m.baseSymbol)}</span>
                <span><strong>{m.baseSymbol}</strong><small>{m.id.toUpperCase()} · price {compactOnChainNumber(m.poolPrice,5)} {m.quoteSymbol}</small></span>
              </div>
              <div className="discover-cell discover-missing" title="Market cap needs a verified supply and complete pricing index">—</div>
              <div className="discover-cell">
                <span className="discover-mobile-label">Observed volume</span>
                <strong>{m.observedQuoteVolume===null?"—":compactOnChainNumber(m.observedQuoteVolume)+" "+m.quoteSymbol}</strong>
                {m.partial?<small>Partial scan</small>:null}
              </div>
              <div className="discover-cell discover-missing" title="Verified holder count indexing is not yet available">—</div>
              <div className="discover-cell discover-missing" title="Creation date indexing is not yet available">—</div>
              <div className="discover-cell discover-pair"><span className="discover-pair-icon">◉</span><strong>{m.quoteSymbol}</strong></div>
              <div className="discover-cell discover-missing" title="Verified 24-hour historical prices are not available">—</div>
              <button className={"discover-save"+(watchlist.has(m.id)?" is-saved":"")}
                onClick={()=>toggleSaved(m.id)} type="button"
                aria-label={(watchlist.has(m.id)?"Remove ":"Add ")+m.baseSymbol+(watchlist.has(m.id)?" from":" to")+" watchlist"}
                aria-pressed={watchlist.has(m.id)}>{watchlist.has(m.id)?"★":"☆"}</button>
              <Link href="/trade" className="discover-row-action" aria-label={"Open "+m.baseSymbol+" trading market"}>Trade ↗</Link>
            </div>
          )):(
            <div className="discover-empty-market" role="status">
              <span className="discover-empty-icon" aria-hidden="true">◇</span>
              <div className="discover-empty-copy">
                {loading?<><h2>Checking Ultra markets…</h2><p>Reading verified Testnet contracts and actual swap activity.</p></>:
                  error?<><h2>Market data is unavailable</h2><p>{error} Looke will not show synthetic listings.</p></>:
                  tab==="new"?<><h2>New listings are not indexed yet</h2><p>Creation-time indexing is required before coins can be listed as new.</p></>:
                  tab==="watchlist"?<><h2>Nothing on your watchlist yet</h2><p>Bookmark a verified token to save it in this browser.</p></>:
                  isSearching?<><h2>No matching verified coin</h2><p>Try a different symbol or contract address.</p></>:
                  <><h2>First verified markets coming soon</h2><p>There are no confirmed creator coin markets with reviewed liquidity to list yet. Real coins will appear here automatically once indexed.</p></>}
              </div>
              <div className="discover-empty-actions">
                <button type="button" className="discover-create" onClick={onCreate}>Create a coin ↗</button>
                <Link href="/trade" className="discover-empty-link">Trading terminal ↗</Link>
              </div>
            </div>
          )}
        </div>
        <footer className="discover-market-footnote">
          <span>*Observed volume comes from recent verified blocks, not a complete 24-hour window. Market cap, holders, age and price change remain unavailable without independent indexing.</span>
          {updated?<time dateTime={updated}>Checked {new Date(updated).toLocaleTimeString()}</time>:null}
        </footer>
        {feed?.errors.length?<div className="discover-indexer-notice">Some allowlisted markets failed verification and are hidden.</div>:null}
      </section>

      <div className="discover-product-footer">
        <div className="discover-product-intro"><span className="discover-overline">THE LOOKE ECOSYSTEM</span><h2>More than a market<span className="branddot">.</span></h2></div>
        <div className="discover-shortcuts" aria-label="Looke products">
          {reference.map(item=>(
            <Link key={item.label} className={"discover-shortcut discover-shortcut-"+item.tone} href={item.href}>
              <span className="discover-shortcut-icon">{item.icon}</span>
              <span className="discover-shortcut-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
              <span className="discover-shortcut-arrow">↗</span>
            </Link>
          ))}
        </div>
        <div className="discover-bottom">
          <div className="discover-bottom-card discover-bottom-creative">
            <div className="discover-bottom-badge">LOOKE CREATOR STUDIO</div>
            <div className="discover-bottom-content"><h3>Start something original.</h3><p>Launch your creator coin and connect your community on Ultra Testnet when the verified factory is active.</p>
              <button type="button" onClick={onCreate}>Open creator studio <span>↗</span></button></div>
            <span className="discover-bottom-flower" aria-hidden="true">✳</span>
          </div>
          <div className="discover-bottom-card discover-bottom-chain">
            <div className="discover-bottom-badge">NETWORK PULSE</div>
            <div className="discover-chain-row"><span className="discover-chain-glyph">◉</span><div><strong>Ultra EVM Testnet</strong><small>Chain ID 18881</small></div><span className="discover-chain-ok">Configured</span></div>
            <div className="discover-chain-row"><span className="discover-chain-glyph">◆</span><div><strong>Ultra Native Testnet</strong><small>{native?"Irreversible block "+native.irreversibleBlock.toLocaleString("en-US"):"RPC check unavailable"}</small></div><span className={native?"discover-chain-ok":"discover-chain-pending"}>{native?"Verified":"Pending"}</span></div>
            <Link href="/beta" className="discover-beta-link">View beta readiness <span>↗</span></Link>
          </div>
        </div>
      </div>

      <div className="discover-endnote"><span>looke<span className="branddot">.</span></span><p>Creator coins, Uniqs and communities on Ultra.</p><span>EARLY ACCESS · TESTNET</span></div>
    </div>
  );
}
