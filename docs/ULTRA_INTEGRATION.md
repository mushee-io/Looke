# Ultra integration boundary (phase 2)

The initial Looke milestone is a **client-side product preview**, not a deployed exchange, NFT minter, or wallet application. All market figures, creators, content and Uniq previews are synthetic. Drafts, likes, follows and watchlists are browser-local only.

## Network fundamentals

Ultra has **two relevant execution environments**. Its native chain provides a token contract (`eosio.token`-style action model) and the Uniq NFT system contract. **Ultra EVM** is an EVM execution environment within Ultra, supporting Ethereum-style smart-contract development; this is different from the native chain. A Solidity contract cannot be deployed directly to Ultra's native WASM environment, and Zora's Uniswap V4 hook/settlement dependencies must not be assumed deployable or secure on Ultra EVM without compatibility, liquidity and audit checks. Looke must first select and document the coin execution environment, wallet signing scheme, liquidity venue, fee model and how native Uniq users move between environments.

Official references:
- [Ultra documentation](https://developers.ultra.io/)
- [Ultra contracts and token/NFT actions](https://developers.ultra.io/blockchain/contracts/)
- [Uniq NFT API](https://developers.ultra.io/products/nft-api/introduction)
- [Ultra Tool Kit](https://developers.ultra.io/products/ultra-tool-kit/)
- [Ultra EVM overview](https://developers.ultra.io/tutorials/Ultra-EVM/)
- [Ultra EVM resources, chain IDs, RPCs and explorers](https://developers.ultra.io/tutorials/Ultra-EVM/Resources)

## Verified Ultra EVM network references

| Network | Chain ID | RPC | Explorer |
| --- | ---: | --- | --- |
| Testnet | `18881` | `https://evm.test.ultra.eosusa.io` | `https://evmexplorer.testnet.ultra.io` |
| Mainnet | `19991` | `https://evm.ultra.eosusa.io` | `https://evmexplorer.ultra.io` |

These endpoints are documentation references, **not** evidence of Looke deployment or integration. Confirm chain identity and signer/network configuration before first test transactions.


## Integration gates

1. Wallet: decide how Looke supports native Ultra Wallet and/or EVM-compatible wallets (e.g. MetaMask), including secure, explicit switching and account identity. Never ask users for seed phrases. No wallet actions are wired into this phase.
2. Profiles and publishing: implement authentication, durable data stores and media moderation; resolve identity-to-wallet mappings.
3. Coins: make a documented native Ultra vs Ultra EVM choice for creator/content/trend token lifecycle. For native, handle issuer/token symbol uniqueness and resource provisioning; for Ultra EVM, evaluate ERC-20 issuance, pool/router/hook availability, chain-specific gas and permission models. Do not assume Base contracts can be reused unchanged.
4. Market: decide and implement an AMM/order-book route on the chosen execution environment, including liquidity, escrow, slippage limits, fair launch, oracle/pricing and a canonical chain-specific indexer. No trading UI may claim fills before chain confirmation.
5. Fees: map creator, liquidity-provider and platform liabilities to conserved collateral; publish transparent tokenomics and fee splits.
6. Uniqs: integrate native Uniq factory creation and minting actions, secondary listing/buy/cancel/resell and account inventory from chain data. If coins run on Ultra EVM, avoid promising atomic cross-environment purchase/settlement; specify custody, bridging, receipts and finality separately. The Ultra NFT API requires a developer `client_id` from developers@ultra.io; use secure server-side configuration.
7. Environments: start on persistent Ultra testnet with authorized credentials, transaction IDs, explorer receipts, separate test balances, monitoring and rollback plans.
8. Security: unit/integration tests, adversarial transaction tests, independent audit and review before public launch. Trading and NFT purchase buttons must remain disabled until verified.

## Product parity target

Recreate the discover → follow → create → market → portfolio flows familiar from Zora, using original Looke branding and visual assets. Extend with a full Uniq NFT launchpad and collection marketplace. Design parity does **not** mean copying Zora code, artwork or protected brand elements.
