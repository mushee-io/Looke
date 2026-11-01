# M15 — Native Ultra Uniq Marketplace (read-only discovery and review)

**Status: read-only source implemented, not a deployed/live trading marketplace.** Native Ultra testnet resale discovery and guarded buy/list/cancel eligibility **review** are available in Looke's NFTs UI. No listing, sale, cancellation, custody, wallet signing, money transfer or production marketplace action is enabled.

## Onchain source and safeguards

- The authoritative native resale table is `eosio.nft.ft::resale.a`, in scope `eosio.nft.ft`, keyed by `token_id`. It contains `owner`, `price` (an Antelope `asset` string), and `promoter_basis_point`. We query the fixed Ultra **native testnet RPC** and first validate its exact chain ID against `ULTRA_NATIVE_TESTNET.chainId`. No user-controlled RPC URL is accepted.
- Every displayed resale row is crosschecked against `eosio.nft.ft::token.b` under the **seller's account scope** at the same exact token ID. A missing or inconsistent `token.b` record means the candidate is **not** shown as owner-crosschecked; it may be stale or legacy `token.a`. The source page discloses skipped rows and does not invent listings.
- An explicit nodeos `get_table_rows` cursor browses six raw rows at a time. Strict uint64 IDs avoid `Number` precision loss and cursor replay/nonprogress errors. All prices are parsed as **exact onchain asset strings with BigInt units**, preserving native symbol and decimals (no floating-point price conversion or assumed USD valuations).
- `GET /api/uniqs/marketplace?cursor=<uint64>` returns only owner-crosschecked, read-only resale records, with native testnet chain/head/last irreversible block metadata and timestamps. A displayed row is **not a transaction receipt, finalized listing, independent seller identity verification, guaranteed availability or irrevocable quote**. Crosschecking resale and owner is **non-atomic** (separate RPC table reads).
- `GET /api/uniqs/marketplace/review?intent=buy|cancel|list&tokenId=<uint64>&account=<nativeName>[&price=<asset>]` validates the supplied account name, re-reads the exact sale and `token.b`, then checks `factory.b` existence. A purported buyer cannot purchase their own listed Uniq; only the current listed seller can pass a cancellation review; listing review requires an unlisted token owned by the specified account and an exact positive **UOS** proposal price. It returns a 15-second review expiry, clear blockers and **`executionEnabled:false` in all cases**.
- The native account name submitted in the query is **not** cryptographically verified ownership. No private user information or signing credentials are stored. No `eosio.nft.ft::buy`, `resell` or `cancelresell` payload, blockchain transaction, sender permission or automatic network action is generated.
- `components/NativeUniqMarketplace.tsx` adds real native table discovery, precise price/seller/factory/serial presentation, pagination, owner-dependent review controls, a separate listing proposal review form and honest unavailable/empty states to the NFTs page. Existing gallery demos remain visually identified as illustrative.
- `lib/uniq-market.mjs` and `tests/uniq-market.test.mjs` cover strict uint64 precision, exact token-asset pricing, onchain owner-table reconciliation, invalid promoter values, self-purchase, cancellation authorization, listing ownership checks, and advancing pagination.
- **No Neon migration required for M15:** The resale records remain chain-native and are not created or mirrored in Looke's database. There is no local listing registry that could be mistaken for real token ownership.

## Native resale/fees and finality limitations

- Official docs identify `eosio.nft.ft::resale.a` and `token.b` as table sources. They describe `resell`, `buy`, `cancelresell` as distinct authorization-required native contract actions.
- `buy` can apply factory minimum resale price, USD-to-UOS conversion, promoter/royalty splits and native chain state changes. Crucially, Ultra's buy documentation notes **version-dependent `max_price` behavior** (v0 doesn't use it). Therefore a read-only resale price is **not** enough to safely authorize a buy, quote the actual total cost, prevent slippage or guarantee seller/ownership at signing time.
- Resale and ownership rows are read using separate current-state RPC table calls. They can change between reads, even when each call reports the expected chain. Head/last irreversible block metadata is an informational indicator, not proof all requested rows were read at the same irreversible block.
- The read-only review confirms `factory.b` existence, not complete lockups, trading window eligibility, resale floor, native account KYC/policy restrictions, royalty recipients, wallet-balance sufficiency, final fees, or a succeeded contract simulation. The UI explicitly shows this limitation.
- Risk of public RPC resource abuse remains and must be addressed with caching, bounded rate limits, WAF controls, a source-health monitor and protected staging before public availability.

## Prerequisites for a fully operational M15

1. Resolve the known Vercel deployment permission block; deploy Looke in a **protected native-testnet-only staging environment** and verify actual resale table rows against at least two independent authoritative RPC/explorer sources.
2. Build verified immutable or appropriately-versioned native wallet control proof (signing challenge, expiration, replay prevention, exact chain/account association), and bind it safely to Looke's EVM profile without conflating identities.
3. Independently review the native NFT contract versions, permission requirements, resale floor/shares, promoter fees, USD conversion paths, minimum sale value, lockup/trading windows and network fees. Implement exact quote/final-price acknowledgement with v0/v1-specific protections and transaction simulation.
4. Create a verified user-authorized **`resell` listing, `buy` transaction and `cancelresell`** testnet flow using approved wallets, with user-visible spending caps and actual onchain receipts. Reject stale/replaced listings, ownership changes, self-buys and double purchases. **Do not** activate based only on this source-level preflight.
5. Verify confirmed token ownership changes in `token.b`, resale removal in `resale.a`, receipts, cost/royalty disbursement and finality. Log/reconcile failures and reorg handling separately from Looke database proposals.
6. Require independent security, legal/compliance, anti-fraud, content-reporting, anti-sybil/impersonation, accessibility/load and economic-review signoff before enabling public trading or mainnet. No production NFT marketplace may be inferred from a UI preview.

Official Ultra developer references:
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-tables
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/resell
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/buy
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/cancelresell

**M15 remains partial**: readonly native source and review functionality implemented; real wallet-mediated listing, buying, cancellation and confirmed receipts not yet implemented.
