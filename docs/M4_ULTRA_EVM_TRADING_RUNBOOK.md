# Looke M4 — verified Ultra EVM creator-token swap terminal

M4 introduces the frontend at `/trade` and a **read-only** server quote/market/activity API. It supports verified **Uniswap V2-compatible ERC20/ERC20** routers and pairs on **Ultra EVM Testnet, chain ID 18881**. It does not deploy a DEX, supply token liquidity, mint fake volume, or execute wallet transactions automatically.

## Verified ecosystem baseline
- Official Ultra EVM Testnet RPC: `https://evm.test.ultra.eosusa.io`, chain ID **18881**.
- Official Ultra EVM Testnet explorer: `https://evmexplorer.testnet.ultra.io`.
- No independently verified, funded Uniswap V2-compatible Ultra EVM Testnet factory/router/pair was established when authoring this milestone. **Do not assume Uniswap router addresses from another network work on Ultra.**
- `LOOKE_M4_MARKETS_JSON` is empty by default. Without verified addresses and live reserves the interface must display **No verified pools** and disable quotes and swaps.

## Pre-launch requirements

1. Complete M2 deployment and obtain a real Looke creator token on **Ultra EVM Testnet**. Prefer a standalone LP wallet on testnet and never send keys to chat or CI.
2. Select a vetted, independently reviewed **V2-compatible factory/router** deployment for chain 18881. If none exists, a future separately reviewed/authorized deployment (outside M4) is needed. **A plain ERC20 token launch is not a liquidity pool.**
3. Establish a real ERC20 quote asset, transfer real test tokens to the LP wallet, and explicitly authorize initial pair creation/liquidity provision through that wallet. This is a real wallet action requiring a human signature. Never auto-bootstrap pools or fake market makers.
4. Obtain the **actual** on-chain addresses: `factory`, `router`, `pair`, `baseToken` (Looke creator token exposing `creator()`), `quoteToken`. Confirm bytecode exists on chain 18881. Verify the factory's `getPair`, pair's `token0/token1/factory`, and router's `factory`.
5. Add reviewed, operator-controlled market entries to **server-only** `LOOKE_M4_MARKETS_JSON`, e.g.:

```json
[
  {
    "id": "creator-usdc",
    "baseToken": "0x<verified_creator_token>",
    "quoteToken": "0x<verified_erc20_quote>",
    "factory": "0x<verified_factory>",
    "router": "0x<verified_v2_router>",
    "pair": "0x<verified_funded_pair>"
  }
]
```
These angle-bracketed values are **placeholders**, not actual addresses; do not copy them to a live environment.
Maximum **8** markets; malformed config fails closed.

6. Run `npm install && npm test && npm run typecheck && npm run build`. Inspect `/api/trade?kind=markets`. Only markets with *real* code, matching factory/router/pair and **positive reserves** appear.
7. Before enabling any public execution, secure a separate security review of the router/token pairs, token behaviors (fee-on-transfer / rebasing tokens are **not** supported), slippage and price impact policy. Only then set the server-side opt-in `LOOKE_M4_TRADING_ENABLED=true` and re-deploy the application.

## Wallet-signed execution acceptance

- [ ] Connect a human-controlled EVM wallet on Ultra EVM Testnet (18881).
- [ ] Confirm actual token balances in the portfolio panel and allowances to the chosen verified router.
- [ ] Select **Buy** (quote token → creator coin) or **Sell** (creator coin → quote token).
- [ ] Enter an exact input token amount and review a real `getAmountsOut` quote. Quotes expire after 25 seconds; slippage maximum 3% and an explicit minimum output is used.
- [ ] If allowance is insufficient, click **Approve exact token amount** and sign in your wallet; allow for a separate reset-to-zero step when a previous insufficient approval exists. The app waits for confirmation and re-reads allowance, then requires a fresh quote.
- [ ] Separately click **Confirm swap in wallet**. The app requests `swapExactTokensForTokens` with the reviewed two-token path, minOut, 5-minute deadline and connected-wallet recipient.
- [ ] Confirm the real transaction, **2 block confirmations**, exact router recipient, actual matching pair `Swap` event and token `Transfer` from pair to wallet meeting the minimum. Failed/time-out transactions remain **unverified**.
- [ ] Verify transaction in the official Ultra Testnet explorer and compare on-chain balance changes.
- [ ] Observe actual pair Swap logs appear as candles, volume, and transaction links. **If there are no swaps there must be no candles or volume.**

## Activity and chart limitations

- Lookback is bounded to the latest **3,600 blocks** (~1h if block time is 1 second); up to 500 pair swap logs are fetched, and chart reconstruction uses the latest 80 logs in that range.
- Price is the executed quote-token/base-token ratio from actual pair Swap logs, **not** a centralized pricing API. The reserve ratio is displayed separately as `pool spot price`.
- Any volume is labeled **observed** in the scanned window. It is **not** a complete market volume or 24h turnover. Missing candles are never generated.
- Portfolio shows actual ERC20 balances and a reserve-price **estimate**, not executable value or realized P&L.
- The terminal is an AMM router swap interface, not a central limit order book. It does not claim to show resting orders.

## Security limitations

- The configured router is trusted once operator-reviewed; code presence and interface consistency **do not substitute for a contract audit** or prove that the router is not malicious.
- Unverified or zero-reserve pools fail closed; a server flag alone cannot make an invalid pool executable.
- The app is for controlled **Testnet** acceptance first. Do not use real-value assets or mainnet credentials.
- No liquidity provider functions or contract deployments are included; those need separate security-reviewed milestones.
- A Testnet quote can become stale or fail at execution; output minimum and wallet confirmation are protection, not a price guarantee.
- No fake trading, order books, prices, candlesticks, transaction hashes or volume should be presented in demos.
