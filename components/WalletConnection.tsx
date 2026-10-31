"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Wallet, AlertCircle } from "lucide-react";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
type NativeWallet = {
  connect: () => Promise<{ data: { blockchainid: string } }>;
};
export type ConnectedWallet = { kind: "Ultra EVM" | "Ultra Native"; address: string };
export function WalletConnection({ onConnected, onAuthenticated, onLoggedOut }: { onConnected: (wallet: ConnectedWallet) => void; onAuthenticated:()=>void; onLoggedOut:()=>void }) {
  const [evm, setEvm] = useState<ConnectedWallet | null>(null);
  const [native, setNative] = useState<ConnectedWallet | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [networkWrong, setNetworkWrong] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const nativeClient = useRef<NativeWallet | null>(null);

  useEffect(() => {
    let mounted = true;
    // The native Ultra SDK MUST be instantiated in the browser (Next.js renders on the server too).
    import("@ultraos/wallet-sdk").then(({ UltraWalletSDK }) => {
      if (!mounted) return;
      nativeClient.current = new UltraWalletSDK({ environment: "testnet", provider: "extension" });
      setNativeReady(true);
    }).catch(() => { if (mounted) setError("Ultra native SDK is unavailable."); });
    return () => { mounted = false; };
  }, []);

  function provider(): EvmProvider | null {
    return (window as Window & { ethereum?: EvmProvider }).ethereum ?? null;
  }

  async function connectEvm() {
    setError(""); setBusy("evm");
    try {
      const p = provider();
      if (!p) throw new Error("Install an EVM wallet such as MetaMask to connect to Ultra EVM.");
      const addresses = await p.request({ method: "eth_requestAccounts" });
      if (!Array.isArray(addresses) || typeof addresses[0] !== "string") throw new Error("Wallet returned no account.");
      const chainId = await p.request({ method: "eth_chainId" });
      if (chainId !== ULTRA_EVM_TESTNET.chainIdHex) {
        setNetworkWrong(true);
        throw new Error("Connected wallet is on another chain. Switch to Ultra EVM testnet before continuing.");
      }
      setNetworkWrong(false);
      const wallet = { kind: "Ultra EVM" as const, address: addresses[0] };
      setEvm(wallet); onConnected(wallet);
    } catch (e) { setError(e instanceof Error ? e.message : "Wallet connection rejected."); }
    finally { setBusy(""); }
  }

  async function switchEvm() {
    setError(""); setBusy("switch");
    try {
      const p = provider();
      if (!p) throw new Error("No EVM wallet detected.");
      try {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ULTRA_EVM_TESTNET.chainIdHex }] });
      } catch (e) {
        const code = (e as { code?: number })?.code;
        if (code !== 4902) throw e;
        await p.request({ method: "wallet_addEthereumChain", params: [{
          chainId: ULTRA_EVM_TESTNET.chainIdHex,
          chainName: "Ultra EVM Testnet",
          rpcUrls: [ULTRA_EVM_TESTNET.rpc],
          blockExplorerUrls: [ULTRA_EVM_TESTNET.explorer],
          nativeCurrency: { name: "Ultra", symbol: "UOS", decimals: 18 },
        }] });
      }
      setNetworkWrong(false);
      // User must reconnect after switching so we re-check the account and network.
    } catch (e) { setError(e instanceof Error ? e.message : "Network switch rejected."); }
    finally { setBusy(""); }
  }

  async function signIn() {
    setError(""); setBusy("signin");
    try {
      if(!evm) throw new Error("Connect Ultra EVM wallet first.");
      const p=provider();
      if(!p) throw new Error("Wallet disconnected.");
      const chain=await p.request({method:"eth_chainId"});
      const accounts=await p.request({method:"eth_accounts"});
      if(chain!==ULTRA_EVM_TESTNET.chainIdHex || !Array.isArray(accounts) ||
        typeof accounts[0]!=="string" || accounts[0].toLowerCase()!==evm.address.toLowerCase()) {
        throw new Error("Wallet account or chain changed. Reconnect on Ultra EVM testnet.");
      }
      const challengeResponse=await fetch("/api/auth/challenge",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({address:evm.address})});
      const challenge=await challengeResponse.json() as {challengeId?:string;message?:string;error?:string};
      if(!challengeResponse.ok || !challenge.challengeId || !challenge.message) throw new Error(challenge.error||"Cannot start sign-in. Configure Looke database.");
      const signature=await p.request({method:"personal_sign",params:[challenge.message,evm.address]});
      if(typeof signature!=="string") throw new Error("Wallet did not sign the challenge.");
      const verified=await fetch("/api/auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.challengeId,address:evm.address,signature})});
      const result=await verified.json() as {authenticated?:boolean;error?:string};
      if(!verified.ok || !result.authenticated) throw new Error(result.error||"Signature verification failed.");
      setAuthenticated(true);onAuthenticated();
    } catch(e) {setError(e instanceof Error?e.message:"Sign-in failed.");}
    finally {setBusy("");}
  }
  async function signOut() {
    setError("");setBusy("signout");
    try {
      const response=await fetch("/api/auth/logout",{method:"POST"});
      if(!response.ok) throw new Error("Could not revoke session");
      setAuthenticated(false);onLoggedOut();
    } catch(e) {setError(e instanceof Error?e.message:"Sign-out failed.");}
    finally {setBusy("");}
  }
  async function connectNative() {
    setError(""); setBusy("native");
    try {
      if (!nativeClient.current) throw new Error("Ultra Wallet extension is not ready.");
      const { data } = await nativeClient.current.connect();
      if (!data || typeof data.blockchainid !== "string") throw new Error("Ultra Wallet returned no account.");
      const wallet = { kind: "Ultra Native" as const, address: data.blockchainid };
      setNative(wallet); onConnected(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ultra Wallet connection rejected or wrong network.");
    } finally { setBusy(""); }
  }

  return <div className="looke-wallet-picker">
    <p>Connect a wallet on <strong>testnet only</strong>. This confirms wallet access; it does not create a Looke account or enable trading.</p>
    <button type="button" className="login-provider" disabled={!!busy} onClick={connectEvm}>
      <Wallet size={18} /> {evm ? "Ultra EVM: " + evm.address.slice(0, 8) + "…" : "Connect Ultra EVM wallet"}
      {evm ? <CheckCircle2 size={16} /> : <ExternalLink size={16}/>}
    </button>
    {networkWrong && <button type="button" className="login-provider" disabled={!!busy} onClick={switchEvm}>Switch to Ultra EVM testnet</button>}
    <button type="button" className="login-provider" disabled={!!busy || !nativeReady} onClick={connectNative}>
      <Wallet size={18} /> {native ? "Ultra: " + native.address : nativeReady ? "Connect Ultra Wallet (Uniqs)" : "Loading Ultra extension SDK…"}
      {native ? <CheckCircle2 size={16}/> : <ExternalLink size={16}/>}
    </button>
    {evm && !authenticated && <button type="button" className="login-provider" disabled={!!busy} onClick={signIn}><CheckCircle2 size={17}/> Sign login challenge (no spending)</button>}
    {authenticated && <button type="button" className="login-provider" disabled={!!busy} onClick={signOut}>Sign out of social account</button>}
    {error && <p role="alert" style={{color:"#bb2548",display:"flex",gap:8,alignItems:"center"}}><AlertCircle size={16}/>{error}</p>}
    <p className="modal-footnote">Native Ultra wallet is extension-only on testnet. Ultra EVM and native Uniq accounts are different environments; no bridge or automatic asset transfer is performed.</p>
  </div>;
}
