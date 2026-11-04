"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { UltraWalletSDK } from "@ultraos/wallet-sdk";
import {
  createFactoryAction, mintUniqAction, listUniqAction, cancelListingAction, buyUniqAction,
  nativeTxUrl, parseWalletHash, positiveId, validateNativeAccount,
  ULTRA_NATIVE_TESTNET,
  type NativeAction, type UniqFactory, type UniqListing, type UniqToken,
} from "../../lib/ultra-native";
import {
  processedBlock, queryFactory, queryListing, queryListings, queryNativeStatus,
  queryOwnedUniqs, waitUntilIrreversible,
} from "../../lib/ultra-native-client";
import "./uniqs.css";

type Tab = "inventory" | "collections" | "market" | "studio";
type Kind = "factory" | "mint" | "list" | "cancel" | "buy";
type Preview = {
  kind: Kind; action: NativeAction; summary: string; account: string;
  subjectId?: string; priorIds?: string[]; quotedPrice?: string;
};
type TransactionState = { hash: string; verified: boolean; message: string } | null;
let nativeWallet: UltraWalletSDK | undefined;
function getWallet(): UltraWalletSDK {
  if (typeof window === "undefined") throw new Error("Native Ultra Wallet requires a browser.");
  // Force Testnet extension: Ultra Web Wallet is mainnet-only as of SDK 0.6.1.
  return (nativeWallet ??= new UltraWalletSDK({ environment: "testnet", provider: "extension" }));
}
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Ultra Wallet or RPC request failed.";
}
function parseOwnedList(value: unknown): UniqToken[] {
  if (typeof value !== "object" || value === null || !("rows" in value)) throw new Error("Invalid native inventory response.");
  const rows = (value as { rows: unknown }).rows;
  if (!Array.isArray(rows)) throw new Error("Invalid native inventory rows.");
  return rows as UniqToken[];
}

export default function UniqStudio() {
  const [tab, setTab] = useState<Tab>("inventory");
  const [account, setAccount] = useState("");
  const [lookup, setLookup] = useState("");
  const [network, setNetwork] = useState<"checking" | "online" | "offline">("checking");
  const [block, setBlock] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<UniqToken[]>([]);
  const [inventoryNext, setInventoryNext] = useState("");
  const [market, setMarket] = useState<UniqListing[]>([]);
  const [marketNext, setMarketNext] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [factory, setFactory] = useState<UniqFactory | null>(null);
  const [ownerNotice, setOwnerNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transaction, setTransaction] = useState<TransactionState>(null);

  const [factoryURI, setFactoryURI] = useState("");
  const [defaultTokenURI, setDefaultTokenURI] = useState("");
  const [maxMintable, setMaxMintable] = useState("100");
  const [ramCap, setRamCap] = useState("2");
  const [mintFactoryId, setMintFactoryId] = useState("");
  const [mintReceiver, setMintReceiver] = useState("");
  const [mintMetadataURI, setMintMetadataURI] = useState("");
  const [selectedTokenId, setSelectedTokenId] = useState("");
  const [listingPrice, setListingPrice] = useState("1");
  const [studioMode, setStudioMode] = useState<"factory" | "mint" | "list">("factory");

  const clearReview = () => { setPreview(null); setTransaction(null); setError(""); };

  const loadStatus = useCallback(async () => {
    setNetwork("checking");
    try {
      const info = await queryNativeStatus();
      if (info.chainId !== ULTRA_NATIVE_TESTNET.chainId) throw new Error("Native Testnet network mismatch.");
      setBlock(info.irreversibleBlock);
      setNetwork("online");
    } catch (e) {
      setNetwork("offline");
      setError(describeError(e));
    }
  }, []);

  const refreshAccount = useCallback(async (owner: string) => {
    if (!owner) return;
    setLoading(true);
    try {
      const result = await queryOwnedUniqs(validateNativeAccount(owner));
      setInventory(result.rows);
      setInventoryNext(result.more ? result.next_key : "");
      setOwnerNotice(`Inventory read from native Ultra Testnet: ${result.rows.length} Uniq(s) in this page.`);
      setBlock(result.irreversibleBlock);
    } catch (e) {
      setInventory([]); setInventoryNext("");
      setError(describeError(e));
    } finally { setLoading(false); }
  }, []);

  const refreshMarket = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryListings();
      setMarket(result.rows);
      setMarketNext(result.more ? result.next_key : "");
      setBlock(result.irreversibleBlock);
    } catch (e) {
      setMarket([]); setMarketNext("");
      setError(describeError(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadStatus(); void refreshMarket(); }, [loadStatus, refreshMarket]);

  function connectNative() {
    if (connecting) return;
    setError(""); setConnecting(true);
    // Request is called synchronously from the user's click, before any remote fetch.
    void getWallet().connect()
      .then(async response => {
        const name = validateNativeAccount(response.data.blockchainid);
        setAccount(name); setLookup(name); setMintReceiver(name); clearReview();
        await refreshAccount(name);
      })
      .catch(e => setError(describeError(e)))
      .finally(() => setConnecting(false));
  }

  async function inspectFactory(event?: FormEvent) {
    event?.preventDefault();
    setError(""); setFactory(null);
    try {
      const result = await queryFactory(positiveId(factoryId));
      setFactory(result.factory);
      setBlock(result.irreversibleBlock);
      if (!result.factory) setError("No Uniq factory with this ID was found in the Testnet table.");
    } catch (e) { setError(describeError(e)); }
  }

  async function loadMoreOwned() {
    if (!inventoryNext || !lookup) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/uniqs?kind=owned&account=${encodeURIComponent(lookup)}&cursor=${encodeURIComponent(inventoryNext)}&limit=50`, { cache: "no-store" });
      const data = await response.json() as { rows?: UniqToken[]; more?: boolean; next_key?: string; error?: string };
      if (!response.ok || !data.rows) throw new Error(data.error || "Could not load more owned Uniqs.");
      setInventory(current => [...current, ...data.rows!.filter(row => !current.some(item => item.id === row.id))]);
      setInventoryNext(data.more ? data.next_key || "" : "");
    } catch (e) { setError(describeError(e)); } finally { setLoading(false); }
  }

  async function loadMoreListings() {
    if (!marketNext) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/uniqs?kind=listings&cursor=${encodeURIComponent(marketNext)}&limit=50`, { cache: "no-store" });
      const data = await response.json() as { rows?: UniqListing[]; more?: boolean; next_key?: string; error?: string };
      if (!response.ok || !data.rows) throw new Error(data.error || "Could not load more listings.");
      setMarket(current => [...current, ...data.rows!.filter(row => !current.some(item => item.token_id === row.token_id))]);
      setMarketNext(data.more ? data.next_key || "" : "");
    } catch (e) { setError(describeError(e)); } finally { setLoading(false); }
  }

  async function prepareFactory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setTransaction(null); setPreview(null);
    try {
      if (!account) throw new Error("Connect Ultra native Testnet wallet first.");
      if (network !== "online") throw new Error("Native Testnet RPC is not available.");
      const action = createFactoryAction({ account, factoryURI, defaultTokenURI, maxMintable, maxUos: ramCap });
      setPreview({ account, kind: "factory", action,
        summary: `Create active native Uniq factory, managed and created by ${account}, maximum ${maxMintable} NFTs. Metadata: ${factoryURI}. Default token URI: ${defaultTokenURI}. RAM payment cap: ${ramCap} UOS.` });
    } catch (e) { setError(describeError(e)); }
  }

  async function prepareMint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setTransaction(null); setPreview(null);
    try {
      if (!account) throw new Error("Connect Ultra native Testnet wallet first.");
      if (network !== "online") throw new Error("Native Testnet RPC is not available.");
      const target = positiveId(mintFactoryId);
      const { factory: stored } = await queryFactory(target);
      if (!stored) throw new Error("Factory was not found on native Testnet.");
      if (stored.asset_manager !== account) throw new Error("Only the factory manager can mint using this form. Authorized minter support requires an additional review.");
      if (stored.stat !== 0) throw new Error("Factory is not marked active; minting is disabled.");
      const action = mintUniqAction({ account, factoryId: target, receiver: mintReceiver, maxUos: ramCap, metadataUri: mintMetadataURI });
      const prior = await queryOwnedUniqs(validateNativeAccount(mintReceiver));
      if (prior.more) throw new Error("Recipient has more than 50 Uniqs; full ownership snapshot is required before an independently verified mint.");
      setPreview({ account, kind: "mint", action, subjectId: target,
        priorIds: prior.rows.map(item => item.id),
        summary: `Mint 1 Uniq from factory #${target} to ${mintReceiver}; Testnet RAM payment cap ${ramCap} UOS.` });
    } catch (e) { setError(describeError(e)); }
  }

  async function prepareList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setTransaction(null); setPreview(null);
    try {
      if (!account) throw new Error("Connect Ultra native Testnet wallet first.");
      if (lookup !== account) throw new Error("Load the connected account's inventory before listing.");
      const id = positiveId(selectedTokenId);
      if (!inventory.some(token => token.id === id)) throw new Error("This Uniq is not in the loaded connected-wallet inventory.");
      const existing = await queryListing(id);
      if (existing.listing) throw new Error("This Uniq is already listed for resale.");
      const action = listUniqAction({ owner: account, tokenId: id, priceUos: listingPrice });
      setPreview({ account, kind: "list", action, subjectId: id,
        summary: `List Uniq #${id} for ${action.data.resell && (action.data.resell as { price: string }).price}; no extra promoter commission.` });
    } catch (e) { setError(describeError(e)); }
  }

  async function prepareCancel(listing: UniqListing) {
    setError(""); setTransaction(null); setPreview(null);
    try {
      if (!account || listing.owner !== account) throw new Error("Only the listed owner can cancel this resale.");
      const { listing: current } = await queryListing(listing.token_id);
      if (!current || current.owner !== account) throw new Error("Listing owner changed; refresh the market.");
      setPreview({ kind: "cancel", account, subjectId: listing.token_id, action: cancelListingAction({ tokenId: listing.token_id }),
        summary: `Cancel listing for Uniq #${listing.token_id}. Current on-chain price: ${current.price}.` });
    } catch (e) { setError(describeError(e)); }
  }

  async function prepareBuy(listing: UniqListing) {
    setError(""); setTransaction(null); setPreview(null);
    try {
      if (!account) throw new Error("Connect Ultra native Testnet wallet to purchase.");
      if (listing.owner === account) throw new Error("You already own this Uniq.");
      const { listing: current } = await queryListing(listing.token_id);
      if (!current || current.owner !== listing.owner || current.price !== listing.price) {
        throw new Error("Listing price or seller changed; refresh the market.");
      }
      if (!current.price.endsWith(" UOS")) throw new Error("Only UOS-denominated listings are enabled in M3.");
      const quotedPrice = current.price.replace(/ UOS$/, "");
      const action = buyUniqAction({ buyer: account, tokenId: current.token_id, maxPriceUos: quotedPrice });
      setPreview({ kind: "buy", account, subjectId: current.token_id, action, quotedPrice: current.price,
        summary: `Purchase Uniq #${current.token_id} from ${current.owner}. Maximum approved spend: ${current.price}. Check fees and wallet transaction before accepting.` });
    } catch (e) { setError(describeError(e)); }
  }

  async function verifyOnChain(review: Preview, result: unknown): Promise<boolean> {
    const executed = processedBlock(result);
    if (!executed) return false;
    const irreversible = await waitUntilIrreversible(executed);
    if (!irreversible) return false;
    if (review.kind === "factory") {
      // Factory ID is assigned by the chain. An indexer or operator proof is needed to
      // attribute the newly created ID; never infer one from the table's next ID.
      return false;
    }
    if (!review.subjectId) return false;
    if (review.kind === "list") {
      const { listing } = await queryListing(review.subjectId);
      const price = (review.action.data.resell as { price: string }).price;
      return listing?.owner === review.account && listing.price === price;
    }
    if (review.kind === "cancel" || review.kind === "buy") {
      const { listing } = await queryListing(review.subjectId);
      if (listing) return false;
      if (review.kind === "buy") {
        const owned = await queryOwnedUniqs(review.account);
        return owned.rows.some(item => item.id === review.subjectId);
      }
      return true;
    }
    if (review.kind === "mint") {
      const receiver = (review.action.data.issue as { to: string }).to;
      const owned = await queryOwnedUniqs(receiver);
      if (owned.more) return false;
      return owned.rows.some(item =>
        item.token_factory_id === review.subjectId && !(review.priorIds || []).includes(item.id));
    }
    return false;
  }

  function submitReviewed() {
    if (!preview || submitting || account !== preview.account || network !== "online") return;
    setSubmitting(true); setError(""); setTransaction(null);
    const reviewed = preview;
    // Critical: call wallet signing directly in the click handler, no pre-sign async work.
    void getWallet().signTransaction(reviewed.action)
      .then(async result => {
        const hash = parseWalletHash(result);
        setTransaction({ hash, verified: false,
          message: "Wallet broadcast returned a hash. Waiting for irreversible native-chain confirmation; this is not yet a verified result." });
        let verified = false;
        try { verified = await verifyOnChain(reviewed, result); } catch (e) { setError(describeError(e)); }
        setTransaction({
          hash, verified,
          message: verified
            ? "Confirmed: transaction is irreversible and native-chain state matches the requested action."
            : reviewed.kind === "factory"
              ? "Submitted. Factory ID still requires independent attribution and on-chain verification via the factory lookup."
              : "Submitted, but verification is incomplete. Review the transaction and chain state before trying again.",
        });
        setPreview(null);
        if (reviewed.kind === "list" || reviewed.kind === "buy" || reviewed.kind === "cancel") await refreshMarket();
        if (reviewed.kind === "mint" || reviewed.kind === "buy") {
          if (lookup) await refreshAccount(lookup);
        }
      })
      .catch(e => setError(describeError(e)))
      .finally(() => setSubmitting(false));
  }

  return <main className="uniq-shell">
    <header className="uniq-top">
      <Link href="/" className="uniq-brand"><span className="uniq-symbol">✳</span> looke<span className="uniq-brand-blue">.</span> <span className="uniq-sub-brand">/ uniq studio</span></Link>
      <div className="uniq-network"><span className={`uniq-led ${network}`} /> ULTRA NATIVE TESTNET {block ? `· LIB ${block}` : ""}</div>
      <button className="uniq-wallet" type="button" onClick={connectNative} disabled={connecting}>{connecting ? "Connecting…" : account || "Connect Ultra Wallet"}</button>
    </header>
    <div className="uniq-body">
      <aside className="uniq-side">
        <div className="uniq-side-label">NATIVE NFT PROTOCOL</div>
        <nav aria-label="Uniq studio sections">
          {([["inventory","My Uniqs"],["collections","Collections"],["market","Marketplace"],["studio","Creator studio"]] as const)
            .map(([id,label]) => <button type="button" key={id} onClick={() => { setTab(id); clearReview(); }}
              className={tab === id ? "uniq-nav selected" : "uniq-nav"}>{label}<span>↗</span></button>)}
        </nav>
        <div className="uniq-side-footer">
          <strong>Native Ultra ≠ Ultra EVM</strong>
          <p>Uniqs use `eosio.nft.ft` on the native chain. Testnet requires the Ultra Wallet browser extension.</p>
          <a href="https://developers.ultra.io/products/ultra-wallet-sdk/getting-started" target="_blank" rel="noreferrer">Official wallet docs ↗</a>
        </div>
      </aside>
      <section className="uniq-content">
        <div className="uniq-kicker">M3 / ULTRA-NATIVE COLLECTIBLES</div>
        <h1>{tab === "inventory" ? "Your Uniqs." : tab === "collections" ? "Collections." : tab === "market" ? "The marketplace." : "Create on Ultra."}</h1>
        <p className="uniq-intro">Discover native collectibles, manage a Uniq factory and prepare wallet-approved Testnet actions. No test transactions are executed automatically.</p>
        {network === "offline" && <div className="uniq-warning">Native Testnet RPC is unavailable. All on-chain actions are blocked.</div>}
        <div className="uniq-tabline">
          {(["inventory","collections","market","studio"] as const).map(t => <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => {setTab(t); clearReview();}}>
            {t === "inventory" ? "Portfolio" : t === "collections" ? "Factories" : t === "market" ? "Listings" : "Create"}</button>)}
        </div>

        {tab === "inventory" && <>
          <div className="uniq-panel">
            <div className="uniq-panel-head"><div><div className="uniq-eyebrow">WALLET ASSETS</div><h2>Owned Uniqs</h2></div><span className="uniq-tag">Verified chain table · token.b</span></div>
            <div className="uniq-inline-form">
              <input aria-label="Ultra native account" placeholder="Enter an Ultra account" value={lookup} onChange={e => setLookup(e.target.value)} />
              <button onClick={() => { clearReview(); void refreshAccount(lookup); }} disabled={loading || network !== "online"}>Load inventory</button>
            </div>
            {ownerNotice && <p className="uniq-muted">{ownerNotice}</p>}
            {inventory.length === 0 ? <div className="uniq-empty">No owned Uniqs loaded. Connect a Testnet wallet or search an account.</div> :
              <div className="uniq-list">{inventory.map(item => <article key={item.id} className="uniq-row">
                <div className="uniq-item-icon">▧</div><div><strong>Uniq #{item.id}</strong><small>Factory #{item.token_factory_id}{item.serial_number ? ` · Serial ${item.serial_number}` : ""}</small>{item.uri && <small className="uniq-wrap">{item.uri}</small>}</div>
                {account === lookup && <button className="uniq-mini-btn" onClick={() => { setSelectedTokenId(item.id); setTab("studio"); setStudioMode("list"); clearReview(); }}>List for resale</button>}
              </article>)}</div>}
            {inventoryNext && <button className="uniq-secondary" disabled={loading} onClick={() => void loadMoreOwned()}>Load more Uniqs</button>}
          </div>
        </>}

        {tab === "collections" && <div className="uniq-panel">
          <div className="uniq-panel-head"><div><div className="uniq-eyebrow">ON-CHAIN COLLECTIONS</div><h2>Inspect a factory</h2></div><span className="uniq-tag">factory.b</span></div>
          <form className="uniq-inline-form" onSubmit={e => void inspectFactory(e)}>
            <input placeholder="Uniq factory ID" inputMode="numeric" aria-label="Uniq factory ID" value={factoryId} onChange={e => setFactoryId(e.target.value)}/>
            <button type="submit" disabled={network !== "online"}>Inspect factory</button>
          </form>
          {factory ? <div className="uniq-detail">
            <div className="uniq-hero-icon">✳</div><h2>Factory #{factory.id}</h2>
            <div className="uniq-detail-grid"><span>Creator</span><strong>{factory.asset_creator}</strong><span>Manager</span><strong>{factory.asset_manager}</strong><span>Status</span><strong>{factory.stat === 0 ? "Active" : `Not active (${factory.stat ?? "unknown"})`}</strong>
              <span>Minted</span><strong>{factory.minted_tokens_no ?? "Not reported"}</strong><span>Supply limit</span><strong>{factory.max_mintable_tokens ?? "Unlimited / unknown"}</strong></div>
            {factory.factory_uri && <p className="uniq-uri">Factory metadata: {factory.factory_uri}</p>}
            {factory.default_token_uri && <p className="uniq-uri">Default token metadata: {factory.default_token_uri}</p>}
            {account === factory.asset_manager && <button className="uniq-primary" onClick={() => { setMintFactoryId(factory.id); setStudioMode("mint"); setTab("studio"); clearReview(); }}>Mint from this factory ↗</button>}
          </div> : <div className="uniq-empty">Enter a factory ID to inspect a real Ultra Testnet collection.</div>}
        </div>}

        {tab === "market" && <div className="uniq-panel">
          <div className="uniq-panel-head"><div><div className="uniq-eyebrow">SECONDARY MARKET</div><h2>Native resale listings</h2></div><button type="button" className="uniq-secondary" onClick={() => void refreshMarket()} disabled={loading}>Refresh</button></div>
          <p className="uniq-muted">Prices and sellers are read from `resale.a` on Ultra native Testnet. Each action requires a separate review and wallet signature.</p>
          {market.length === 0 ? <div className="uniq-empty">No resale listings were returned by Testnet RPC.</div> :
            <div className="uniq-list">{market.map(item => <article key={item.token_id} className="uniq-row">
              <div className="uniq-item-icon">◇</div><div><strong>Uniq #{item.token_id}</strong><small>Seller: {item.owner}</small><span className="uniq-price">{item.price}</span></div>
              {account === item.owner ? <button className="uniq-mini-btn" onClick={() => void prepareCancel(item)}>Cancel</button> :
                <button className="uniq-mini-btn" onClick={() => void prepareBuy(item)} disabled={!account || network !== "online" || !item.price.endsWith(" UOS")}>Review buy</button>}
            </article>)}</div>}
          {marketNext && <button className="uniq-secondary" disabled={loading} onClick={() => void loadMoreListings()}>Load more listings</button>}
        </div>}

        {tab === "studio" && <div className="uniq-panel">
          <div className="uniq-panel-head"><div><div className="uniq-eyebrow">WALLET-SIGNED ACTIONS</div><h2>Creator studio</h2></div><span className="uniq-tag">No automatic transactions</span></div>
          <div className="uniq-mode-switch">
            {(["factory","mint","list"] as const).map(mode => <button key={mode} type="button" className={studioMode === mode ? "chosen" : ""} onClick={() => {setStudioMode(mode);clearReview();}}>{mode === "factory" ? "Create collection" : mode === "mint" ? "Mint Uniq" : "List Uniq"}</button>)}
          </div>
          {studioMode === "factory" && <form onSubmit={e => void prepareFactory(e)} className="uniq-form">
            <p className="uniq-muted">Create an active Uniq factory on native Testnet. Creator and manager will both be your connected account. You will pay on-chain RAM costs up to the cap you choose.</p>
            <label>Factory metadata URI<input required placeholder="https://.../factory.json" value={factoryURI} onChange={e => {setFactoryURI(e.target.value);clearReview();}}/></label>
            <label>Default Uniq metadata URI<input required placeholder="https://.../{serial_number}.json" value={defaultTokenURI} onChange={e => {setDefaultTokenURI(e.target.value);clearReview();}}/></label>
            <label>Maximum mintable Uniqs<input required inputMode="numeric" value={maxMintable} onChange={e => {setMaxMintable(e.target.value);clearReview();}}/></label>
            <label>Maximum RAM payment (UOS, capped at 20)<input required inputMode="decimal" value={ramCap} onChange={e => {setRamCap(e.target.value);clearReview();}}/></label>
            <button className="uniq-primary" disabled={!account || network !== "online"} type="submit">Review factory creation →</button>
          </form>}
          {studioMode === "mint" && <form onSubmit={e => void prepareMint(e)} className="uniq-form">
            <p className="uniq-muted">Mint exactly one Uniq. The connected account must manage an active native Testnet factory. The recipient may be a different native account.</p>
            <label>Existing factory ID<input required inputMode="numeric" value={mintFactoryId} onChange={e => {setMintFactoryId(e.target.value);clearReview();}}/></label>
            <label>Recipient Ultra account<input required value={mintReceiver} onChange={e => {setMintReceiver(e.target.value);clearReview();}}/></label>
            <label>Token-specific metadata URI (optional)<input placeholder="Leave blank to inherit factory default" value={mintMetadataURI} onChange={e => {setMintMetadataURI(e.target.value);clearReview();}}/></label>
            <label>Maximum RAM payment (UOS, capped at 20)<input required inputMode="decimal" value={ramCap} onChange={e => {setRamCap(e.target.value);clearReview();}}/></label>
            <button type="submit" className="uniq-primary" disabled={!account || network !== "online"}>Review mint →</button>
          </form>}
          {studioMode === "list" && <form onSubmit={e => void prepareList(e)} className="uniq-form">
            <p className="uniq-muted">List a Uniq that appears in the connected account's loaded Testnet inventory. The platform takes no promoter commission.</p>
            <label>Your owned Uniq ID<input required inputMode="numeric" value={selectedTokenId} onChange={e => {setSelectedTokenId(e.target.value);clearReview();}}/></label>
            <label>Resale price (UOS)<input required inputMode="decimal" value={listingPrice} onChange={e => {setListingPrice(e.target.value);clearReview();}}/></label>
            <button type="submit" className="uniq-primary" disabled={!account || network !== "online"}>Review listing →</button>
          </form>}
          {!account && <p className="uniq-warning">Connect the Ultra Wallet browser extension on native Testnet to prepare actions.</p>}
        </div>}

        {preview && <section className="uniq-review" aria-label="Review native transaction">
          <div className="uniq-eyebrow">EXPLICIT WALLET APPROVAL REQUIRED</div>
          <h2>Review before signing</h2>
          <p>{preview.summary}</p>
          <div className="uniq-detail-grid"><span>Account</span><strong>{preview.account}</strong><span>Network</span><strong>Ultra Native Testnet</strong>
            <span>Contract</span><strong>{preview.action.contract}</strong><span>Action</span><strong>{preview.action.action}</strong></div>
          <details><summary>Exact transaction JSON</summary><pre>{JSON.stringify(preview.action, null, 2)}</pre></details>
          <p className="uniq-muted">Confirm the contract, all values, fees and network in your Ultra Wallet extension. Wallet signing broadcasts this transaction; rejecting it sends nothing.</p>
          <div className="uniq-actions"><button className="uniq-primary" disabled={submitting || account !== preview.account || network !== "online"} onClick={submitReviewed}>
            {submitting ? "Waiting for wallet / chain…" : "Approve in Ultra Wallet ↗"}</button>
            <button className="uniq-secondary" disabled={submitting} onClick={() => setPreview(null)}>Cancel review</button></div>
        </section>}
        {error && <div className="uniq-warning" role="alert">{error}</div>}
        {transaction && <section className={transaction.verified ? "uniq-receipt verified" : "uniq-receipt"} role="status">
          <h3>{transaction.verified ? "Verified on Ultra Testnet" : "Submitted — verification pending"}</h3>
          <p>{transaction.message}</p>
          <div className="uniq-hash">{transaction.hash}</div>
          <a href={nativeTxUrl(transaction.hash)} rel="noopener noreferrer" target="_blank">Inspect actual transaction ↗</a>
        </section>}
        <footer className="uniq-footer">LOOKE M3 · Native Uniq testnet interface · All market data comes from Ultra chain RPC, not generated samples. <Link href="/">Back to Looke ↗</Link></footer>
      </section>
    </div>
  </main>;
}
