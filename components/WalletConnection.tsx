"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Wallet, AlertCircle } from "lucide-react";
import { ULTRA_EVM_TESTNET } from "@/lib/ultra";
import { checkedEvmSnapshot, checkedNativeConnect, sameEvmAccount } from "@/lib/wallet-guards.mjs";

type EvmProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void) => void;
};
type NativeConnectResult = {blockchainid:string; selectedAccount?:{accountName:string};network?:{chainId:string}};
type NativeWallet = {
  connect: (args?: {onlyIfTrusted?:boolean}) => Promise<{ data: NativeConnectResult }>;
  getChainId: () => Promise<{ data: string | null }>;
  disconnect: () => Promise<unknown>;
  dispose?: () => void;
};
export type ConnectedWallet = { kind: "Ultra EVM" | "Ultra Native"; address: string };
export function WalletConnection({ onConnected, onAuthenticated, onLoggedOut, onDisconnected, authenticated, sessionAddress, activeWallet }: {
  onConnected: (wallet: ConnectedWallet) => void;
  onAuthenticated: (address: string) => void;
  onLoggedOut: () => void;
  onDisconnected: (kind: ConnectedWallet["kind"]) => void;
  authenticated: boolean;
  sessionAddress: string | null;
  activeWallet: ConnectedWallet | null;
}) {
  const [evm, setEvm] = useState<ConnectedWallet | null>(activeWallet?.kind==="Ultra EVM"?activeWallet:null);
  const [native, setNative] = useState<ConnectedWallet | null>(activeWallet?.kind==="Ultra Native"?activeWallet:null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [networkWrong, setNetworkWrong] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);
  const nativeClient = useRef<NativeWallet | null>(null);

  useEffect(() => {
    setEvm(activeWallet?.kind==="Ultra EVM"?activeWallet:null);
    setNative(activeWallet?.kind==="Ultra Native"?activeWallet:null);
  }, [activeWallet]);

  useEffect(() => {
    let mounted = true;
    // The native Ultra SDK MUST be instantiated in the browser (Next.js renders on the server too).
    if (!("ultra" in window)) {
      setNativeReady(false);
      return () => { mounted = false; };
    }
    import("@ultraos/wallet-sdk").then(({ UltraWalletSDK }) => {
      if (!mounted) return;
      nativeClient.current = new UltraWalletSDK({ environment: "testnet", provider: "extension" });
      setNativeReady(true);
    }).catch(() => { if (mounted) setError("Ultra native SDK is unavailable."); });
    return () => { mounted = false; nativeClient.current?.dispose?.(); nativeClient.current=null; };
  }, []);

  function provider(): EvmProvider | null {
    return (window as Window & { ethereum?: EvmProvider }).ethereum ?? null;
  }

  useEffect(() => {
    const p = provider();
    if (!p?.on) return;
    const reset = () => {
      setEvm(null);
      setNetworkWrong(false);
      setError("EVM wallet account or network changed. Reconnect before signing.");
      onDisconnected("Ultra EVM");
    };
    p.on("accountsChanged", reset);
    p.on("chainChanged", reset);
    return () => {
      p.removeListener?.("accountsChanged", reset);
      p.removeListener?.("chainChanged", reset);
    };
  }, [onDisconnected]);

  async function connectEvm() {
    setError(""); setBusy("evm");
    try {
      const p = provider();
      if (!p) throw new Error("Install an EVM wallet such as MetaMask to connect to Ultra EVM.");
      const addresses = await p.request({ method: "eth_requestAccounts" });
      const [freshAccounts, chainId] = await Promise.all([
        p.request({ method: "eth_accounts" }),
        p.request({ method: "eth_chainId" }),
      ]);
      if (typeof chainId !== "string" || chainId.toLowerCase() !== ULTRA_EVM_TESTNET.chainIdHex)
        setNetworkWrong(true);
      const address = checkedEvmSnapshot(freshAccounts, chainId, ULTRA_EVM_TESTNET.chainIdHex);
      if (!Array.isArray(addresses) || !sameEvmAccount(addresses[0],address))
        throw new Error("EVM wallet account changed during connection. Retry.");
      setNetworkWrong(false);
      const wallet = { kind: "Ultra EVM" as const, address };
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
      setEvm(null);
      onDisconnected("Ultra EVM");
      // A network switch is not a reconnection. Explicitly re-check the account.
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
      const address = checkedEvmSnapshot(accounts,chain,ULTRA_EVM_TESTNET.chainIdHex);
      if (!sameEvmAccount(address,evm.address)) {
        throw new Error("Wallet account changed. Reconnect before signing.");
      }
      const challengeResponse=await fetch("/api/auth/challenge",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({address:evm.address})});
      const challenge=await challengeResponse.json() as {challengeId?:string;message?:string;error?:string};
      if(!challengeResponse.ok || !challenge.challengeId || !challenge.message) throw new Error(challenge.error||"Cannot start sign-in. Configure Looke database.");
      const signature=await p.request({method:"personal_sign",params:[challenge.message,evm.address]});
      if(typeof signature!=="string") throw new Error("Wallet did not sign the challenge.");
      const [updatedAccounts,updatedChain]=await Promise.all([
        p.request({method:"eth_accounts"}),p.request({method:"eth_chainId"})
      ]);
      if(!sameEvmAccount(checkedEvmSnapshot(updatedAccounts,updatedChain,ULTRA_EVM_TESTNET.chainIdHex),evm.address))
        throw new Error("Wallet changed during signing. Reconnect and try again.");
      const verified=await fetch("/api/auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.challengeId,address:evm.address,signature})});
      const result=await verified.json() as {authenticated?:boolean;error?:string};
      if(!verified.ok || !result.authenticated) throw new Error(result.error||"Signature verification failed.");
      onAuthenticated(evm.address);
    } catch(e) {setError(e instanceof Error?e.message:"Sign-in failed.");}
    finally {setBusy("");}
  }
  async function signOut() {
    setError("");setBusy("signout");
    try {
      const response=await fetch("/api/auth/logout",{method:"POST"});
      if(!response.ok) throw new Error("Could not revoke session");
      onLoggedOut();
    } catch(e) {setError(e instanceof Error?e.message:"Sign-out failed.");}
    finally {setBusy("");}
  }
  async function connectNative() {
    setError(""); setBusy("native");
    try {
      if (!nativeClient.current) throw new Error("Ultra Wallet extension is not ready.");
      const { data } = await nativeClient.current.connect();
      const { data: chainId } = await nativeClient.current.getChainId();
      const address = checkedNativeConnect(data,chainId);
      const wallet = { kind: "Ultra Native" as const, address };
      setNative(wallet); onConnected(wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ultra Wallet connection rejected or wrong network.");
    } finally { setBusy(""); }
  }

  function disconnectEvm() {
    setEvm(null);
    onDisconnected("Ultra EVM");
    setError("Looke forgot this EVM connection. Revoke site permissions in your wallet if needed.");
  }
  async function disconnectNative() {
    setError("");setBusy("disconnect-native");
    try {
      if (!nativeClient.current) throw new Error("Ultra extension connection unavailable.");
      await nativeClient.current.disconnect();
      setNative(null);
      onDisconnected("Ultra Native");
    } catch (e) {
      setError(e instanceof Error?e.message:"Native wallet disconnect failed.");
    } finally {setBusy("");}
  }

  return <div className="looke-wallet-picker">
    <p>Connect a wallet on <strong>testnet only</strong>. This confirms wallet access; it does not create a Looke account or enable trading.</p>
    <button type="button" className="login-provider" disabled={!!busy} onClick={connectEvm}>
      <Wallet size={18} /> {evm ? "Ultra EVM: " + evm.address.slice(0, 8) + "…" : "Connect Ultra EVM wallet"}
      {evm ? <CheckCircle2 size={16} /> : <ExternalLink size={16}/>}
    </button>
    {evm && <button type="button" className="subtle-cta" disabled={!!busy} onClick={disconnectEvm}>Forget EVM connection</button>}
    {networkWrong && <button type="button" className="login-provider" disabled={!!busy} onClick={switchEvm}>Switch to Ultra EVM testnet</button>}
    <button type="button" className="login-provider" disabled={!!busy || !nativeReady} onClick={connectNative}>
      <Wallet size={18} /> {native ? "Ultra: " + native.address : nativeReady ? "Connect Ultra Wallet (Uniqs)" : "Loading Ultra extension SDK…"}
      {native ? <CheckCircle2 size={16}/> : <ExternalLink size={16}/>}
    </button>
    {authenticated && <p role="status" style={{fontSize:12,marginTop:13,overflowWrap:"anywhere"}}>Social account signed in as: <strong>{sessionAddress || "an Ultra EVM wallet"}</strong>. This browser session can outlive the wallet connection.</p>}
    {authenticated && evm && sessionAddress && evm.address.toLowerCase() !== sessionAddress.toLowerCase() &&
      <p role="alert" style={{fontSize:12,color:"#bb2548"}}>Connected wallet is not your signed-in creator account. Sign out of Looke before switching accounts.</p>}
    {native && <button type="button" className="subtle-cta" disabled={!!busy} onClick={()=>void disconnectNative()}>Revoke native wallet connection</button>}
    {!nativeReady && <p className="modal-footnote">Testnet Uniq access requires the official Ultra Wallet browser extension on an HTTPS page.</p>}
    {evm && !authenticated && <button type="button" className="login-provider" disabled={!!busy} onClick={signIn}><CheckCircle2 size={17}/> Sign login challenge (no spending)</button>}
    {authenticated && <button type="button" className="login-provider" disabled={!!busy} onClick={signOut}>Sign out of social account</button>}
    {error && <p role="alert" style={{color:"#bb2548",display:"flex",gap:8,alignItems:"center"}}><AlertCircle size={16}/>{error}</p>}
    <p className="modal-footnote">Native Ultra wallet is extension-only on testnet. Ultra EVM and native Uniq accounts are different environments; no bridge or automatic asset transfer is performed.</p>
  </div>;
}
