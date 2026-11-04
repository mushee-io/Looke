"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {
  cleanDiscoveryQuery,compactOnChainNumber,selectDiscoverMarkets,
  type DiscoverFeed,type DiscoverSort,
} from "../../lib/discover";
import "./discover.css";

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
    <div className="discover-v12">
      <div className="discover-utility">
        <div className="discover-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></svg>
          <input ref={searchRef} type="search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Search coins, creators or contracts" aria-label="Search verified Looke markets" maxLength={64}/>
          <kbd>/</kbd>
        </div>
        <div className="discover-utility-tag"><span className="discover-live-dot"/> Ultra Testnet <span className="discover-hide-mobile">· Chain 18881</span></div>
      </div>

      <section className="discover-welcome" aria-label="Explore the Ultra creator economy">
        <div className="discover-welcome-content">
          <div className="discover-kicker"><span className="discover-kicker-dot"/> THE CREATOR ECONOMY, ON ULTRA</div>
          <h1>Discover the <span>next wave.</span></h1>
          <p>Every creator has a story. Every coin starts somewhere. Explore verified markets, discover Uniqs, and build what comes next.</p>
          <div className="discover-hero-actions">
            <button type="button" className="discover-create" onClick={onCreate}><span>＋</span> Create a coin <span aria-hidden="true">↗</span></button>
            <Link className="discover-explore" href="/uniqs">Explore Uniqs <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="discover-hero-footnote"><span className="discover-hero-pin"/> Real on-chain data only. No simulated trades.</div>
        </div>
        <div className="discover-hero-art" aria-hidden="true">
          <div className="discover-orb discover-orb-back"/>
          <div className="discover-orb discover-orb-front"/>
          <div className="discover-orb discover-orb-small"/>
          <span className="discover-art-spark one">✳</span>
          <span className="discover-art-spark two">✦</span>
          <div className="discover-art-label"><span className="discover-live-dot"/> BUILD ON ULTRA</div>
        </div>
      </section>

      <div className="discover-shortcuts" aria-label="Explore Looke products">
        {reference.map(item=>(
          <Link key={item.label} className={"discover-shortcut discover-shortcut-"+item.tone} href={item.href}>
            <span className="discover-shortcut-icon">{item.icon}</span>
            <span className="discover-shortcut-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
            <span className="discover-shortcut-arrow">↗</span>
          </Link>
        ))}
      </div>

      <section className="discover-markets" aria-label="Ultra creator markets">
        <header className="discover-markets-header">
          <div>
            <div className="discover-overline">MARKETS / ULTRA EVM TESTNET</div>
            <h2>Explore markets<span className="discover-header-period">.</span></h2>
            <p>On-chain creator tokens. Verified contracts. Nothing made up.</p>
          </div>
          <div className="discover-header-right">
            <span className="discover-market-status"><span className="discover-live-dot"/>{hasMarkets?"On-chain markets":"Waiting for first market"}</span>
            <button className="discover-refresh" type="button" onClick={()=>{setLoading(true);void refresh();}} disabled={loading} aria-label="Refresh verified markets" title="Refresh verified markets">↻</button>
          </div>
        </header>
        <div className="discover-tabs" role="tablist" aria-label="Market views">
          {TABS.map(t=><button key={t.key} role="tab" aria-selected={tab===t.key}
            className={tab===t.key?"discover-tab is-active":"discover-tab"}
            onClick={()=>setTab(t.key)} type="button">
            {t.label}{t.key==="watchlist"&&saved.length>0?<span className="discover-tab-count">{saved.length}</span>:null}
          </button>)}
          <span className="discover-tab-spacer"/>
          <span className="discover-tab-network">◉ Verified Ultra markets</span>
        </div>
        <div className="discover-table">
          <div className="discover-table-head" aria-hidden="true">
            <span>Coin / Pair</span><span>Pool price</span><span>Observed volume*</span>
            <span>Liquidity in quote</span><span>Holders</span><span>24h</span><span>Save</span>
          </div>
          {rows.length>0&&tab!=="new"?rows.map((m,i)=>(
            <div className="discover-row" key={m.id}>
              <div className="discover-row-name">
                <span className="discover-token-icon" aria-hidden="true">{initials(m.baseSymbol)}</span>
                <span><strong>{m.baseSymbol}</strong><small>{m.id.toUpperCase()} · {m.quoteSymbol}</small></span>
              </div>
              <div className="discover-cell"><span className="discover-mobile-label">Pool price</span>
                <strong>{compactOnChainNumber(m.poolPrice,5)} {m.quoteSymbol}</strong></div>
              <div className="discover-cell"><span className="discover-mobile-label">Observed volume</span>
                <strong>{m.observedQuoteVolume===null?"—":compactOnChainNumber(m.observedQuoteVolume)+" "+m.quoteSymbol}</strong>
                {m.partial?<small>Partial scan</small>:null}</div>
              <div className="discover-cell"><span className="discover-mobile-label">Quote liquidity</span>
                <strong>{compactOnChainNumber(m.reserveQuote)} {m.quoteSymbol}</strong></div>
              <div className="discover-cell discover-missing" title="Requires verified unique-holder indexing">—</div>
              <div className="discover-cell discover-missing" title="24-hour price history not yet indexed">—</div>
              <button className={"discover-save"+(watchlist.has(m.id)?" is-saved":"")}
                onClick={()=>toggleSaved(m.id)} type="button"
                aria-label={(watchlist.has(m.id)?"Remove ":"Add ")+m.baseSymbol+(watchlist.has(m.id)?" from":" to")+" watchlist"}
                aria-pressed={watchlist.has(m.id)}>☆</button>
              <Link href="/trade" className="discover-row-action" aria-label={"Inspect "+m.baseSymbol+" trading market"}>View market ↗</Link>
            </div>
          )):(
            <div className="discover-empty-market" role="status">
              <div className="discover-empty-visual" aria-hidden="true">
                <span className="discover-empty-diamond a">◇</span>
                <span className="discover-empty-diamond b">◇</span>
                <span className="discover-empty-diamond c">✳</span>
              </div>
              {loading?<><h3>Finding verified markets…</h3><p>Reading actual Ultra EVM Testnet contracts and recent swaps.</p></>:
                error?<><h3>Market data is unavailable.</h3><p>{error} We don't substitute sample tokens or volume.</p></>:
                tab==="new"?<><h3>New launches are coming.</h3><p>Creation dates need an independently verified deployment indexer. Until then, no token is falsely labeled new.</p></>:
                tab==="watchlist"?<><h3>Your watchlist starts here.</h3><p>Save a verified token using the star beside its market. Saved items stay in this browser.</p></>:
                isSearching?<><h3>No matching verified markets.</h3><p>Try another name, ticker or contract address. Only real Ultra Testnet tokens are included.</p></>:
                <><h3>A new market starts with a creator.</h3><p>Verified Ultra creator tokens will appear here when their contracts and liquidity are live. No fake rankings, market caps or volumes.</p></>}
              <div className="discover-empty-actions">
                <button type="button" className="discover-create" onClick={onCreate}>＋ Launch your token ↗</button>
                <Link href="/trade" className="discover-empty-link">Open trading terminal ↗</Link>
              </div>
            </div>
          )}
        </div>
        <footer className="discover-market-footnote">
          <span>*Observed volume is from a bounded recent blockchain scan, <strong>not</strong> a 24-hour statistic. Market cap, holders and 24h change appear after independently verified indexing.</span>
          {updated?<time dateTime={updated}>Checked {new Date(updated).toLocaleTimeString()}</time>:null}
        </footer>
        {feed?.errors.length?<div className="discover-indexer-notice">Some allowlisted markets could not be independently verified. They are excluded from rankings.</div>:null}
      </section>

      <section className="discover-bottom">
        <div className="discover-bottom-card discover-bottom-creative">
          <div className="discover-bottom-badge">LOOKE CREATOR STUDIO</div>
          <div className="discover-bottom-content"><h3>Your next idea deserves a home.</h3><p>Give your community a coin, a collection, and a place to connect. Start with Ultra Testnet.</p>
            <button type="button" onClick={onCreate}>Enter creator studio <span>↗</span></button></div>
          <span className="discover-bottom-flower" aria-hidden="true">✳</span>
        </div>
        <div className="discover-bottom-card discover-bottom-chain">
          <div className="discover-bottom-badge">NETWORK PULSE</div>
          <div className="discover-chain-row"><span className="discover-chain-glyph">◉</span><div><strong>Ultra EVM Testnet</strong><small>Chain ID 18881</small></div><span className="discover-chain-ok">Configured</span></div>
          <div className="discover-chain-row"><span className="discover-chain-glyph">◆</span><div><strong>Ultra Native Testnet</strong><small>{native?"Irreversible block "+native.irreversibleBlock.toLocaleString("en-US"):"RPC check unavailable"}</small></div><span className={native?"discover-chain-ok":"discover-chain-pending"}>{native?"Verified":"Pending"}</span></div>
          <Link href="/beta" className="discover-beta-link">View beta readiness <span>↗</span></Link>
        </div>
      </section>

      <div className="discover-endnote"><span>looke<span className="branddot">.</span></span><p>Make something matter. Built on Ultra.</p><span>EARLY ACCESS · TESTNET</span></div>
    </div>
  );
}
