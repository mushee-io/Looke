# M12 — Token trading simulation and read-only preflight

**Status: partial source, not publicly executable.** M12 adds defensive constant-product swap math and a Looke trading lab, plus read-only Ultra EVM testnet pool/wallet inspection. There is **no audited router, deployed Looke AMM, authenticated trading flow, swap execution, approval, real fill, trading volume or token price claim**.

## Built

- `lib/market/trade-guard.mjs` validates unsigned raw base-unit BigInt token amounts, fee assumptions (0–1,000 bps), slippage (0–500 bps) and a V2-style constant-product exact-in swap. It rejects zero/invalid reserves, amounts outside uint112 limits, any expected/minimum output that rounds to zero and malformed string notation.
- Minimum acceptable output is `floor(expectedOut * (10,000-slippageBps)/10,000)`. The price-impact approximation excluding LP fees is `ceil(amountIn * 10,000 / (reserveIn+amountIn))` basis points. Trades above 1,500 bps impact trigger a **high-impact warning**; this is not MEV-aware, a token-price oracle or liquidity audit. The simulator reports **fee assumptions**, not independently verified pool fees.
- `lib/server/trade-pool.ts` checks a **server-only pool allowlist** (maximum 10), requires the `LOOKE_POOL_FEE_BPS` server configuration, pins pool code, token0/token1 and reserve reads to the **same observed Ultra EVM testnet block (chain 18881)**, rejects empty/invalid pools and stale reserves (last update older than one hour), and reads actual token decimal and symbol metadata at that block. It gives the quote a **15-second local TTL**.
- Existing `GET /api/quote` now uses the central verified-shape read-only quote service. There is no user-selectable arbitrary pool, unverified RPC chain, transaction building or router approval operation. The allowlist only indicates *operator configuration*, not independent code audit or secure venue provenance.
- `GET /api/trade/preflight` returns a pinned-block quote plus, when an optional **public wallet address** is provided, the input ERC-20 balance and UOS native balance **at that same block**. It reports wallet ownership as unverified, allowance/gas requirements as **unknown**, and a visible list of blockers. It cannot authorize or broadcast a trade.
- `components/TradeLab.tsx` exposes a transparent **hypothetical** reserve simulator and a separate live-data-only testnet quote form. It labels raw token units, explicit fees, slippage, output, reserves and price impact; uses a connected EVM wallet only for public balance lookup, and **never requests a signature**.
- Explore and the original trading-preview modal now show this lab, replacing an inert coming-soon panel.
- `tests/trade-guard.test.mjs` adds boundary and regression tests for safe parsing, slippage/fee limits, constant-product and minOut calculations, high-impact warnings, quote timeouts and non-executable preflight invariants.
- No Neon schema migration is necessary. The module does not save trade proposals, holdings or spend permissions. No existing Looke private database, credentials or deployed contracts were modified.

## Important limitations

- In the current deployment environment `LOOKE_ALLOWED_TESTNET_POOLS` is empty and no independently audited Ultra EVM testnet swap router is configured. **Real pool quotes will correctly return unavailable until an operator independently verifies and configures a real V2-compatible Ultra EVM testnet pool and its accurate fee.**
- Even after a pool is configured, a V2-compatible ABI and nonzero reserves do not establish contract identity, trusted token behavior, correct fees, oracle price, withdrawability or freedom from MEV/transfer taxes. Pool verification remains an operator/auditor responsibility.
- `/api/trade/preflight` is read-only, can inspect public balances for an arbitrary valid address, and **does not prove wallet control**. Token allowance can only be verified once an independently audited, allowlisted spender exists. The gas estimate cannot be trusted until exact reviewed calldata is simulated onchain for a real user-approved route.
- Quote TTL is a display expiration, not a state-lock; pool reserves may change immediately following the pinned block. No completed transaction or settleable price is guaranteed.
- Creator, content and trend coin issuance from M9–M11 remains prohibited by contract provenance/authorization gaps, so neither newly proposed tokens nor fictitious preview coins should appear as tradable assets.
- The risk and safety checks are source foundations. No wallet signature, ERC-20 transfer, approval, swap submission, market cap, fee-sharing or mainnet action was enabled.

## Release/acceptance gates

1. Resolve existing Vercel 403 permissions; deploy a **protected Looke staging** site connected only to its own Neon instance.
2. Identify independently verified and audited Ultra EVM testnet V2 pools, matching fees/token decimals, trustworthy router/factory bytecode, no malicious transfer hooks or spoofed token metadata. Configure a server allowlist only after verification.
3. Execute read-only quotes with **real pinned Ultra testnet blocks and explorer evidence**; test token0/token1 orientation, fee/decimals, reserve age, changing reserves, zero and extreme liquidity, and high-impact/rounding cases.
4. Add safe router allowlists, independent audit and immutable deployment provenance. Implement genuine wallet-address/chain/session matching, nonce handling, anti-phishing review, allowance and gas checks, calldata simulation/revert diagnostics, slippage/deadline protections, explicit wallet user consent and verified receipt indexing.
5. Run adversarial fuzz, mainnet-fork/testnet contract integration and MEV/transfer-fee/honeypot exposure tests, and an independent smart-contract/economic audit before any swap execution.
6. Obtain **actual signed Ultra EVM testnet swap receipts**, reconcile event/indexer/portfolio balances and measure gas, liquidity and trading behavior before considering a production launch.
7. Implement UX/accessibility and human risk review, plus any required compliance/legal checks.

**M12 remains partial** until audited execution infrastructure, protected real-wallet staging and signed testnet trade evidence are independently verified. No transaction execution switch exists.
