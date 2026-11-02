# M10 — Post-linked content coins: private proposals and provenance

**Status: core source built, issuance blocked.** Looke M10 connects an authenticated creator's *visible, database-backed social post* to a proposed fixed-supply Ultra EVM content coin (factory kind `1`). It does **not** issue or trade tokens, transfer funds, guarantee legal authorship, verify IPFS pinning or attest ownership onchain.

## Implementation

- `POST /api/content-coins/drafts` accepts only a published, visible post belonging to the authenticated Looke session's profile, plus a valid creator coin name, uppercase ticker, whole-token fixed supply up to 1 billion and plausible IPFS CID metadata URI.
- The endpoint obtains the **current database text and revision** under a PostgreSQL row lock, never from an untrusted client-supplied post body or creator address. It validates the author has a public creator handle and atomically limits private proposals to 20 per account. One proposal exists per post; updating the proposal after a legitimate post edit generates a different reference.
- **Content reference v1** is a versioned, deterministic commitment:
  `contentRef = keccak256(abi.encode(keccak256("looke.content.v1"), uint256(18881), authorEvmAddress, bytes16(postUUID), keccak256(UTF8(currentPostText)), keccak256(UTF8(postEditedAtISOorOriginal))))`.
  Each commitment is bound to the *signed-in creator's address, post UUID, exact text, revision and target Ultra EVM testnet*. The revision timestamp prevents post edits followed by identical restored text from appearing to preserve the original snapshot.
- The dedicated `looke_content_coin_drafts` table stores the author ID/address, text hash, revision, version, reference, and coin metadata. All drafts are private to their authenticated author, protected by first-party Origin validation for writes. The post foreign key cascades deletes so removing the source post removes its corresponding proposal.
- `GET /api/content-coins/drafts` shows the author only their recent 40 visible posts and saved proposals with a **current vs stale/hidden** snapshot marker; `DELETE` removes only the signed-in author's private draft.
- `GET /api/content-coins/preflight?postId=...` checks authorship, post visibility, text + revision match, target testnet 18881, and optionally reads a specifically configured deployed factory's bytecode and `coinFor(keccak256(abi.encode(creator, 1, contentRef)))` mapping. Stale, hidden, removed, or non-owner posts fail. This is a read-only indication, not independent verification of the factory's authenticity.
- An accessible Profile-page Content Coin Lab lists the author's real posts, provides a form to save private proposals, explicitly requests confirmation before deleting drafts, displays the content commitment and can initiate the read-only preflight. Each author-owned Feed post links to that preparation UI.
- Pure tests cover author/post/text/revision deterministic hashing, invalid token attributes, IDs, and stale detection. The isolated Ganache test suite extends the Solidity factory coverage for kind `1`, a required nonzero content reference, total supply and recipient, duplicate per-wallet/reference refusal and independent references.
- `db/008_content_coin_drafts.sql` has been applied to the **isolated Looke Neon staging database**, and the proposal schema plus indexes verified. It has not deployed the website or any contract.

## Critical contract authorization gap

The existing `LookeCoinFactory.createCoin` is **permissionless**. For content coins it checks only that the content reference is nonzero, and uniqueness is scoped to `msg.sender`, coin type and reference. It has **no cryptographic proof that `msg.sender` owns the referenced Looke post**. A second wallet can copy a valid content reference and launch a separate token in the same factory: an isolated EVM regression test demonstrates this explicitly.

Therefore **public launch is a NO-GO** even if the factory compiles, a database proposal has a matching snapshot, or a `coinFor` mapping exists. Onchain authorization will require a reviewed issuer model, e.g. versioned EIP-712 creator-signed post attestations with nonces, domain/chain/factory binding and replay protection, or an independently audited proof/registry architecture. This change deliberately **does not** add a public mint button or an authorization bypass.

## Operational acceptance gates

1. Deploy authorized, protected HTTPS staging to the correct Looke Neon instance (Vercel create-project previously returned HTTP 403 for the available team permissions).
2. Use two distinct real Ultra EVM testnet wallets/sessions and verify cross-account draft isolation, wrong-owner rejection, stored snapshot integrity, safe update after post edit, hidden/removed post rejection, and deletion cascade.
3. Independently assess metadata identity, pinning, ownership disputes, unauthorized brands/likeness, moderation and abuse reporting. A Looke post and profile are *not* KYC, legal intellectual-property proof or a permissionless issuance entitlement.
4. Implement, audit and test an **onchain-authenticated** post provenance/authorization mechanism so a copied post reference cannot be launched by another wallet; include replay protection and revoked/hidden content policies.
5. Deploy audited factory/authorization components to **real Ultra EVM testnet 18881**, obtain signed receipts and independently verify bytecode, token supply, balances, events and indexer parity.
6. Design transparent creator-token issuance economics, DEX liquidity, price disclosure, spam controls, gas/approval preflight and risk warnings. No liquidity, creator revenue, valuation, market cap or trading volume is implied by a draft or ERC-20 mint.
7. Conduct independent security audit, wallet/device testing, load testing, content moderation and release approval before considering public issuance or mainnet.

**M10 remains partial** until onchain provenance, audit, real signed testnet receipt evidence and operational staging tests are complete.


## M21 source hardening addendum (2 November 2026)

The permissionless copied-reference behavior described above belongs to the **older factory design**, not the revised source. The revised factory rejects content issuance through the six-argument entry point, requiring a trusted, scoped EIP-712 signer on `createCoinAuthorized`, and enforces global reference uniqueness. This is still an unaudited, undeployed prototype: no offchain ownership authority, signer operations, real signed Ultra testnet receipt or independent security acceptance has been completed. Read-only drafts/preflight remain non-issuing.
