# M3 — Ultra-native Uniq creation and marketplace acceptance

M3 is a **native Ultra Testnet integration**, entirely separate from Ultra EVM (18881) used by Looke creator coins.

## Official dependencies and documentation

- Ultra Wallet SDK: `@ultraos/wallet-sdk@^0.6.1`, `environment:'testnet', provider:'extension'`.
- Native Testnet chain ID: `7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9`
- Native chain RPC: `https://ultra-testnet.eosphere.io` (alternates in Ultra's public docs).
- Native contract: `eosio.nft.ft`; current tables: `factory.b`, `token.b`, `resale.a`.
- GraphQL NFT API requires a client ID obtained from Ultra; this M3 implementation instead queries the Testnet chain's public table RPC.
- Official SDK: https://developers.ultra.io/products/ultra-wallet-sdk/getting-started
- Native NFT tables: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-tables
- Factory: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/create.b
- Mint: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/issue.b
- Resale: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/resell
- Buy: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/buy

**Important:** the Ultra Web Wallet serves Mainnet only at present. Native **Testnet** requires the browser extension. Do NOT prompt a Testnet user to use Ultra Web Wallet.

## Implemented

1. `/uniqs`: native wallet connect, read-only inventory, collection lookup, public market listings and pagination.
2. `/api/uniqs`: server-only, read-only proxy to a fixed native Testnet RPC. Every table query first checks the real chain ID. Supported reads: status, owned `token.b`, factory `factory.b`, listing `resale.a`.
3. Builder for `create.b` factory (creator/manager both the connected user, stat active, limited maximum mint), `issue.b` single-Un iq mint, `resell`, `cancelresell`, and UOS `buy`.
4. Separate **Review** and **Approve in Ultra Wallet** clicks. The signing call is made immediately on the explicit approval click, without asynchronous preflight calls that could block wallet dialogs.
5. UOS values are formatted to exactly 8 decimals. Factory and mint RAM-payment caps are bounded to 20 UOS. No private keys are requested.
6. Wallet transaction result is recorded as **submitted**. An irreversible block check and native-table state comparison are required for confirmed listing, mint, purchase or cancellation; factory ID must still be independently identified and verified.

## Local instructions

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Open `http://localhost:3000/uniqs`, install the Ultra Wallet Browser Extension, and select **Ultra native Testnet** inside the wallet first.

### Read-only acceptance checklist

- [ ] Load native Testnet status; reject Mainnet chain ID
- [ ] Connect Ultra native **extension** wallet; account name appears
- [ ] View connected wallet's `token.b` holdings (or an empty state, never fake items)
- [ ] Search a known factory ID and inspect `factory.b` values
- [ ] View `resale.a` marketplace with pagination
- [ ] Simulate wrong account, invalid IDs, malformed UOS amounts and RPC failures
- [ ] Confirm all sensitive actions remain behind separate review and wallet approval buttons

### Controlled manual transaction acceptance (must be independently authorized)

- [ ] Fund a dedicated native Ultra Testnet wallet with enough UOS/RAM; confirm gas/RAM cap with operator
- [ ] Create and host actual factory and token metadata; Looke does not upload it automatically
- [ ] Review factory creation `create.b` JSON and fee cap; **user explicitly signs in wallet**
- [ ] Confirm factory-creation hash via Ultra Testnet explorer, identify actual new factory ID from trace, and verify `factory.b` creation and manager/creator (M3 UI intentionally reports factory attribution pending until verified)
- [ ] Review and sign a single `issue.b` mint, verify new Uniq in the recipient's `token.b` after irreversibility
- [ ] Review and sign a `resell` for a token actually owned, verify `resale.a` seller and price
- [ ] Optionally sign `cancelresell` and verify listing removal after irreversible block
- [ ] Optionally perform a small wallet-approved `buy`, verify buyer's `token.b` and removed resale listing
- [ ] Security review before public beta or higher-value transactions

## Known constraints and explicit nonclaims

- **No wallet signatures, transactions, minting, listings, purchases or deployment were executed by engineering/CI.**
- SDK signing code is prepared but has not passed real extension acceptance testing.
- Factory creation needs on-chain ID attribution (a successful wallet hash alone is not final verification).
- Market reads are table pages, not a complete indexed marketplace. Large portfolios require additional pagination and a production indexer.
- The NFT GraphQL API client ID is not configured; direct chain reads have narrower query features.
- URI fields are shown as plain text; this MVP does not fetch, validate hash, host or render arbitrary remote media.
- No payments, creator royalties or fee distributions beyond the native contract's own on-chain rules are promised by Looke.
- Do not present public marketplace trading or NFT creation as live before the manual acceptance checklist passes.

## Merge coordination

M2's PR #2 is currently open; M3 branches independently from `main` to avoid claiming M2 is already merged. If M2 and M3 both change `package.json`, `README.md`, or `src/app/page.tsx`, reconcile on merge. They are otherwise separate integrations on different chains.
