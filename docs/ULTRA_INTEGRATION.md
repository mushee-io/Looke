# Ultra integration boundary (phase 2)

The initial Looke milestone is a **client-side product preview**, not a deployed exchange, NFT minter, or wallet application. All market figures, creators, content and Uniq previews are synthetic. Drafts, likes, follows and watchlists are browser-local only.

## Network fundamentals

Ultra provides a native token contract (`eosio.token`-style action model) and its Uniq NFT system contract. It is **not EVM**. Do not attempt to deploy Zora Uniswap V4 hooks or Solidity contracts directly to Ultra. All new trading settlement, quote/routing, fee accounting and creator payouts need Ultra-specific design, execution and security review.

Official references:
- [Ultra documentation](https://developers.ultra.io/)
- [Ultra contracts and token/NFT actions](https://developers.ultra.io/blockchain/contracts/)
- [Uniq NFT API](https://developers.ultra.io/products/nft-api/introduction)
- [Ultra Tool Kit](https://developers.ultra.io/products/ultra-tool-kit/)

## Integration gates

1. Wallet: verify approved Ultra Wallet signing/permission flow and web SDK against official Ultra docs. Never ask users for seed phrases. No wallet actions are wired into this phase.
2. Profiles and publishing: implement authentication, durable data stores and media moderation; resolve identity-to-wallet mappings.
3. Coins: design creator/content/trend token lifecycle on Ultra native token contract; distinguish single-issuer token symbol uniqueness and required resource provisioning.
4. Market: decide and implement AMM/order-book liquidity, escrow, slippage constraints, fair launch, oracle/pricing and a canonical on-chain indexer. No trading UI may claim fills before chain confirmation.
5. Fees: map creator, liquidity-provider and platform liabilities to conserved collateral; publish transparent tokenomics and fee splits.
6. Uniqs: integrate factory creation and minting actions, secondary listing/buy/cancel/resell and account inventory from chain data. The Ultra NFT API requires a developer `client_id` from developers@ultra.io; use secure server-side configuration.
7. Environments: start on persistent Ultra testnet with authorized credentials, transaction IDs, explorer receipts, separate test balances, monitoring and rollback plans.
8. Security: unit/integration tests, adversarial transaction tests, independent audit and review before public launch. Trading and NFT purchase buttons must remain disabled until verified.

## Product parity target

Recreate the discover → follow → create → market → portfolio flows familiar from Zora, using original Looke branding and visual assets. Extend with a full Uniq NFT launchpad and collection marketplace. Design parity does **not** mean copying Zora code, artwork or protected brand elements.
