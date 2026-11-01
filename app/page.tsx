"use client";

import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bookmark, Check,
  ChevronDown, ChevronLeft, ChevronRight, Compass, Copy, ExternalLink,
  Heart, Home, Image as ImageIcon, Info, Menu, MoreHorizontal, Plus,
  Search, Settings2, Share2, ShieldCheck, SlidersHorizontal, Sparkles,
  TrendingUp, UserRound, Wallet, X
} from "lucide-react";
import { coins, navFilters, posts, uniqs, type Coin, type FeedPost, type Uniq } from "@/lib/demo";
import { parseAgeHours, parseCompactNumber } from "@/lib/demo-market.mjs";
import { WalletConnection, type ConnectedWallet } from "@/components/WalletConnection";
import { SocialLive, ProfileEditor } from "@/components/SocialLive";
import { NativeUniqs } from "@/components/NativeUniqs";
import { LiveCoins } from "@/components/LiveCoins";
import { EvmPortfolio } from "@/components/EvmPortfolio";
import { Notifications } from "@/components/Notifications";
import { NetworkStatus } from "@/components/NetworkStatus";
import { NativeUniqMintLab } from "@/components/NativeUniqMintLab";
import { AccountSecurity } from "@/components/AccountSecurity";
import { CreatorDirectory } from "@/components/CreatorDirectory";
import { DiscoveryHub } from "@/components/DiscoveryHub";
import { CreatorCoinLab } from "@/components/CreatorCoinLab";

type Page = "explore" | "feed" | "nfts" | "activity" | "profile" | "settings";
type ComposerType = "Content coin" | "Creator coin" | "Trend coin" | "Uniq NFT";
type Draft = { id: string; type: ComposerType; title: string; caption: string; created: string };
type Modal = "login" | "create" | "trade" | "nft" | null;

const validPages: Page[] = ["explore", "feed", "nfts", "activity", "profile", "settings"];
function pageFromHash(hash: string): Page {
  const candidate = hash.replace(/^#\/?/, "");
  return validPages.includes(candidate as Page) ? candidate as Page : "explore";
}

const sectionLabels: Record<Page, string> = {
  explore:"Explore", feed:"Feed", nfts:"NFTs", activity:"Activity", profile:"Profile", settings:"Settings"
};
const numberPath = "0,65 8,60 17,63 26,38 35,43 44,24 53,32 62,18 71,24 80,5 89,11 98,1";
const inversePath = "0,20 10,18 20,37 30,27 40,48 50,40 60,57 70,43 80,65 90,59 98,75";

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`mark ${small ? "mark-small" : ""}`} aria-label="Looke">◉</span>;
}
function CoinAvatar({ coin, size = "normal" }: { coin: Coin; size?: "normal" | "large" }) {
  return <span className={`coin-avatar tone-${coin.tone} ${size === "large" ? "coin-avatar-lg" : ""}`}>{coin.icon}</span>;
}
function Art({ name, children }: { name: string; children?: ReactNode }) {
  return <div className={`visual visual-${name}`}><span className="art-glow" /><span className="art-orb" /><span className="art-ring" />{children}</div>;
}
function MiniChart({ negative = false }: { negative?: boolean }) {
  return <svg className={`mini-chart ${negative ? "down" : "up"}`} viewBox="0 0 100 80" aria-label={negative ? "Illustrative declining chart" : "Illustrative rising chart"}>
    <polyline points={negative ? inversePath : numberPath} fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
function PriceChart({ negative = false }: { negative?: boolean }) {
  return <svg className={`price-chart ${negative ? "negative" : ""}`} viewBox="0 0 650 240" preserveAspectRatio="none" role="img" aria-label="Illustrative price movement, not market data">
    <defs><linearGradient id="fadeCurve" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={negative ? "#f056a7" : "#2fd28a"} stopOpacity=".2"/><stop offset="100%" stopColor={negative ? "#f056a7" : "#2fd28a"} stopOpacity="0"/></linearGradient></defs>
    {[40,90,140,190].map(y=><line key={y} x1="0" x2="650" y1={y} y2={y} stroke="#f0f0f0" />)}
    <path d={negative ? "M0 40 C80 55 100 42 155 85 S255 85 310 125 S410 120 470 177 S570 160 650 217" : "M0 206 C58 203 82 166 140 169 S240 152 288 123 S370 139 422 93 S525 96 565 46 S620 66 650 22"} fill="none" stroke={negative ? "#f056a7" : "#28c983"} strokeWidth="3" strokeLinecap="round" />
    <path d={negative ? "M0 40 C80 55 100 42 155 85 S255 85 310 125 S410 120 470 177 S570 160 650 217 V240 H0 Z" : "M0 206 C58 203 82 166 140 169 S240 152 288 123 S370 139 422 93 S525 96 565 46 S620 66 650 22 V240 H0 Z"} fill="url(#fadeCurve)"/>
  </svg>;
}
function readLocal<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}

export default function Looke() {
  const [page, setPage] = useState<Page>("explore");
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof navFilters)[number]>("All");
  const [tab, setTab] = useState<"Trending" | "Top" | "New">("Trending");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedNft, setSelectedNft] = useState<Uniq | null>(null);
  const [composerType, setComposerType] = useState<ComposerType>("Content coin");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(r=>r.json()).then(data=>{setAuthenticated(!!data.authenticated);setAuthenticatedAddress(data.authenticated && typeof data.profile?.evm_address === "string" ? data.profile.evm_address : null);}).catch(()=>{});
    setSaved(readLocal<string[]>("looke:saved", []));
    setLiked(readLocal<string[]>("looke:liked", []));
    setFollowing(readLocal<string[]>("looke:following", []));
    setDrafts(readLocal<Draft[]>("looke:drafts", []));
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("looke:saved", JSON.stringify(saved)); }, [saved, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("looke:liked", JSON.stringify(liked)); }, [liked, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("looke:following", JSON.stringify(following)); }, [following, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("looke:drafts", JSON.stringify(drafts)); }, [drafts, hydrated]);
  useEffect(() => {
    const syncPage = () => {
      setPage(pageFromHash(window.location.hash));
      setSelectedCoin(null);
      setMenuOpen(false);
    };
    syncPage();
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);
    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
    };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setModal(null);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredCoins = useMemo(() => {
    const query = search.trim().toLowerCase();
    let set = coins.filter(c => {
      const matchesSearch = !query || [c.name,c.ticker,c.kind,c.description].some(v=>v.toLowerCase().includes(query));
      const matchesFilter = filter === "All" || filter === "Gaming" || filter === "Art" || c.kind === (filter === "Creators" ? "Creator" : filter === "Trends" ? "Trend" : "Content");
      return matchesSearch && matchesFilter;
    });
    if (filter === "Gaming") set = set.filter(c => ["nova","pixel","neon"].includes(c.id));
    if (filter === "Art") set = set.filter(c => ["afterglow","orbit","pixel"].includes(c.id));
    if (tab === "Trending") return [...set].sort((a,b) => b.change - a.change);
    if (tab === "New") return [...set].sort((a,b) => parseAgeHours(a.age) - parseAgeHours(b.age));
    set = [...set].sort((a,b) => parseCompactNumber(b.cap) - parseCompactNumber(a.cap));
    return sortDesc ? set : set.reverse();
  }, [search, filter, tab, sortDesc]);
  const searchPosts = posts.filter(p => [p.title,p.author,p.text].join(" ").toLowerCase().includes(search.toLowerCase()));
  const searchNfts = uniqs.filter(n => [n.title,n.creator,n.edition].join(" ").toLowerCase().includes(search.toLowerCase()));

  function toggle<T>(value: T, existing: T[], setter: (values: T[])=>void) {
    setter(existing.includes(value) ? existing.filter(v=>v!==value) : [...existing,value]);
  }
  function go(to: Page) {
    setPage(to);
    setSelectedCoin(null);
    setMenuOpen(false);
    if (window.location.hash !== `#${to}`) window.history.pushState(null, "", `#${to}`);
  }
  function openCreate(type: ComposerType = "Content coin") { setComposerType(type); setDraftTitle(""); setDraftCaption(""); setModal("create"); }
  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftTitle.trim()) return;
    const draft: Draft = {id:`draft-${Date.now()}`,type:composerType,title:draftTitle.trim().slice(0,70),caption:draftCaption.trim().slice(0,320),created:new Date().toISOString()};
    setDrafts(existing=>[draft,...existing]);
    setModal(null);
    setToast("Saved a local preview draft — nothing was published on Ultra.");
    go("profile");
  }
  const handleShare = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setToast("Copied to clipboard"); }
    catch { setToast("Copy is unavailable in this browser"); }
  };
  const closeModal = () => setModal(null);

  return <div className="site-shell">
    <a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById("main-content")?.focus();}}>Skip to main content</a>
    <header className="topbar">
      <button className="brand" onClick={()=>go("explore")} aria-label="Looke home"><Mark/><span className="brand-word">looke<span className="brand-period">.</span></span></button>
      <div className="search-wrap"><Search size={17}/><input aria-label="Search creators, coins, posts or NFTs" placeholder="Search Looke creators, posts, and preview coins..." value={search} onChange={e=>{setSearch(e.target.value);if(page!=="explore")go("explore");}}/>{search && <button aria-label="Clear search" onClick={()=>setSearch("")}><X size={15}/></button>}</div>
      <div className="header-actions"><span className="network-pill"><span className="pulse-dot"/>Ultra · Preview</span><button className="text-button login-button" onClick={()=>setModal("login")}>{connectedWallet ? connectedWallet.address.slice(0,9)+"…" : "Connect"}</button><button className="primary-button signup-button" onClick={()=>setModal("login")}>{authenticated ? "Signed in" : "Sign up"} <ArrowUpRight size={14}/></button><button className="mobile-menu" aria-label="Toggle menu" aria-controls="looke-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}><Menu size={21}/></button></div>
    </header>

    <aside id="looke-navigation" aria-label="Primary navigation" className={`left-rail ${menuOpen ? "rail-open" : ""}`}>
      <div className="rail-links">
        <NavButton icon={<Home size={21}/>} label="Explore" active={page==="explore"} onClick={()=>go("explore")}/>
        <NavButton icon={<TrendingUp size={21}/>} label="Feed" active={page==="feed"} onClick={()=>go("feed")}/>
        <NavButton icon={<Compass size={21}/>} label="NFTs" active={page==="nfts"} onClick={()=>go("nfts")}/>
        <button className="rail-create" onClick={()=>openCreate()} aria-label="Create a coin or NFT"><Plus size={22}/></button>
        <NavButton icon={<Bell size={20}/>} label="Activity" active={page==="activity"} onClick={()=>go("activity")}/>
        <NavButton icon={<UserRound size={20}/>} label="Profile" active={page==="profile"} onClick={()=>go("profile")}/>
      </div>
      <div className="rail-bottom"><NavButton icon={<Settings2 size={20}/>} label="Settings" active={page==="settings"} onClick={()=>go("settings")}/><span className="rail-wordmark">looke</span></div>
    </aside>

    <main id="main-content" tabIndex={-1} className="main-view">
      <div className="preview-notice"><Info size={14}/> Product preview — all coins, prices, activity and collectibles shown are fictional. <button onClick={()=>go("settings")}>How it works <ArrowRight size={13}/></button></div>
      {selectedCoin ? <CoinDetail coin={selectedCoin} onBack={()=>setSelectedCoin(null)} onTrade={()=>setModal("trade")} saved={saved.includes(selectedCoin.id)} onSave={()=>toggle(selectedCoin.id,saved,setSaved)} /> : <>
      {page === "explore" && <section className="explore-page">
        <div className="ticker-row"><button className="ticker-all" onClick={()=>setFilter("All")}>All <ChevronDown size={13}/></button>{["Creators","Gaming","Art","Trends"].map((tag,i)=><button key={tag} className="ticker-chip" aria-pressed={filter===tag} onClick={()=>setFilter(tag as (typeof navFilters)[number])}><span className={`ticker-dot ticker-${i}`}>{["✦","◈","✳","⌁"][i]}</span>{tag}</button>)}<span className="ticker-divider"/><button className="ticker-chip" onClick={()=>openCreate("Trend coin")}><span className="ticker-dot ticker-plus">+</span> Launch a trend</button></div>
        <div className="section-top"><div><span className="eyebrow">Discover what&apos;s moving</span><h1>Explore <span className="heading-soft">the moment.</span></h1><p>Culture, creativity, and communities — all in one place.</p></div><button className="subtle-cta" onClick={()=>openCreate()}>Create <Plus size={17}/></button></div>
        <DiscoveryHub headerQuery={search} /><div className="market-controls"><div className="tab-group">{["Trending","Top","New"].map(value=><button key={value} className={tab===value?"active-tab":""} aria-pressed={tab===value} onClick={()=>setTab(value as typeof tab)}>{value}</button>)}</div><div className="filter-group"><span className="tiny-label">Filter by</span><select aria-label="Filter coins" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>{navFilters.map(f=><option key={f}>{f}</option>)}</select></div></div>
        <div className="market-table"><div className="table-head"><span>Coin</span><button aria-label={`Sort demo market cap ${tab==="Top" && sortDesc ? "ascending" : "descending"}`} onClick={()=>{if(tab==="Top")setSortDesc(!sortDesc);else{setTab("Top");setSortDesc(true);}}}>Market cap <ChevronDown size={12}/></button><span>24h volume</span><span>Holders</span><span>Age</span><span>24h change</span></div>
          {filteredCoins.length ? filteredCoins.map(c=><button className="market-row" key={c.id} onClick={()=>setSelectedCoin(c)}><span className="coin-name"><CoinAvatar coin={c}/><span><strong>{c.name}</strong><small>{c.ticker} <span className="verified-dot">✓</span></small></span></span><span className="numeric-cell">{c.cap}</span><span className="numeric-cell">{c.volume}</span><span className="numeric-cell">{c.holders}</span><span className="numeric-cell">{c.age}</span><span className={`percent ${c.change<0?"negative":"positive"}`}>{c.change>0?"+":""}{c.change.toFixed(2)}% <ArrowUpRight size={13}/></span></button>) : <EmptyState label="No coins match this search" hint="Try another name or category."/>}
        </div>
        <NetworkStatus /><LiveCoins /><CreatorDirectory /><div className="explore-bottom"><span><span className="tiny-circle"/> Market figures are illustrative, not live Ultra data.</span><button onClick={()=>go("feed")}>See creator feed <ArrowRight size={15}/></button></div>
        <div className="feature-banner"><div><span className="eyebrow">MORE TO DISCOVER</span><h2>Every great idea starts somewhere.</h2><p>Make your first coin or explore one-of-a-kind Uniqs on Ultra.</p><button onClick={()=>openCreate()}>Start creating <ArrowUpRight size={16}/></button></div><div className="banner-sculpture"><span/><span/><span/></div></div>
      </section>}
      {page === "feed" && <section className="feed-page"><div className="feed-header"><span className="eyebrow">YOUR CORNER OF THE INTERNET</span><h1>The feed<span className="brand-period">.</span></h1><p>Stories worth discovering. People worth following.</p></div><div className="feed-column"><SocialLive authenticated={authenticated} onRequireLogin={()=>setModal("login")} /><div style={{borderTop:"1px solid #eee",marginTop:28,paddingTop:20}}>
        <span className="eyebrow">ILLUSTRATIVE PREVIEW CONTENT</span>
        <p style={{fontSize:12,color:"#929297",marginTop:6}}>The examples below are fictional and are not part of the real ranked social feed.</p>
      </div>
      {searchPosts.length ? searchPosts.map(p=><FeedCard key={p.id} post={p} coin={coins.find(c=>c.id===p.coinId)!} liked={liked.includes(p.id)} following={following.includes(p.author)} onLike={()=>toggle(p.id,liked,setLiked)} onFollow={()=>toggle(p.author,following,setFollowing)} onOpenCoin={()=>setSelectedCoin(coins.find(c=>c.id===p.coinId)!)} onShare={()=>handleShare(`Looke preview: ${p.title}`)} />) : <EmptyState label="No posts found" hint="Try clearing your search."/>}</div></section>}
      {page === "nfts" && <section className="nfts-page"><div className="nft-hero"><div><span className="eyebrow">UNIQS ON ULTRA</span><h1>Made to be <em>collected.</em></h1><p>Discover digital objects with a story. Create and explore original Uniq collections on Ultra.</p><button onClick={()=>openCreate("Uniq NFT")}>Create a Uniq <ArrowUpRight size={17}/></button></div><div className="nft-hero-art"><div className="nft-moon"/></div></div><NativeUniqs account={connectedWallet?.kind === "Ultra Native" ? connectedWallet.address : null} /><NativeUniqMintLab account={connectedWallet?.kind === "Ultra Native" ? connectedWallet.address : null} /><div className="section-title-row"><div><span className="eyebrow">GALLERY PREVIEW</span><h2>Discover collections</h2></div><span className="label-preview">Illustrative collectibles</span></div><div className="nft-grid">{searchNfts.length ? searchNfts.map(n=><button className="nft-card" key={n.id} onClick={()=>{setSelectedNft(n);setModal("nft");}}><Art name={n.art}/><div className="nft-card-meta"><strong>{n.title}</strong><span>{n.creator}</span><small>{n.edition} <ArrowUpRight size={14}/></small></div></button>) : <EmptyState label="No collections found" hint="Try a different search."/>}</div></section>}
      {page === "activity" && <section className="simple-page"><span className="eyebrow">YOUR SPACE</span><h1>Activity<span className="brand-period">.</span></h1><div className="quiet-panel"><span className="quiet-icon"><Activity size={26}/></span><h2>No on-chain activity yet</h2><p>Social notifications appear below once signed in. Onchain purchases, creator earnings and trades require separately verified contracts. Your local preview actions don&apos;t create blockchain transactions.</p><button onClick={()=>go("explore")}>Explore coins <ArrowRight size={16}/></button></div><Notifications authenticated={authenticated} onLogin={()=>setModal("login")} /></section>}
      {page === "profile" && <section className="simple-page profile-page"><span className="eyebrow">YOUR SPACE</span><h1>Your profile<span className="brand-period">.</span></h1><div className="profile-hero"><Mark/><div><h2>Future creator</h2><span>{connectedWallet ? `Connected ${connectedWallet.kind}: ${connectedWallet.address}` : "Connect an Ultra wallet for testnet access"}</span></div><button onClick={()=>setModal("login")}>Connect wallet <Wallet size={15}/></button></div><ProfileEditor authenticated={authenticated} onLogin={()=>setModal("login")} /><CreatorCoinLab authenticated={authenticated} onRequireLogin={()=>setModal("login")} connectedWalletAddress={connectedWallet?.kind==="Ultra EVM"?connectedWallet.address:null}/><EvmPortfolio address={connectedWallet?.kind === "Ultra EVM" ? connectedWallet.address : null} /><div className="profile-stats"><div><strong>{drafts.length}</strong><span>Local drafts</span></div><div><strong>{saved.length}</strong><span>Watchlisted coins</span></div><div><strong>{following.length}</strong><span>Following in preview</span></div></div><div className="section-title-row"><h2>Your drafts</h2><button onClick={()=>openCreate()}>New draft <Plus size={15}/></button></div>{drafts.length ? <div className="draft-list">{drafts.map(d=><div className="draft-item" key={d.id}><span className="draft-icon"><ImageIcon size={19}/></span><div><strong>{d.title}</strong><small>{d.type} · saved locally · {new Date(d.created).toLocaleDateString()}</small><p>{d.caption || "No description yet"}</p></div><button aria-label={`Delete ${d.title}`} onClick={()=>setDrafts(existing=>existing.filter(x=>x.id!==d.id))}><X size={16}/></button></div>)}</div> : <div className="subtle-empty">Nothing here yet. <button onClick={()=>openCreate()}>Create your first draft <ArrowRight size={14}/></button></div>}<div className="section-title-row"><h2>Watchlist</h2><span className="tiny-label">Saved on this device</span></div>{saved.length ? <div className="watchlist-grid">{coins.filter(c=>saved.includes(c.id)).map(c=><button key={c.id} onClick={()=>setSelectedCoin(c)}><CoinAvatar coin={c}/><strong>{c.name}</strong><span>{c.ticker}</span><ArrowRight size={16}/></button>)}</div> : <div className="subtle-empty">Save coins from Explore to see them here.</div>}</section>}
      {page === "settings" && <section className="simple-page settings-page"><span className="eyebrow">ABOUT THIS PREVIEW</span><h1>Settings &amp; status<span className="brand-period">.</span></h1><AccountSecurity authenticated={authenticated} onRequireLogin={()=>setModal("login")} onLoggedOut={()=>{setAuthenticated(false);setAuthenticatedAddress(null);setToast("Signed out of all Looke sessions.");}} /><div className="settings-stack"><div className="settings-item"><div className="settings-icon"><ShieldCheck size={23}/></div><div><h2>Safe preview mode</h2><p>Wallet connection may be available on testnet; it is not login or signing authorization. Trading, token issuance, NFT purchases and minting are not enabled. None of the on-screen balances or market figures are real.</p></div><span className="state-tag">Preview</span></div><div className="settings-item"><div className="settings-icon"><Wallet size={23}/></div><div><h2>Ultra blockchain</h2><p>Testnet wallet connection is available. Signed login, on-chain indexing, Uniq factory management and settlement must be built and verified on Ultra testnet.</p></div><span className="state-tag">{connectedWallet ? "Testnet wallet" : "Not connected"}</span></div><div className="settings-item"><div className="settings-icon"><Bookmark size={23}/></div><div><h2>Browser data</h2><p>Drafts, likes, follows and watchlists live only in this browser. Clearing them doesn&apos;t affect any blockchain data.</p><button className="clear-data" onClick={()=>{setDrafts([]);setSaved([]);setLiked([]);setFollowing([]);setToast("Cleared Looke preview data on this device.");}}>Clear preview data</button></div></div><div className="settings-item"><div className="settings-icon"><ExternalLink size={23}/></div><div><h2>Open-source development</h2><p>Track the UI foundation and planned Ultra integrations in the Looke repository.</p><a href="https://github.com/mushee-io/Looke" target="_blank" rel="noreferrer">View GitHub <ArrowUpRight size={14}/></a></div></div></div></section>}
      </>}
    </main>
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}</div>}
    {modal && <div className="modal-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><div ref={dialogRef} tabIndex={-1} className={`modal-card ${modal==="create" ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={modal === "login" ? "Log in" : modal === "create" ? "Create" : modal === "trade" ? "Trading preview" : "Uniq preview"}><button className="modal-close" onClick={closeModal} aria-label="Close dialog"><X size={18}/></button>
      {modal==="login" && <div className="login-modal"><Mark/><h2>Welcome to Looke</h2><p>One home for every creator on Ultra.</p><WalletConnection authenticated={authenticated} sessionAddress={authenticatedAddress} onConnected={wallet=>{setConnectedWallet(wallet);setToast("Testnet wallet connected. Sign the login challenge to activate social features.");}} onAuthenticated={address=>{setAuthenticated(true);setAuthenticatedAddress(address);setToast("Signed in to Looke social.");setModal(null);}} onLoggedOut={()=>{setAuthenticated(false);setAuthenticatedAddress(null);setToast("Signed out of Looke social.");}} onDisconnected={kind=>setConnectedWallet(current=>current?.kind===kind?null:current)} /></div>}
      {modal==="create" && <form className="create-modal" onSubmit={saveDraft}><span className="eyebrow">CREATE ON LOOKE</span><h2>Something worth sharing.</h2><p>Start a draft. On-chain publication and token creation will be enabled after Ultra integration.</p><div className="composer-picks">{(["Content coin","Creator coin","Trend coin","Uniq NFT"] as ComposerType[]).map(t=><button type="button" className={composerType===t?"picked":""} key={t} onClick={()=>setComposerType(t)}>{t==="Uniq NFT"?<ImageIcon size={17}/>:t==="Creator coin"?<UserRound size={17}/>:t==="Trend coin"?<TrendingUp size={17}/>:<Sparkles size={17}/>}<span>{t}</span></button>)}</div><label className="field-label">{composerType === "Uniq NFT" ? "Collection or Uniq title" : "Title"}<input required maxLength={70} placeholder={composerType === "Uniq NFT" ? "Name your digital collectible" : "Give your idea a name"} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)}/></label><label className="field-label">Description (optional)<textarea maxLength={320} rows={3} value={draftCaption} onChange={e=>setDraftCaption(e.target.value)} placeholder="Tell the world what this means..." /></label><div className="draft-note"><Info size={16}/> This saves a local draft only; no media upload, token mint, listing or blockchain transaction occurs.</div><button type="submit" className="primary-button full-button">Save draft <ArrowRight size={17}/></button></form>}
      {modal==="trade" && <div className="trade-modal"><div className="modal-bubble"><Wallet size={25}/></div><h2>Ultra trading is coming.</h2><p>Token swaps require audited Ultra-native liquidity, signed wallet transactions, and canonical balance/indexer confirmation. They are not active in this preview.</p><div className="trade-status"><span>On-chain trading</span><strong>Not enabled</strong></div><div className="trade-status"><span>Wallet connection</span><strong>Not connected</strong></div><button className="primary-button full-button" onClick={closeModal}>Back to Explore <ArrowRight size={16}/></button></div>}
      {modal==="nft" && selectedNft && <div className="nft-modal"><Art name={selectedNft.art}/><span className="eyebrow">UNIQ CONCEPT · NOT ON CHAIN</span><h2>{selectedNft.title}</h2><p>{selectedNft.creator} · {selectedNft.edition}</p><p className="modal-footnote">This is sample gallery art, not an existing Ultra Uniq. Minting and purchasing require wallet and contract integration.</p><button className="primary-button full-button" onClick={()=>openCreate("Uniq NFT")}>Make your own draft <Plus size={16}/></button></div>}
    </div></div>}
  </div>;
}

function NavButton({icon,label,active,onClick}:{icon:ReactNode;label:string;active:boolean;onClick:()=>void}) {
  return <button className={`rail-button ${active ? "is-active" : ""}`} aria-label={label} aria-current={active?"page":undefined} title={label} onClick={onClick}>{icon}</button>;
}
function EmptyState({label,hint}:{label:string;hint:string}) {
  return <div className="empty-state"><Compass size={26}/><strong>{label}</strong><span>{hint}</span></div>;
}
function CoinDetail({coin,onBack,onTrade,saved,onSave}:{coin:Coin;onBack:()=>void;onTrade:()=>void;saved:boolean;onSave:()=>void}) {
  return <section className="coin-detail"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back to Explore</button><div className="coin-detail-header"><CoinAvatar coin={coin} size="large"/><div><span className="eyebrow">{coin.kind.toUpperCase()} COIN · DEMO</span><h1>{coin.name}</h1><p>${coin.ticker} <span className="verified-dot">✓</span></p></div><button className={`save-button ${saved?"saved":""}`} onClick={onSave}>{saved?<Check size={17}/>:<Bookmark size={17}/>} {saved?"Saved":"Watchlist"}</button></div><div className="coin-detail-grid"><div className="chart-card"><div className="chart-head"><div><small>Illustrative market cap</small><strong>{coin.cap}</strong><span className={coin.change<0?"negative":"positive"}>{coin.change>0?"+":""}{coin.change.toFixed(2)}% · 24h</span></div><span className="chart-period">1D &nbsp; 1W &nbsp; <b>1M</b> &nbsp; ALL</span></div><PriceChart negative={coin.change<0}/><div className="chart-labels"><span>30 days ago</span><span>15 days ago</span><span>Today</span></div><p className="chart-warning">Fictional sample chart. Not price history or trade data.</p></div><div className="trade-card"><span className="eyebrow">TRADE PREVIEW</span><h2>Own a piece of this idea.</h2><p>{coin.description}</p><div className="trade-toggle"><span>Buy</span><span>Sell</span></div><div className="trade-input"><small>You pay (demo)</small><strong>0.00 <span>UOS</span></strong></div><div className="trade-input"><small>You receive</small><strong>0.00 <span>${coin.ticker}</span></strong></div><button onClick={onTrade}>Trading not enabled <ArrowRight size={16}/></button><small className="trade-disclaimer">No quotes, balances or swaps are live.</small></div></div><div className="coin-stats"><div><span>24h volume (demo)</span><strong>{coin.volume}</strong></div><div><span>Holders (demo)</span><strong>{coin.holders}</strong></div><div><span>Age (demo)</span><strong>{coin.age}</strong></div><div><span>Coin type</span><strong>{coin.kind}</strong></div></div></section>;
}
function FeedCard({post,coin,liked,following,onLike,onFollow,onOpenCoin,onShare}:{post:FeedPost;coin:Coin;liked:boolean;following:boolean;onLike:()=>void;onFollow:()=>void;onOpenCoin:()=>void;onShare:()=>void}) {
  return <article className="feed-card"><div className="feed-card-header"><div className="creator-avatar">{post.author[0].toUpperCase()}</div><div className="creator-meta"><strong>{post.author}</strong><small>{post.handle} · {post.ago}</small></div><button onClick={onFollow} className={`follow-button ${following?"following":""}`}>{following?<><Check size={14}/> Following</>:<><Plus size={14}/> Follow</>}</button><button onClick={onShare} className="icon-quiet" title="Share preview"><MoreHorizontal size={19}/></button></div><div className="feed-card-copy"><h2>{post.title}</h2><p>{post.text}</p></div><button className="feed-art-button" onClick={onOpenCoin} aria-label={`View illustrative coin ${coin.name}`}><Art name={post.image}/></button><div className="feed-card-footer"><button onClick={onOpenCoin} className="linked-coin"><CoinAvatar coin={coin}/><span><small>Linked coin · demo</small><strong>${coin.ticker} <ArrowUpRight size={12}/></strong></span></button><div className="social-actions"><button className={liked?"liked":""} aria-label={liked?"Unlike":"Like"} onClick={onLike}><Heart size={18} fill={liked?"currentColor":"none"}/> {post.likes+(liked?1:0)}</button><button onClick={onShare}><Share2 size={17}/></button></div></div></article>;
}
