"use client";

import { useEffect, useState, type FormEvent } from "react";
import { encodeFunctionData, getAddress, isAddress, parseUnits, type Hash } from "viem";
import { lookeCoinFactoryAbi } from "../lib/coin-abi";
import { type CoinDraft, validateCoinDraft } from "../lib/metadata";
import {
  assertHash, createUltraPublicClient, decodeCoinCreatedFromReceipt,
  verifyCreatedCoinState, verifyFactoryDeployment,
} from "../lib/verification";
import {
  LOOKE_FACTORY_ADDRESS, LOOKE_FACTORY_DEPLOY_TX, ULTRA_EVM_TESTNET,
  shortAddress, testnetAddressUrl, testnetTxUrl,
} from "../lib/ultra";

type Screen = "Discover" | "Create" | "Uniq NFTs" | "Messages";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

const emptyDraft: CoinDraft = {
  name: "", symbol: "", description: "", image: "", metadataURI: "", supply: "1000000",
};

function injectedWallet(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Wallet request failed. Check your extension.";
}

async function ensureUltraNetwork(provider: EthereumProvider): Promise<void> {
  const actual = await provider.request({ method: "eth_chainId" });
  if (actual === ULTRA_EVM_TESTNET.chainIdHex) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ULTRA_EVM_TESTNET.chainIdHex }],
    });
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: ULTRA_EVM_TESTNET.chainIdHex,
        chainName: ULTRA_EVM_TESTNET.chainName,
        rpcUrls: [...ULTRA_EVM_TESTNET.rpcUrls],
        nativeCurrency: ULTRA_EVM_TESTNET.nativeCurrency,
      }],
    });
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("Discover");
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [draft, setDraft] = useState<CoinDraft>(emptyDraft);
  const [preview, setPreview] = useState<CoinDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [factoryStatus, setFactoryStatus] = useState<"missing" | "checking" | "verified" | "invalid">("missing");
  const [factoryReason, setFactoryReason] = useState("");
  const [transactionStatus, setTransactionStatus] = useState<"idle" | "submitted" | "confirmed" | "failed">("idle");
  const [confirmedCoin, setConfirmedCoin] = useState("");
  const factoryConfigured = isAddress(LOOKE_FACTORY_ADDRESS) && /^0x[\da-fA-F]{64}$/.test(LOOKE_FACTORY_DEPLOY_TX);
  const onUltra = chain.toLowerCase() === ULTRA_EVM_TESTNET.chainIdHex;
  const screens: Screen[] = ["Discover", "Create", "Uniq NFTs", "Messages"];

  useEffect(() => {
    const provider = injectedWallet();
    if (!provider) return;
    const updateAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setAddress(accounts?.[0] ?? "");
    };
    const updateChain = (...args: unknown[]) => setChain(String(args[0] ?? ""));
    void provider.request({ method: "eth_accounts" })
      .then(value => updateAccounts(value))
      .catch(() => {});
    void provider.request({ method: "eth_chainId" })
      .then(value => updateChain(value))
      .catch(() => {});
    provider.on?.("accountsChanged", updateAccounts);
    provider.on?.("chainChanged", updateChain);
    return () => {
      provider.removeListener?.("accountsChanged", updateAccounts);
      provider.removeListener?.("chainChanged", updateChain);
    };
  }, []);

  useEffect(() => {
    if (!factoryConfigured) {
      setFactoryStatus("missing");
      setFactoryReason("Factory address and a real deployment transaction hash are both required.");
      return;
    }
    let active = true;
    setFactoryStatus("checking");
    void verifyFactoryDeployment(createUltraPublicClient(), LOOKE_FACTORY_ADDRESS, LOOKE_FACTORY_DEPLOY_TX)
      .then(() => { if (active) { setFactoryStatus("verified"); setFactoryReason(""); } })
      .catch(error => {
        if (active) {
          setFactoryStatus("invalid");
          setFactoryReason(errorMessage(error));
        }
      });
    return () => { active = false; };
  }, [factoryConfigured]);

  async function connectWallet() {
    const provider = injectedWallet();
    if (!provider) {
      setNotice("Install an injected EVM wallet (such as MetaMask), then refresh.");
      return;
    }
    setNotice("");
    setWalletBusy(true);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" }) as string[];
      setAddress(accounts[0] ?? "");
      await ensureUltraNetwork(provider);
      setChain(String(await provider.request({ method: "eth_chainId" })));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setWalletBusy(false);
    }
  }

  function updateDraft(key: keyof CoinDraft, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
    setPreview(null);
    setNotice("");
    setTxHash("");
    setTransactionStatus("idle");
    setConfirmedCoin("");
  }

  function previewCoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setTxHash("");
    setTransactionStatus("idle");
    setConfirmedCoin("");
    try {
      const result = validateCoinDraft(draft);
      setPreview(result);
      setNotice("Draft checked locally. Confirm your metadata JSON is uploaded and matches these fields before launching.");
    } catch (error) {
      setPreview(null);
      setNotice(errorMessage(error));
    }
  }

  async function launchCoin() {
    if (!preview || factoryStatus !== "verified" || submitting ||
        transactionStatus === "submitted" || transactionStatus === "confirmed") return;
    const provider = injectedWallet();
    if (!provider || !address) {
      setNotice("Connect an EVM wallet before launching.");
      return;
    }
    let broadcastHash: Hash | undefined;
    setNotice("");
    setTxHash("");
    setConfirmedCoin("");
    setSubmitting(true);
    try {
      await ensureUltraNetwork(provider);
      const activeChain = String(await provider.request({ method: "eth_chainId" }));
      setChain(activeChain);
      if (activeChain.toLowerCase() !== ULTRA_EVM_TESTNET.chainIdHex) {
        throw new Error("Switch to Ultra EVM Testnet first.");
      }
      const currentAccounts = await provider.request({ method: "eth_accounts" }) as string[];
      if (!currentAccounts?.[0] || getAddress(currentAccounts[0]) !== getAddress(address)) {
        throw new Error("Connected wallet changed. Reconnect and review the transaction.");
      }
      const publicClient = createUltraPublicClient();
      // Confirm the configured factory is a real, confirmed Ultra EVM Testnet deployment
      // immediately before requesting a wallet-signed transaction.
      await verifyFactoryDeployment(publicClient, LOOKE_FACTORY_ADDRESS, LOOKE_FACTORY_DEPLOY_TX);
      const reviewedSupply = parseUnits(preview.supply, 18);
      const data = encodeFunctionData({
        abi: lookeCoinFactoryAbi,
        functionName: "createCoin",
        args: [preview.name, preview.symbol, preview.metadataURI, reviewedSupply],
      });
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to: LOOKE_FACTORY_ADDRESS, data }],
      });
      if (typeof hash !== "string") throw new Error("Wallet did not provide a transaction hash.");
      assertHash(hash);
      broadcastHash = hash;
      setTxHash(hash);
      setTransactionStatus("submitted");
      setNotice("Wallet transaction submitted. Waiting for two confirmations and independent contract checks.");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash, confirmations: 2, timeout: 120_000,
      });
      const created = decodeCoinCreatedFromReceipt(receipt, getAddress(LOOKE_FACTORY_ADDRESS), {
        creator: getAddress(address),
        name: preview.name,
        symbol: preview.symbol,
        metadataURI: preview.metadataURI,
        supply: reviewedSupply,
      });
      await verifyCreatedCoinState(publicClient, created);
      setConfirmedCoin(created.coin);
      setTransactionStatus("confirmed");
      setNotice("Coin creation verified on Ultra EVM Testnet. Event, token code, creator balance and total supply match.");
    } catch (error) {
      if (broadcastHash) {
        setTransactionStatus("submitted");
        setNotice("Transaction was broadcast but NOT verified: " + errorMessage(error) +
          ". Check the on-chain receipt before attempting another launch.");
      } else {
        setTransactionStatus("failed");
        setNotice(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" aria-label="Looke home" onClick={() => setScreen("Discover")}>
          <span className="brandmark">L<span>●</span></span>
          <span>looke<span className="branddot">.</span></span>
        </button>
        <div className="toplinks"><span className="statusdot" /> Ultra EVM Testnet <span className="toplinks-muted">/</span> <a href="/beta" style={{color:"inherit",textDecoration:"underline"}}>Beta readiness ↗</a></div>
        <button className="wallet" onClick={connectWallet} disabled={walletBusy}>
          <span className="wallet-led" /> {walletBusy ? "Connecting…" : address ? shortAddress(address) : "Connect wallet"} <span aria-hidden="true">↗</span>
        </button>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-label">EXPLORE</div>
          <nav aria-label="Main navigation">
            {screens.map((item, index) => (
              <button key={item} className={`navitem ${screen === item ? "nav-active" : ""}`} onClick={() => { setScreen(item); setNotice(""); }}>
                <span className="navicon">{["◈", "＋", "▧", "▤"][index]}</span>{item}<span className="navarrow">↗</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="sidebar-label">NETWORK</span>
            <div className="network-detail"><span className="statusdot" /> Ultra EVM Testnet <span>18881</span></div>
            <p>Built for Ultra. Native Uniq support is a separate integration.</p>
            <div className="sidefoot">Looke / Early access build · 01</div>
          </div>
        </aside>

        <section className="content">
          {screen === "Discover" && (
            <>
              <section className="hero">
                <div className="eyebrow"><span className="statusdot" /> THE CREATOR ECONOMY, REIMAGINED FOR ULTRA</div>
                <h1>Everything starts<br />with a <em>creator.</em></h1>
                <p>Coins, collectibles and communities in one place. Meet Looke, a new creative layer for the Ultra ecosystem.</p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => setScreen("Create")}>Create your coin <span>↗</span></button>
                  <button className="ghost" onClick={() => setScreen("Uniq NFTs")}>Explore Uniq NFTs <span>→</span></button>
                  <a href="/trade" className="ghost" style={{textDecoration:"none"}}>Trading terminal <span>↗</span></a>
                </div>
                <div className="hero-art" aria-hidden="true"><div className="art-circle circle-one"/><div className="art-circle circle-two"/><div className="art-circle circle-three"/><div className="art-star">✳</div></div>
              </section>

              <div className="section-heading"><div><span className="overline">THE LOOKE UNIVERSE</span><h2>Make something matter.</h2></div><span className="muted-tag">Ultra ecosystem</span></div>
              <div className="feature-grid">
                <button className="feature-card" onClick={() => setScreen("Create")}>
                  <div className="feature-glyph coin-glyph">◉</div><span className="feature-index">01 / CREATE</span>
                  <h3>Creator coins</h3><p>Prepare and launch fixed-supply creator tokens on Ultra EVM Testnet once the factory is deployed.</p><span className="card-link">Build a coin ↗</span>
                </button>
                <button className="feature-card" onClick={() => setScreen("Uniq NFTs")}>
                  <div className="feature-glyph uniq-glyph">▧</div><span className="feature-index">02 / COLLECT</span>
                  <h3>Native Uniq NFTs</h3><p>Ultra-native digital collectibles. Wallet and NFT market integration are next on the roadmap.</p><span className="card-link">See roadmap ↗</span>
                </button>
                <a href="/social" className="feature-card" style={{textDecoration:"none"}}>
                  <div className="feature-glyph social-glyph">✳</div><span className="feature-index">03 / CONNECT</span>
                  <h3>Social & community</h3><p>Wallet-authenticated profiles, real posts, follows and creator communities. A database is required; private messaging is still disabled.</p><span className="card-link">Open the social network ↗</span>
                </a>
              </div>

              <div className="empty-strip"><div className="strip-icon">◇</div><div><strong>Real activity, when it's real.</strong><p>Live tokens and market data appear only after verified deployment and event indexing. No fabricated trades or volumes.</p></div><span className="pill">INDEXER PENDING</span></div>
            </>
          )}

          {screen === "Create" && (
            <section className="create-screen">
              <span className="overline">01 / CREATOR STUDIO</span>
              <h1 className="page-title">Make your <em>mark.</em></h1>
              <p className="page-description">Build and review your token. Wallet-approved creation is enabled only after a confirmed factory deployment is independently checked on Ultra EVM Testnet.</p>
              <div className="create-grid">
                <form className="create-form" onSubmit={previewCoin}>
                  <div className="form-head"><h2>Token details</h2><span className="muted-tag">ULTRA EVM TESTNET</span></div>
                  <div className="field-row"><label>Coin name<input maxLength={64} required placeholder="e.g. Ultra Cat" value={draft.name} onChange={e => updateDraft("name", e.target.value)} /></label><label>Ticker<input maxLength={12} required placeholder="UCAT" value={draft.symbol} onChange={e => updateDraft("symbol", e.target.value)} /></label></div>
                  <label>Description<textarea rows={3} required placeholder="What is this coin about?" value={draft.description} onChange={e => updateDraft("description", e.target.value)} /></label>
                  <label>Image URI<input required placeholder="ipfs://... or https://..." value={draft.image} onChange={e => updateDraft("image", e.target.value)} /></label>
                  <label>Published metadata JSON URI<input required placeholder="ipfs://.../metadata.json" value={draft.metadataURI} onChange={e => updateDraft("metadataURI", e.target.value)} /></label>
                  <label>Initial supply<input required inputMode="decimal" placeholder="1000000" value={draft.supply} onChange={e => updateDraft("supply", e.target.value)} /></label>
                  <button className="primary form-submit" type="submit">Review coin draft <span>→</span></button>
                  <p className="field-hint">Looke doesn't upload files yet. Host JSON metadata separately; preview validation does not verify remote content.</p>
                </form>
                <div className="preview-panel"><span className="overline">LIVE DRAFT PREVIEW</span><div className="preview-art"><span>✳</span></div><div className="preview-meta"><div><h3>{preview?.name || draft.name || "Your coin"}</h3><p>${preview?.symbol || draft.symbol || "TOKEN"}</p></div><span className="pill">FIXED SUPPLY</span></div><p>{preview?.description || draft.description || "Your creation starts here."}</p><div className="preview-data"><span>SUPPLY</span><strong>{preview?.supply || "—"}</strong></div><div className="preview-data"><span>NETWORK</span><strong>Ultra EVM · 18881</strong></div><div className="preview-data"><span>FACTORY</span><strong>{factoryStatus === "verified" ? shortAddress(LOOKE_FACTORY_ADDRESS) : "Not verified"}</strong></div>
                  <div className="preview-data"><span>DEPLOYMENT PROOF</span><strong>{factoryStatus === "verified" ? "Verified · 2+ confirmations" : factoryStatus === "checking" ? "Checking testnet receipt…" : "Not available"}</strong></div>
                  <button className="launch-button"
                    disabled={!preview || factoryStatus !== "verified" || !address || submitting || !onUltra || transactionStatus === "submitted" || transactionStatus === "confirmed"}
                    onClick={launchCoin}>
                    {submitting ? "Checking wallet / transaction…" : transactionStatus === "confirmed" ? "Verified on Ultra Testnet ✓" : transactionStatus === "submitted" ? "Awaiting independent verification" : "Launch on Ultra Testnet ↗"}
                  </button>
                  {factoryStatus !== "verified" && <p className="disabled-reason" role="status">Factory: {factoryReason || (factoryStatus === "checking" ? "Checking deployment receipt…" : "Not configured.")}</p>}
                  {factoryStatus === "verified" && !address && <p className="disabled-reason">Connect your wallet to enable launching.</p>}
                  {address && !onUltra && <p className="disabled-reason">Switch your wallet to Ultra EVM Testnet.</p>}
                </div>
              </div>
            </section>
          )}

          {screen === "Uniq NFTs" && <section className="info-screen"><span className="overline">02 / COLLECT</span><div className="info-icon">▧</div><h1 className="page-title">Made to be <em>collected.</em></h1><p>Looke will support Ultra's native Uniq NFTs: collections, ownership, minting and marketplace listings. These are native Ultra assets, not ordinary EVM ERC-721 tokens.</p><a href="/uniqs" className="primary" style={{ display: "inline-flex", textDecoration: "none", margin: "12px 0 30px" }}>Open Uniq Studio on Ultra Testnet ↗</a><div className="roadmap-line"><span>01</span><strong>Native Uniq Testnet studio and ownership reads</strong><span className="pill">TESTNET BUILD · M3</span></div><div className="roadmap-line"><span>02</span><strong>Creator minting and collection tools</strong><span className="pill">PLANNED</span></div><div className="roadmap-line"><span>03</span><strong>Verified marketplace execution</strong><span className="pill">PLANNED</span></div><a className="text-link" href="https://developers.ultra.io/" target="_blank" rel="noreferrer">Ultra developer resources ↗</a></section>}

          {screen === "Messages" && <section className="info-screen"><span className="overline">03 / COMMUNITY</span><div className="info-icon">✳</div><h1 className="page-title">Find your <em>people.</em></h1><p>On Looke, creators will be able to share projects, follow each other and discuss the collectibles and tokens they love. Public posting now has a database-backed foundation. Private messaging is disabled pending audited encryption.</p><div className="roadmap-line"><span>01</span><strong>Profiles & discovery</strong><span className="pill">PLANNED</span></div><div className="roadmap-line"><span>02</span><strong>Community posts & comments</strong><span className="pill">PLANNED</span></div><div className="roadmap-line"><span>03</span><strong>Secure conversations</strong><span className="pill">PLANNED</span></div></section>}

          {notice && <div className="notice" role="status">{notice}</div>}
          {txHash && <div className="tx-result">
            <strong>{transactionStatus === "confirmed" ? "Verified coin creation" : "Submitted — not yet verified"}</strong>
            <code>{txHash}</code>
            <a href={testnetTxUrl(txHash)} target="_blank" rel="noopener noreferrer">View transaction on Ultra Testnet explorer ↗</a>
            {confirmedCoin && <p>Created token: <a href={testnetAddressUrl(confirmedCoin)} target="_blank" rel="noopener noreferrer">{confirmedCoin}</a></p>}
            {transactionStatus !== "confirmed" && <p>A submitted hash alone is not proof of token creation.</p>}
          </div>}
          <footer className="footer"><span>© 2026 Looke · An original Ultra-first creator platform</span><span>{address ? `Wallet ${shortAddress(address)}` : "Wallet disconnected"} · {onUltra ? "Ultra Testnet" : "Network not connected"}</span></footer>
        </section>
      </div>
    </main>
  );
}
