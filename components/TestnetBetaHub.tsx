"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {Activity,ArrowRight,CheckCircle2,ExternalLink,RefreshCw,ShieldAlert,Wallet,Layers3,FileCheck2,LockKeyhole} from "lucide-react";
import {assessWalletObservation} from "@/lib/beta-readiness.mjs";
import type {ConnectedWallet} from "@/components/WalletConnection";

type BetaStatus={
 milestone:"M22";
 network:string;
 chainId:number;
 observation:{state:string;observedBlock:string|null;observedBlockFinal:false};
 mode:"preview_only";
 publicBetaOpen:false;
 publicIssuanceEnabled:false;
 publicTradingEnabled:false;
 mainnetReady:false;
 protectedStagingAccepted:false;
 sourceModules:{id:string;label:string;state:string}[];
 requiredGates:{id:string;title:string;detail:string;state:string}[];
 warning:string;
};
type WalletObservation=ReturnType<typeof assessWalletObservation>;
type BetaTarget="feed"|"profile"|"nfts"|"activity";

const track=[
 {id:"connect",icon:Wallet,title:"Connect an Ultra wallet",description:"Use your own Testnet wallet. Wallet connection is not a signature or trading approval.",target:null},
 {id:"feed",icon:Activity,title:"Publish and interact",description:"Verify real session login, posting, following and notifications in protected staging.",target:"feed"},
 {id:"profile",icon:FileCheck2,title:"Review creator proposals",description:"Prepare creator and content coin drafts. Onchain issuance stays disabled.",target:"profile"},
 {id:"nfts",icon:Layers3,title:"Inspect native Uniqs",description:"Use a separate native Ultra wallet and source-backed Uniq reads. No purchase or mint.",target:"nfts"},
 {id:"activity",icon:RefreshCw,title:"Inspect sourced portfolio",description:"Compare EVM UOS, allowlisted tokens and native holdings against independent explorers.",target:"activity"}
] as const;

export function TestnetBetaHub({wallet,authenticated,sessionAddress,onConnect,onNavigate}:{
 wallet:ConnectedWallet|null;
 authenticated:boolean;
 sessionAddress:string|null;
 onConnect:()=>void;
 onNavigate:(page:BetaTarget)=>void;
}){
 const [status,setStatus]=useState<BetaStatus|null>(null);
 const [statusError,setStatusError]=useState("");
 const [checkingStatus,setCheckingStatus]=useState(false);
 const [walletCheck,setWalletCheck]=useState<WalletObservation|null>(null);
 const [walletError,setWalletError]=useState("");
 const [checkingWallet,setCheckingWallet]=useState(false);
 const statusGeneration=useRef(0);
 const walletGeneration=useRef(0);
 const evmAddress=wallet?.kind==="Ultra EVM"?wallet.address:null;
 const nativeAccount=wallet?.kind==="Ultra Native"?wallet.address:null;

 const checkStatus=useCallback(async()=>{
  const n=++statusGeneration.current;
  setCheckingStatus(true);setStatusError("");
  try{
   const response=await fetch("/api/beta/status",{cache:"no-store"});
   if(!response.ok)throw new Error("Beta status service is unavailable");
   const data=await response.json() as BetaStatus;
   // Refuse to display a server response that incorrectly advertises execution.
   if(data?.chainId!==18881||data?.mode!=="preview_only"||
      data?.publicBetaOpen!==false||data?.publicTradingEnabled!==false||
      data?.publicIssuanceEnabled!==false||data?.mainnetReady!==false||
      !Array.isArray(data.requiredGates)||!Array.isArray(data.sourceModules))
    throw new Error("Unsafe or incomplete Testnet readiness response");
   if(n===statusGeneration.current)setStatus(data);
  }catch{
   if(n===statusGeneration.current){setStatus(null);setStatusError("Unable to verify Testnet readiness. Beta is not available.");}
  }finally{if(n===statusGeneration.current)setCheckingStatus(false);}
 },[]);
 useEffect(()=>{void checkStatus();return()=>{statusGeneration.current++;};},[checkStatus]);
 useEffect(()=>{
  walletGeneration.current++;
  setWalletCheck(null);setWalletError("");
 },[evmAddress,nativeAccount,sessionAddress]);

 async function checkConnectedEvm(){
  const n=++walletGeneration.current;
  setCheckingWallet(true);setWalletError("");setWalletCheck(null);
  if(!evmAddress){
   setWalletError("Connect an Ultra EVM wallet first. Native Ultra accounts are separate.");
   setCheckingWallet(false);return;
  }
  try{
   const injected=(window as Window & {ethereum?:{
     request:(input:{method:string})=>Promise<unknown>;
   }}).ethereum;
   if(!injected?.request)throw Error("An EVM wallet provider is not available");
   // Strictly read-only: eth_accounts (not eth_requestAccounts), eth_chainId.
   const [accounts,chainId]=await Promise.all([
    injected.request({method:"eth_accounts"}),
    injected.request({method:"eth_chainId"})
   ]);
   const check=assessWalletObservation({
    accounts,chainId,connectedAddress:evmAddress,
    sessionAddress:authenticated?sessionAddress:null
   });
   if(n===walletGeneration.current)setWalletCheck(check);
  }catch{
   if(n===walletGeneration.current)
    setWalletError("The wallet declined or could not provide its current account/network. Reconnect in Looke.");
  }finally{if(n===walletGeneration.current)setCheckingWallet(false);}
 }
 const connectedLabel=evmAddress?"Ultra EVM · "+evmAddress:
   nativeAccount?"Ultra Native · "+nativeAccount:"No wallet connected";
 return <section className="beta-hub" aria-label="M22 Ultra Testnet beta readiness">
  <div className="beta-hero">
   <div>
    <span className="beta-eyebrow">M22 · Controlled Ultra Testnet beta</span>
    <h2>Verify before launch.</h2>
    <p>Explore Looke&apos;s existing social, creator and Uniq features on separate Ultra Testnets. This is a source-and-wallet testing workspace, <strong>not an open financial beta</strong>.</p>
    <div className="beta-hero-actions">
     <button type="button" className="primary-button" onClick={onConnect}>Connect a testnet wallet <Wallet size={16}/></button>
     <button type="button" className="subtle-cta" onClick={()=>void checkStatus()} disabled={checkingStatus}>
      <RefreshCw size={14}/> {checkingStatus?"Checking…":"Refresh chain evidence"}
     </button>
    </div>
   </div>
   <div className="beta-restriction" role="status">
    <LockKeyhole size={22} aria-hidden="true"/>
    <strong>Public financial beta: closed</strong>
    <span>Coin issuance, swaps, NFT purchases and mainnet operations remain disabled.</span>
   </div>
  </div>

  <div className="beta-stats" aria-label="Readiness observations">
   <div className="beta-stat">
    <span>Ultra EVM Testnet</span>
    <strong>Chain 18881</strong>
    <small>Native Ultra is a separate blockchain.</small>
   </div>
   <div className="beta-stat">
    <span>RPC observation</span>
    <strong>{status?.observation.state==="rpc_reachable"?"Reachable":checkingStatus?"Checking…":"Unverified"}</strong>
    <small>{status?.observation.observedBlock?"Node reported block "+status.observation.observedBlock:"No confirmed chain observation"}</small>
   </div>
   <div className="beta-stat">
    <span>Latest wallet observation</span>
    <strong>{walletCheck?.status.replaceAll("_"," ")??"Not checked"}</strong>
    <small>Read-only provider check; not cryptographic proof.</small>
   </div>
  </div>

  {(statusError||walletError)&&<div className="beta-error" role="alert">{statusError||walletError}</div>}

  <div className="beta-grid">
   <div className="beta-panel">
    <h3><Wallet size={19}/> Wallet verification lab</h3>
    <p><strong>{connectedLabel}</strong></p>
    <p className="beta-muted">Connect through Looke&apos;s existing wallet dialog. A current EVM provider reading never signs a message or spends funds.</p>
    <p className="beta-muted">Social session: <strong>{authenticated?"Present (wallet control still requires checking)":"Not signed in"}</strong>.</p>
    <button type="button" className="subtle-cta" disabled={checkingWallet||!evmAddress} onClick={()=>void checkConnectedEvm()}>
     <ShieldAlert size={15}/>{checkingWallet?"Checking provider…":"Check EVM account and network"}
    </button>
    {walletCheck&&<div className="beta-check" role="status">
     <strong>{walletCheck.matchesSignedInSession?"Current EVM account matches social session":"Further verification required"}</strong>
     <div>Network 18881: {walletCheck.networkMatch?"matches":"does not match"}</div>
     <div>Connected wallet: {walletCheck.matchesConnectedWallet?"matches provider":"does not match provider"}</div>
     <div>Signed-in session: {walletCheck.matchesSignedInSession?"address matches":"missing or mismatched"}</div>
     <small>None of these observations authorizes a token transaction or proves a native Ultra wallet signature.</small>
    </div>}
    {nativeAccount&&<p className="beta-muted">Native Ultra account reported by extension: <strong>{nativeAccount}</strong>. Verify holdings separately; no native signature was requested here.</p>}
   </div>
   <div className="beta-panel">
    <h3><ShieldAlert size={19}/> Public beta acceptance gates</h3>
    <p className="beta-muted">Source code and a reachable RPC cannot satisfy these gates. Independent acceptance evidence is required.</p>
    <ul className="beta-gates">
     {(status?.requiredGates??[
      {id:"network",title:"Readiness service unavailable",detail:"No independent release evidence was received.",state:"external_evidence_required"}
     ]).map(g=><li key={g.id}>
      <span className="beta-gate-dot" aria-hidden="true"/>
      <div><strong>{g.title}</strong><small>{g.detail}</small></div>
     </li>)}
    </ul>
   </div>
  </div>

  <div className="beta-panel beta-journey">
   <h3><CheckCircle2 size={19}/> Test the existing product</h3>
   <p className="beta-muted">Use the real account and source-backed read-only endpoints in protected staging. Illustrative Explore cards remain sample data.</p>
   <div className="beta-steps">
    {track.map((step,i)=>{const Icon=step.icon;return <div className="beta-step" key={step.id}>
     <span className="beta-step-icon"><Icon size={19}/></span>
     <div><strong>{i+1}. {step.title}</strong><small>{step.description}</small></div>
     {step.target?<button type="button" onClick={()=>onNavigate(step.target)} aria-label={"Open "+step.title}>
      Open <ArrowRight size={14}/>
     </button>:<button type="button" onClick={onConnect}>Connect <ArrowRight size={14}/></button>}
    </div>;})}
   </div>
  </div>
  <div className="beta-footer">
   <span><ShieldAlert size={15}/> No payment, minting, token approval or financial transaction is initiated by this screen.</span>
   <a href="https://github.com/mushee-io/Looke/blob/main/docs/M22-PUBLIC_TESTNET_BETA.md" target="_blank" rel="noreferrer">Operator beta runbook <ExternalLink size={13}/></a>
  </div>
 </section>;
}
