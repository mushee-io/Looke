# Looke wallet and network integration (M4 foundation)

This branch adds **testnet-only, user-initiated wallet connection**. Wallet connection is not account authentication and does not authorize trades, spend approvals, NFT mints, or login sessions.

## EVM wallet
- Supports injected EIP-1193 wallets, requests accounts and checks `eth_chainId` against Ultra EVM testnet `18881` / `0x49c1`.
- Wrong-chain wallets are rejected; the user can explicitly switch or add the documented testnet chain. After switching, reconnect to recheck the account.
- No application code signs or transmits transactions. For production, verify provider events and a persistent wallet session, implement replay-safe signed login and network-based preflights.
- Public read-only endpoint `/api/network` checks live RPC chain identity and block height, with no credentials or financial writes.

## Native Ultra Wallet
- `@ultraos/wallet-sdk` is dynamically imported in a client-side effect and instantiated for `testnet` + `extension`. Native testnet web wallet is **not supported** by the SDK.
- SDK connection performs native chain environment verification and returns a blockchain account identifier.
- Native Ultra Uniqs are not ERC-721s on Ultra EVM. Minting/resale still requires native Uniq contract actions and registration for the Ultra NFT API.

## Unverified gates
1. Confirm a genuine Ultra EVM testnet account connection in-browser and an Ultra native extension testnet connection.
2. Obtain server-side Ultra NFT API credentials from developers@ultra.io; do not put secrets in `NEXT_PUBLIC_` or GitHub.
3. Add signed session auth, database, media pipeline, Uniq factory management and settlement; get independent contract audit.
4. Execute and retain authorized testnet transaction receipts, and confirm RPC/indexer finality before enabling any live actions.

Official docs:
- https://developers.ultra.io/tutorials/Ultra-EVM/Resources
- https://developers.ultra.io/products/ultra-wallet-sdk/getting-started
- https://developers.ultra.io/products/nft-api/authentication

## M4 wallet lifecycle hardening

See `docs/M4-WALLET-ACCEPTANCE.md`. The app now checks native chain identity independently, monitors wallet connection validity outside the modal and supports explicit disconnect. A native RPC status endpoint returns only verified testnet chain information. This remains source-only until device testing on protected HTTPS staging.
