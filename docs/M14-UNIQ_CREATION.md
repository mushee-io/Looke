# M14 — Ultra Native Uniq Creation Studio and testnet permissions

**Status: private metadata preparation source implemented; no verified live Uniq creation.**

Looke's Uniqs are **native Ultra NFTs** managed by `eosio.nft.ft`, not Ultra EVM ERC-721s. The existing disabled-by-default `NativeUniqMintLab` uses the official `issue.b` wallet action, but there is no authorized onchain Uniq factory created by this milestone, and no signed native testnet mint receipt has been verified. The new Studio does not create tokens, collections or factory records onchain.

## Source delivered

- `db/011_uniq_creation_drafts.sql`: two private tables for **collection drafts** and **per-collection Uniq edition drafts**, scoped to Looke's signed EVM `looke_profiles` sessions. Maximum 8 collections per creator, 50 item drafts per collection, with transaction-locked writes and author-only deletion. Deleting a draft is **offchain only** and does not burn an NFT.
- `lib/uniq-creation.mjs`: strict name/description validation, IPFS CID-only artwork URIs (including safe relative metadata paths), normalized optional native account and uint64 factory IDs, edition limits of 1–100,000. Unknown fields and malformed input fail. Pure tests exercise invalid values, factory readiness cases and deterministic metadata.
- `GET/POST/DELETE /api/uniq-drafts/collections` and `GET/POST/DELETE /api/uniq-drafts/items`: only a signed-in Looke EVM profile can read/manage their own drafts. Write actions require same-origin and bounded request JSON. No unsigned public edit route exists.
- `GET /api/uniq-drafts/manifest?kind=collection|uniq&id=<draftId>`: produces a stable `looke.uniq.metadata.v1` JSON manifest and **SHA-256 of the exact UTF-8 bytes**, ready for independent content pinning/review. The manifest is Looke's own metadata format; it is not evidence of IPFS hosting or an Ultra-compatible final `create.b`/metadata action.
- `GET /api/uniqs/factory?factoryId=<id>&account=<nativeName>`: verifies the configured native Ultra **testnet chain ID** before querying only `eosio.nft.ft`'s official `factory.b` and `authmintrs.a` tables. Checks exact factory ID, active status, current minting window, remaining maximum supply, factory asset manager or positive-quota authorized minter. This is a **read-only eligibility estimate** for an account string supplied in a URL; it does not cryptographically verify that the caller controls the native wallet.
- `components/UniqCreationStudio.tsx`: original Uniq creator workflow on NFTs page, with private collections, edition metadata, SHA-256/JSON review, explicit delete confirmation, planned account/factory references and optional read-only factory preflight for connected native Ultra accounts.
- `components/NativeUniqMintLab.tsx`: strengthens the **separate feature-flag-disabled** native testnet lab: verifies wallet account, reads exact `factory.b`/authorized-minter role, requires an active eligible factory and matching selected manager/minter mode, uses a short preflight lifetime, refreshes factory status and reconnects the wallet immediately before requesting a user-initiated `issue.b` signature. Caps a one-Uniq test action at **10 UOS**, requires exact 8-decimal input and never stores signing keys. A wallet broadcast response is explicitly **not a confirmed issuance receipt**.
- Docs and tests updated; `db/011_uniq_creation_drafts.sql` applied to **dedicated Looke Neon staging**, with both table schemas and indexes verified.

## Security and ownership boundaries

**Important:** Looke's EVM signed-in profile is **not cryptographically bound** to an Ultra *native* account. A creator may type a planned native name in a draft, but that is not verified native wallet ownership or actual factory manager status. The Creator Studio never implies that this information creates an onchain collection.

The factory preflight trusts only the configured Ultra native testnet RPC response and known `eosio.nft.ft` contract/table, not a user-supplied node URL. It checks factory settings but does not independently audit contract runtime, prove finality, estimate all fee/ram ramifications, attest provenance of media, or sign a transaction. The wallet SDK later checks the exact connected native account, and the native contract enforces its own authority.

`NEXT_PUBLIC_LOOKE_UNIQ_MINT_LAB=false` remains the default. An environment flag is **not sufficient release authorization**. The restricted lab is not production-ready even if an RPC call reports manager status.

No remote image is fetched by the backend, no media is hosted, no arbitrary HTML is rendered, no seed phrases or private keys are requested, and no automatic mint, market purchase, factory creation or mainnet action is activated.

## Acceptance steps before M14 is fully complete

1. Resolve the existing team-level Vercel HTTP 403 permission blocker and deploy protected staging with its **isolated Looke Neon database**, HTTPS and a native Ultra Wallet extension under operator control.
2. Publish and independently verify **real pinned IPFS metadata** and artwork, including content hash parity and any exact Ultra factory/token-specific metadata schema. Implement content moderation, provenance/impersonation reporting, intellectual property and creator permission checks.
3. Establish an authorized, onchain native **Uniq factory** via the official `eosio.nft.ft::create.b` process, with genuine factory asset creator/manager agreement, funding, the correct minted max, metadata, fees, windows and operational rights. Factory creation is **not implemented** by Looke; permission restrictions may apply.
4. Verify `factory.b` and `authmintrs.a` against independent Ultra testnet explorer/RPC sources; correctly handle edition quantities, authorized minter quotas, quotas consumed by other actors, minting windows, factory shutdown and account changes.
5. Reconcile native Ultra account ownership with Looke EVM session using an independently verified native **challenge/signature + expiry** or other approved cross-account association. Do not mark drafts native-owned based on an account-name field.
6. With a genuine authorized native testnet account, execute one independently approved `issue.b` transaction, inspect receipt/finality, confirm `token.b` ownership/serials, and reconcile official API holdings; then test failure/cancellation, reorgs and fees.
7. Security and compliance: review authorization/replay/account-change edge cases, alternative wallet behaviors, RPC failures, metadata access and link safety, cost disclosures, independent monitoring, content moderation and mobile/accessibility.
8. Only after explicit approval may restricted testnet minting be enabled. No public minting or mainnet launch is in scope.

## Official Ultra references

- Native NFT factory tables: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-tables
- Creating native factories: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/create.b
- Issuing native Uniqs: https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/issue.b
- Native Ultra explorer: https://explorer.testnet.ultra.io/

**M14 remains partial** until protected staging, real native factory authority, pinned/verified media, actual signed testnet issuance receipts, session/native proof and independent security acceptance.
