# M17 — Creator earnings policy reviews and payout evidence (native Ultra)

**Status: partial, non-custodial, read-only/unverified. There are no verified realized earnings, credited royalties, withdrawable balances, payout instructions, token sales or deployed distribution contracts in Looke.**

The underlying Ultra **native NFT contract** uses three separate share categories for resale: an onchain protocol/global share, immutable factory-designated beneficiaries, and resale promoter share; seller receives the remainder. Looke's EVM token prototype has **no deployed revenue distributor or fee-sharing contract**, and Ultra EVM wallet identity is not the same as a native Uniq beneficiary account. M17 therefore builds an honest royalty *policy preview* and a private *transaction-reference inbox*; neither constitutes earnings recognition.

## Source built

- `lib/creator-earnings.mjs`: strict native UOS asset parser (exactly eight decimals; integer units within signed int64), complete basis-point share normalization (0–10,000), integer floor allocations for protocol, factory and promoter, plus seller residual. Rounding remainder goes to the seller in this hypothetical scenario. Duplicate beneficiary receivers are preserved as separate line items; client can group by account for an estimated beneficiary share. Invalid, missing or oversubscribed policy fails closed.
- `GET /api/creator-earnings/policy?factoryId=<native uint64>&tokenId=<native uint64>&account=<native account>` checks **Ultra Native Testnet chain ID**, requires a currently listed `resale.a` token, crosschecks the seller's scoped `token.b` entry, validates a matching current `factory.b`, and reads both `global.share` (scope `eosio.nft.ft`) and `saleshrlmcfg` (scope `1`). A policy must be present and parseable; no fallback to assumed default fees or FX conversion is permitted.
- The preview uses the currently configured **default promoter** (if promoter payments are enabled), but the eventual buyer might specify another eligible promoter. The report discloses its assumptions, the exact beneficiary breakdown in raw UOS and a hypothetical selected-account share. These reads are non-atomic across RPC calls and **not a historical sale, a claim on funds, a verified transfer or guaranteed settlement**.
- `db/013_creator_earnings_evidence.sql`: a private Looke profile-scoped inbox of user-submitted native testnet transaction IDs and self-reported account/classification/factory reference. A database CHECK constrains every row to **verification_status = 'unverified'**. There are no amount, earned/paid/withdrawable or recipient-controlled settlement fields.
- `GET/POST/DELETE /api/creator-earnings/evidence`: signed EVM session only, same-origin writes, strict 64-character native transaction hash validation, input-shape restrictions, owner-only read/delete, one reference per creator/transaction, PostgreSQL advisory locks with maximum 5 submissions per 24 hours and 30 retained references per creator. The API explicitly returns `creditedEarningsRawUos:null` and `payoutsEnabled:false`. A posted hash is **not independently checked**, and cannot be upgraded to verified by the client.
- `components/CreatorEarnings.tsx`: a separate NFTs-page Creator Earnings Review for genuine onchain-listed Uniq policy previews, native share distribution scenarios and a private unverified transaction reference queue. Shows a no-verified-revenue state instead of a fake creator balance or market-derived royalties.
- `tests/creator-earnings.test.mjs`: exact-price and no-floating-point checks; UOS precision, missing/over-subscribed fees, beneficiary arithmetic, duplicate receiver handling, rounding and transaction-evidence validation.
- Staging migration `db/013_creator_earnings_evidence.sql` was applied to the **dedicated Looke Neon project**; the new private table and indexes were checked. No user evidence, sample royalties, balances or transfer rows were inserted.

## Business and security boundaries

- **Listing != sale; sale != payment evidence; a submitted hash != confirmed recipient transfer.** Even a valid transaction ID cannot be attributed to a particular creator without checking native chain ID, irreversible transaction/action traces, receiver account, token/currency amounts, factory and resale-share entitlement, timestamps, double counting and other payouts.
- The onchain resale policy can change between the RPC reads, and the buyer's eventual promoter may not match the configured default. The preview cannot represent a final effective fee for a transaction or a historical royalty earned; actual settlement can involve alternative contract versions, USD/UOS conversions, lockups and extra constraints.
- The displayed native account is a **self-reported string**, not proof of ownership. The authenticated Looke identity is an **Ultra EVM wallet session**, which is not cryptographically linked to an Ultra native beneficiary/manager. Do not enable creator payouts or convert evidence into actual earnings until a reviewed, replay-protected native-wallet challenge association exists.
- This implementation does not reach out to arbitrary user URLs, request wallet keys or signatures, transfer funds, create a payout claim or write to Ultra chain. The only database mutations are private *offchain unverified evidence references*.
- No payout router, fee-sharing token contract or treasury holdings exist in the current Looke EVM prototype. Those need independent requirements, audit and actual testnet receipts if introduced later.

## Completion gates

1. Resolve the existing Vercel team permission HTTP 403 and deploy protected Looke staging with isolated Neon, operator monitoring, WAF/rate limiting and multi-account acceptance.
2. Confirm an authentic Ultra native testnet NFT factory and resale cohort, with independently verified table snapshots from multiple RPCs, real beneficiary accounts, protocol/global fee settings and possible buyer-selected promoters.
3. Design a historical **finalized transaction action-trace indexer** using a trusted native history or official API provider; verify buy/resell settlement, actual money transfers, beneficiary account and asset precision, and stable irreversible block IDs. Crosscheck against external native explorer.
4. Implement automatic idempotent reconciliation of gross sale proceeds, protocol fees, promoters, factory royalty beneficiary receipts, seller residual, partial/failed transactions, refunded fees, chain reorgs and version-dependent contract behavior. A timestamped verified ledger must never count unverified self-reported transaction hashes as revenue.
5. Build independent native account signature challenges and EVM/native identity linking; ensure Looke only shows earnings for a proven account with clear privacy policies and permission checks.
6. Run tests with real signed Ultra native testnet purchase, royalty disbursement and payout transaction receipts (including at least two beneficiaries) and independently reconcile actual onchain token balances; no such evidence currently exists.
7. If introducing payouts or claims, design a separately audited custodian/treasury or wallet-directed withdrawal scheme with explicit authorization, reentrancy/replay controls, AML/legal compliance and measurable operational controls.
8. Complete security, financial-integrity, audit and accessibility reviews prior to production and mainnet; no realized revenue or royalty entitlement is claimed here.

## Official documentation

- https://developers.ultra.io/blockchain/general/antelope-ultra/2nd-hand-sale
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-tables
- https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/buy

**M17 remains partial** until actual independently validated finalized native resale/payout receipts, immutable historical fee snapshot attribution and authorized account/revenue reconciliation are available.
