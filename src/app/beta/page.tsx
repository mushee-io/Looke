"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getAddress, isAddress } from "viem";
import { UltraWalletSDK } from "@ultraos/wallet-sdk";
import type { BetaReadiness } from "../../lib/beta/readiness";
import { ULTRA_NATIVE_TESTNET } from "../../lib/ultra-native";
import "./beta.css";

type WalletProvider = {request:(args:{method:string;params?:unknown[]})=>Promise<unknown>};
type EvidenceType = "factory"|"coin"|"uniq";
type Result = {verified:boolean;readOnly:boolean;proof?:Record<string,unknown>;error?:string};
let nativeWallet:UltraWalletSDK|undefined;
function getNativeWallet(){return nativeWallet??=new UltraWalletSDK({environment:"testnet",provider:"extension"});}
function wallet(){return typeof window==="undefined"?null:((window as Window&{ethereum?:WalletProvider}).ethereum??null);}
function message(error:unknown){return error instanceof Error?error.message:"Verification unavailable.";}

export default function TestnetBetaPage(){
  const [readiness,setReadiness]=useState<BetaReadiness|null>(null);
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(true);
  const [walletAccount,setWalletAccount]=useState("");
  const [nativeAccount,setNativeAccount]=useState("");
  const [evmNetwork,setEvmNetwork]=useState("");
  const [proofType,setProofType]=useState<EvidenceType>("factory");
  const [factory,setFactory]=useState("");
  const [txHash,setTxHash]=useState("");
  const [nativeFactory,setNativeFactory]=useState("");
  const [nativeToken,setNativeToken]=useState("");
  const [nativeOwner,setNativeOwner]=useState("");
  const [checking,setChecking]=useState(false);
  const [proof,setProof]=useState<Result|null>(null);

  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const res=await fetch("/api/beta/readiness",{cache:"no-store"});
      if(!res.ok)throw new Error("Readiness endpoint is unavailable.");
      const data=await res.json() as BetaReadiness;
      setReadiness(data);
      setNotice("");
    }catch(error){setReadiness(null);setNotice(message(error));}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  async function checkEvmWallet(){
    setNotice("");
    const injected=wallet();
    if(!injected){setNotice("An injected EVM wallet extension is required.");return;}
    try{
      // Wallet account request is user-triggered. No transaction or signature is requested.
      const accounts=await injected.request({method:"eth_requestAccounts"}) as string[];
      const chain=String(await injected.request({method:"eth_chainId"})).toLowerCase();
      if(!accounts?.[0] || !isAddress(accounts[0]))throw new Error("Wallet returned no valid address.");
      setWalletAccount(getAddress(accounts[0]));
      setEvmNetwork(chain);
      setNotice(chain==="0x49c1"
        ?"EVM wallet connected on Ultra EVM Testnet 18881. Read-only check; no transaction performed."
        :"EVM wallet is on the wrong chain. Switch to Ultra EVM Testnet 18881; this check cannot approve beta.");
    }catch(error){setNotice(message(error));}
  }

  function checkNativeWallet(){
    setNotice("");
    try{
      // Connect is called on the click path. The native extension handles account permission.
      void getNativeWallet().connect().then(result=>{
        const name=result.data.blockchainid;
        if(typeof name!=="string"||!/^[a-z1-5.]{1,12}$/.test(name))throw new Error("Invalid native Ultra account.");
        setNativeAccount(name);setNativeOwner(name);
        setNotice("Ultra native Testnet extension connection completed. No NFT transaction signed.");
      }).catch(error=>setNotice(message(error)));
    }catch(error){setNotice(message(error));}
  }

  async function verifyProof(e:FormEvent){
    e.preventDefault();setChecking(true);setProof(null);setNotice("");
    const params=new URLSearchParams({kind:proofType});
    if(proofType==="uniq"){
      params.set("factoryId",nativeFactory);params.set("tokenId",nativeToken);params.set("owner",nativeOwner);
    }else{
      params.set("address",factory);params.set("tx",txHash);
    }
    try{
      const res=await fetch(`/api/beta/evidence?${params}`,{cache:"no-store"});
      const result=await res.json() as Result;
      setProof(result);
      if(!res.ok || !result.verified)setNotice(result.error||"Evidence could not be verified.");
    }catch(error){setNotice(message(error));}
    finally{setChecking(false);}
  }

  return <main className="beta-shell">
    <header className="beta-header"><Link href="/" className="beta-logo">✳ looke<span>.</span><small> / testnet beta</small></Link>
      <div className="beta-status"><i/> PUBLIC BETA CLOSED</div>
      <button type="button" className="beta-refresh" onClick={()=>void refresh()} disabled={loading}>{loading?"Checking…":"Refresh checks ↻"}</button>
    </header>
    <section className="beta-hero">
      <span className="beta-kicker">M6 / DEPLOYMENT, ACCEPTANCE & SAFETY</span>
      <h1>Prove it on-chain.<br/><em>Then open the doors.</em></h1>
      <p>Integrated Ultra EVM and native Uniq Testnet verification. No invented activity, fake wallets or automatic transactions. CI passing is necessary but does not establish public launch readiness.</p>
      <div className="beta-hero-meta"><span>ULTRA EVM · 18881</span><span>ULTRA NATIVE · {ULTRA_NATIVE_TESTNET.contract}</span><span>STAGING FIRST</span></div>
    </section>
    <div className="beta-layout">
      <section className="beta-left">
        <div className="beta-card">
          <div className="beta-card-title"><div><span className="beta-eyebrow">BETA RELEASE CONTROLS</span><h2>Launch readiness</h2></div>
            <span className="beta-closed">{readiness?.publicBetaOpen?"OPEN BY VERIFIED RELEASE":"CLOSED BY DEFAULT"}</span></div>
          <p className="beta-muted">These checks use real chain RPC and server configuration. Green code tests alone cannot activate public beta.</p>
          <div className="beta-progress"><span>{readiness?.summary.passed??0} / {readiness?.summary.total??12} verified gates</span>
            <div><span style={{width:`${readiness?readiness.summary.passed/readiness.summary.total*100:0}%`}}/></div></div>
          <div className="beta-gates">{(readiness?.gates||[]).map(item=><div key={item.id} className="beta-gate">
            <span className={item.status==="passed"?"beta-mark pass":"beta-mark"}>{item.status==="passed"?"✓":"×"}</span>
            <div><strong>{item.id.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase())}</strong><p>{item.detail}</p></div>
            <span className="beta-gate-status">{item.status==="passed"?"Verified":"Blocked"}</span>
          </div>)}</div>
          {readiness?.publicBetaOpen&&<div className="beta-signed">This deployment reports an independently verified and signed Ultra Testnet beta release. Check the individual acceptance evidence before participating.</div>}
          {!readiness?.publicBetaOpen&&<div className="beta-locked">Beta remains closed until every gate passes and the actual deployed revision has a valid, unexpired operator release signature.</div>}
        </div>
        <div className="beta-card">
          <div className="beta-card-title"><div><span className="beta-eyebrow">READ-ONLY WALLET ACCEPTANCE</span><h2>Check your wallets</h2></div><span className="beta-tag">NO SIGNING</span></div>
          <p className="beta-muted">Connect to inspect account and selected network. This check never asks for a financial transaction, NFT operation or approval. Browser-only results are not official operator acceptance evidence.</p>
          <div className="beta-wallets">
            <div><span>Ultra EVM Testnet · EVM extension</span><strong>{walletAccount||"Not connected"}</strong>
              <small>{evmNetwork?evmNetwork==="0x49c1"?"Network 18881 confirmed in wallet":"Wrong EVM network":"No wallet chain checked"}</small>
              <button type="button" onClick={()=>void checkEvmWallet()}>Check EVM wallet ↗</button></div>
            <div><span>Ultra native Testnet · Ultra Wallet extension</span><strong>{nativeAccount||"Not connected"}</strong>
              <small>Native Uniq NFT ownership is separate from Ultra EVM token balances</small>
              <button type="button" onClick={checkNativeWallet}>Check native wallet ↗</button></div>
          </div>
        </div>
        <div className="beta-card">
          <div className="beta-card-title"><div><span className="beta-eyebrow">INDEPENDENT CHAIN EVIDENCE</span><h2>Verify a real transaction</h2></div><span className="beta-tag">READ-ONLY RPC</span></div>
          <p className="beta-muted">Supply real Testnet identifiers. The server checks successful deployment receipts, token state, or native Uniq ownership; it cannot create tokens or NFTs.</p>
          <form className="beta-form" onSubmit={e=>void verifyProof(e)}>
            <label>Evidence type<select value={proofType} onChange={e=>{setProofType(e.target.value as EvidenceType);setProof(null);}}>
              <option value="factory">Ultra EVM factory deployment</option><option value="coin">Wallet-created creator coin</option>
              <option value="uniq">Native Uniq NFT ownership</option>
            </select></label>
            {proofType==="uniq"?<>
              <label>Factory ID<input value={nativeFactory} onChange={e=>setNativeFactory(e.target.value)} placeholder="Native factory ID" required inputMode="numeric"/></label>
              <label>Native Uniq token ID<input value={nativeToken} onChange={e=>setNativeToken(e.target.value)} placeholder="Minted Uniq ID" required inputMode="numeric"/></label>
              <label>Ultra native owner<input value={nativeOwner} onChange={e=>setNativeOwner(e.target.value)} placeholder="Native Ultra wallet account" required/></label>
            </>:<>
              <label>Looke EVM factory contract address<input value={factory} onChange={e=>setFactory(e.target.value)} placeholder="0x… factory address" required/></label>
              <label>Genuine Ultra EVM Testnet transaction hash<input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="0x… transaction receipt" required/></label>
            </>}
            <button disabled={checking}>{checking?"Checking actual chain…":"Verify on Testnet ↗"}</button>
          </form>
          {proof?.verified?<div className="beta-proof"><strong>Chain evidence verified</strong><pre>{JSON.stringify(proof.proof,null,2)}</pre></div>:null}
          {proof && !proof.verified?<div className="beta-locked">No verified proof was produced; the attempted verification is not beta acceptance.</div>:null}
        </div>
      </section>
      <aside className="beta-right">
        <div className="beta-side-card"><span className="beta-eyebrow">INTEGRATION STATUS</span><h3>One platform. Two chains.</h3>
          <p>Creator tokens and AMM markets operate on Ultra EVM Testnet. Uniq NFTs live on the separate native Ultra Testnet. Social uses a PostgreSQL service and wallet-authenticated accounts.</p>
          <Link href="/trade">Creator trading terminal ↗</Link><Link href="/uniqs">Native Uniq studio ↗</Link><Link href="/social">Looke social network ↗</Link>
        </div>
        <div className="beta-side-card"><span className="beta-eyebrow">RELEASE RULES</span><h3>Nothing goes live by accident.</h3>
          <p>No wallet transaction can be initiated from this dashboard. Production opening requires operator authorization, security review, real evidence and a revision-bound wallet signature.</p>
          <p>Staging preview access should be protected by the hosting provider; this dashboard itself is informational and does not authenticate testers.</p>
        </div>
      </aside>
    </div>
    {notice&&<div className="beta-notice" role="status">{notice}</div>}
    <footer className="beta-footer">LOOKE M6 · Public Testnet beta CLOSED unless all independent gates and operator approvals are verified · <Link href="/">Back to Looke ↗</Link></footer>
  </main>;
}
