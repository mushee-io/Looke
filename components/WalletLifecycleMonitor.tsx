"use client";

import { useEffect } from "react";
import type { ConnectedWallet } from "@/components/WalletConnection";
import { ULTRA_EVM_TESTNET, ULTRA_NATIVE_TESTNET } from "@/lib/ultra";
import { checkedEvmSnapshot, sameEvmAccount } from "@/lib/wallet-guards.mjs";

type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "accountsChanged"|"chainChanged"|"disconnect", listener: (value: unknown) => void) => void;
  removeListener?: (event: "accountsChanged"|"chainChanged"|"disconnect", listener: (value: unknown) => void) => void;
};

/**
 * Keeps the wallet display honest even when the connect dialog is closed.
 * Does NOT sign, reconnect, create browser wallet permissions or revoke social sessions.
 */
export function WalletLifecycleMonitor({
  wallet,
  onInvalidated,
}: {
  wallet: ConnectedWallet | null;
  onInvalidated: (kind: ConnectedWallet["kind"]) => void;
}) {
  useEffect(() => {
    if (!wallet) return;
    let stopped = false;
    const invalidate = () => { if (!stopped) onInvalidated(wallet.kind); };

    if (wallet.kind === "Ultra EVM") {
      const provider = (window as Window & { ethereum?: Provider }).ethereum;
      if (!provider) { invalidate(); return; }
      async function check() {
        if (!provider) return;
        try {
          const [accounts, chainId] = await Promise.all([
            provider.request({method:"eth_accounts"}),
            provider.request({method:"eth_chainId"}),
          ]);
          if (!sameEvmAccount(checkedEvmSnapshot(accounts,chainId,ULTRA_EVM_TESTNET.chainIdHex),wallet?.address))
            invalidate();
        } catch { invalidate(); }
      }
      const changed = () => invalidate();
      provider.on?.("accountsChanged",changed);
      provider.on?.("chainChanged",changed);
      provider.on?.("disconnect",changed);
      const focused = () => {void check();};
      const visible = () => { if (document.visibilityState === "visible") void check(); };
      window.addEventListener("focus",focused);
      document.addEventListener("visibilitychange",visible);
      void check();
      return () => {
        stopped = true;
        provider.removeListener?.("accountsChanged",changed);
        provider.removeListener?.("chainChanged",changed);
        provider.removeListener?.("disconnect",changed);
        window.removeEventListener("focus",focused);
        document.removeEventListener("visibilitychange",visible);
      };
    }

    let dispose: (() => void) | undefined;
    async function watchNative() {
      if (!("ultra" in window)) { invalidate(); return; }
      try {
        const { UltraWalletSDK } = await import("@ultraos/wallet-sdk");
        if (stopped) return;
        const sdk = new UltraWalletSDK({environment:"testnet",provider:"extension"});
        const changed = () => invalidate();
        sdk.on("accountChanged",changed);
        sdk.on("networkChanged",changed);
        sdk.on("disconnect",changed);
        const check = async () => {
          try {
            const [chain,account] = await Promise.all([
              sdk.getChainId(),
              sdk.getSelectedAccount(),
            ]);
            if (chain.data !== ULTRA_NATIVE_TESTNET.chainId ||
                !account.data || account.data.accountName !== wallet?.address) invalidate();
          } catch { invalidate(); }
        };
        const onFocus = () => {void check();};
        const onVisible = () => {if(document.visibilityState==="visible")void check();};
        window.addEventListener("focus",onFocus);
        document.addEventListener("visibilitychange",onVisible);
        dispose = () => {
          window.removeEventListener("focus",onFocus);
          document.removeEventListener("visibilitychange",onVisible);
          sdk.off("accountChanged",changed);
          sdk.off("networkChanged",changed);
          sdk.off("disconnect",changed);
          sdk.dispose();
        };
        await check();
      } catch { invalidate(); }
    }
    void watchNative();
    return () => { stopped = true; dispose?.(); };
  }, [wallet, onInvalidated]);
  return null;
}
