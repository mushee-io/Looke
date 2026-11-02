# M11 — Trend coin nomination and governance foundations

**Status: partial source, unverified social governance. Token issuance and trading remain disabled.**

Looke M11 builds a **social nomination and nonbinding endorsement** system around topical public activity. It is not a DAO, audited token-launch authority, trading engine, snapshot of unique humans, investment recommendation, verified popularity measure, or permissionless mainnet token platform.

## What is built

- `lib/trend-coin.mjs` normalizes a 3–48-character ASCII topic to an unambiguous, reserved-name-protected slug. The global `looke.trend.v1` topic reference is `keccak256(abi.encode(keccak256("looke.trend.v1"), 18881, keccak256(UTF8(slug))))`. This is a deterministic offchain convention, not an onchain attestation.
- `GET /api/trend-coins/evidence?topic=...` counts currently *visible public* Looke posts and *distinct account IDs* containing the topic in the last 14 days using PostgreSQL `simple` full-text search. Eligibility for nomination requires **at least 3 posts by 2 accounts**. This threshold reduces empty submissions but does not prove independent humans, genuine grassroots activity or actual trend popularity.
- `POST /api/trend-coins/proposals` accepts a signed-in creator with a public handle, a topic that currently meets evidence minimums, name, uppercase ticker, 1–1,000,000,000 fixed whole-token supply and plausible IPFS CID. Proposals are **immutable topic/coin terms**, unique by canonical topic slug/ref, and use a PostgreSQL transaction/advisory lock for a 3-nominations-per-account/30-day limit. No payment or wallet signature is requested.
- `GET /api/trend-coins/proposals` displays up to 20 real nominations; true activity author/post counts are recomputed from current visible posts, plus current endorsement counts and the signed-in viewer's state. Only nominations with `under_review` status appear. Wallet addresses, session tokens, private records and individual voters are not returned.
- `POST /api/trend-coins/proposals/[id]/endorse` permits one currently signed-in account to endorse each other user's nomination, or to remove its endorsement. It blocks self-endorsement, new endorsements after 14 days and excessive endorsements (max 15 new endorsement **events** per account per 24 hours). PostgreSQL transaction locks, unique keys and a **private append-only action ledger** prevent concurrent duplicate votes and simple unendorse/re-endorse quota bypass.
- `POST /api/trend-coins/proposals/[id]/withdraw` allows only a proposal's original author to withdraw. Withdrawn topics remain reserved to prevent immediate topic squatting/re-creation. There is intentionally no public endpoint for approving a trend or changing coin specifications after endorsements.
- `GET /api/trend-coins/preflight?id=...` independently recomputes current public evidence and, if explicitly configured, performs a **read-only** Ultra EVM chain-ID/bytecode/creator-kind-2 `coinFor` lookup. Factory bytecode and mapping existence are **not proof of legitimacy**, verified governance or creator authorization.
- The Explore screen contains a real topic activity checker, nomination form, community endorsement/withdrawal controls, and read-only chain status display. Fake demo coins remain distinct from real public nominations.
- `tests/trend-coin.test.mjs` verifies topic normalizations, reserved names, deterministic hashes, evidence minimums, token input limits and strict IDs. The existing isolated Ganache test harness now also covers kind-2 trend coin creation, fixed supply, nonzero reference, same-sender duplicate rejection and **cross-wallet reference copying**.
- `db/009_trend_coin_governance.sql` was applied to the **dedicated Looke Neon staging database**. The proposal, endorsement, private endorsement event and supporting index schemas were verified.
- During implementation, a malformed version of `db/008_content_coin_drafts.sql` from M10 was corrected in source for clean new installations; that migration had previously been applied directly in Looke's isolated Neon environment.

## Important authorization and anti-sybil gap

Current factory `LookeCoinFactory.createCoin` is **permissionless**, and its uniqueness is scoped by sender + kind + reference. Another wallet can create a trend token using the same topic reference regardless of who nominated the topic or how many accounts endorsed it. The isolated EVM tests explicitly demonstrate this behavior. Public issuance **must remain disabled** until an independently audited contract-level authorization, unique topic registry/issuer policy, governance decision process and replay protection are implemented.

Account-level endorsements are **not sybil resistant**: one actor can own multiple wallets/accounts. The proposed social thresholds, rate limits and unique keys reduce low-effort spam but cannot be represented as secure onchain governance or independently verified popular support.

## Release blockers and acceptance

- [ ] Deploy authorized protected staging (existing Vercel team project-creation request was denied HTTP 403) and connect only to Looke's dedicated Neon database.
- [ ] Verify evidence, canonical-topic uniqueness, nomination rates and endorsements using at least three actual signed-in Ultra EVM testnet accounts, including concurrency, account changes and withdrawal cases.
- [ ] Implement authenticated moderator review, rejection reason/appeal handling, audit trails and topic takedown for spam, impersonation, malicious content and intellectual-property disputes.
- [ ] Design independently verified anti-sybil/anti-brigading and governance participation rules; quantify how many real independent people support nominations without inferring it from wallet count.
- [ ] Independently audit contract-level trend ownership, global uniqueness, authorization/replay protection, vesting/emission economics and metadata provenance. No user treasury or fee-sharing exists here.
- [ ] Obtain signed and independently verified Ultra EVM **testnet 18881** contract and token receipts, link accepted governance outcomes to onchain execution, and reconcile indexer records.
- [ ] Complete mobile/accessibility, load/stress, security, moderation and legal reviews; only explicitly approve deployment and mainnet in later milestones.
- [ ] Design separate reliable liquidity provisioning and trading controls; a fixed-supply ERC-20 proposal has no market cap, valuation, earnings or sale volume.

**M11 remains partial until these verifications are completed. No mint, trade, spender, DAO contract or public launch action was enabled.**


## M21 source hardening addendum (2 November 2026)

The permissionless copied-topic behavior described above belongs to the **older factory design**. Revised factory source now rejects all trend issuances through `createCoin` and requires a trusted EIP-712 trend attestation and globally unique topic reference through `createCoinAuthorized`. No actual governance/signer service exists and this source is **unaudited and undeployed**: approval policy, sybil resistance, safe revocation, real Ultra testnet issuance, wallet testing and external review remain outstanding. No public issuance or trading is enabled.
