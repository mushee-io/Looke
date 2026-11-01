# M16 — Uniq Creator Management Tools (private metadata workflow)

**Status: source implemented, not a live native NFT management tool.** M16 extends M14 private Uniq collection and edition preparation with authenticated editing, optimistic revision control, deterministic metadata bundle export and edition-plan visibility. It does not modify any onchain native Uniq token or factory, and its planned supply figures are not minted supply.

## Source implementation

- `db/012_uniq_creator_tools.sql` adds `revision` to the M14 collection and edition draft tables and `updated_at` to the edition table. Applied to **dedicated Looke Neon staging** and verified via database schema reads. Existing draft rows start at revision 1. No user assets, contracts or other projects are changed.
- `PATCH /api/uniq-drafts/collections/[id]` accepts a **complete replacement** of creator-owned draft metadata plus `expectedRevision`. A single PostgreSQL update sets the changes only when `id`, authenticated profile and expected revision all match; it increments revision atomically. Outdated changes return HTTP **409** with the new revision, rather than silently overwriting another tab's edit. Missing or non-owner drafts return 404.
- `PATCH /api/uniq-drafts/items/[id]` provides the same revision-checked replacement for name, description, IPFS URI and planned edition count. It enforces that the item stays within the authenticated creator's existing collection, so a draft cannot be moved across accounts, and returns 409 for a stale version.
- Both PATCH routes retain the existing session and same-origin protections, bounded JSON parsing and strict M14 metadata validation: safe UTF-8 title/description, pinned-IPFS-CID-shaped references, exact native account naming, optional uint64 factory ID, and whole-number planned edition count from 1–100,000.
- `GET /api/uniq-drafts/export?collectionId=<uuid>` requires the current Looke EVM session to own that collection. A **read-only repeatable-read transaction** fetches the collection and up to 50 owned item drafts from a consistent database snapshot. Exports stable `looke.uniq.creator-bundle.v1` JSON, sorted by UUID, with per-item and collection metadata, revision numbers, per-manifest SHA-256, and exact total *planned* edition supply.
- A SHA-256 of the **canonical minified inner JSON bundle** is returned separately. The frontend downloads a human-readable wrapper with the bundle and checksum; the checksum applies to the inner canonical JSON bytes, **not** the wrapper file bytes. It proves byte consistency only, not media originality, IPFS pinning or native blockchain authority.
- `components/UniqCreatorTools.tsx` appears alongside the existing Creator Studio on the NFTs page. It provides collection/edition selectors, editable metadata forms, visible revision numbers, supply planning, conflict refresh, JSON export download and clear no-mint warnings.
- `lib/uniq-tools.mjs` contains revision/shape checks, deterministic export generation and checksums. Pure tests cover revision bounds, metadata validation, cross-collection and duplicate edition rejection, input manipulation, deterministic ordering and export-digest changes.
- Existing M14 collection and item GET endpoints now return revision numbers so clients can detect stale edits. These are account-scoped database records; there is no verified link between the Looke EVM session and an Ultra native wallet.

## Security and scope

- These are **private offchain drafts** only; editing the planned edition limit cannot burn, mint, add or change Uniq supply on native Ultra.
- The JSON package has no keys, signatures, wallet approvals, onchain ownership attestation, native `create.b` or `issue.b` transaction, verified IPFS pin, automatic batch deployment, or preview-derived real NFT trading claims.
- There are no remote metadata fetches or externally supplied URL requests. IPFS URI syntax is validation of a creator's reference, **not verification that the CID is reachable or pinned**.
- The revision check prevents a normal stale-tab overwrite, but not malicious behavior by an authorized account or a compromised session. Uniq media rights, owner impersonation, metadata content moderation and native wallet pairing remain independent requirements.
- Exact edit history/undo is **not** provided here; only the latest revision number and current draft is stored. A saved update invalidates previous metadata hashes and requires an export refresh.

## Release acceptance gates

1. Resolve Vercel team project deployment permissions (previous HTTP 403), establish protected HTTPS staging, and test two isolated Looke EVM accounts for cross-account 404, session expiry, revision conflicts and concurrent updates.
2. Verify exported canonical JSON byte hashes on independent devices and inspect format compatibility with exact Ultra native NFT metadata/factory schema before pinning.
3. Establish actual upload/pinning, CID content verification, versioned media provenance, creator rights/dispute handling, content moderation and safe remote rendering policies.
4. Securely associate Looke EVM sessions with Ultra native wallet ownership via audited native wallet challenge, network binding and replay protection, then verify real `factory.b` and `token.b` state.
5. Build audited native NFT lifecycle tools only after real factory authorization, costs, account policies, permission review and wallet tests: approved metadata modifications, batch issuance with clear gas/UOS cost caps, release schedules, and onchain confirmation reconciliation.
6. Verify genuine Ultra testnet `create.b`, `issue.b`, and permitted NFT management transactions with independent explorer receipts and holdings/finality; no such receipts are asserted by M16.
7. Complete role/abuse/privacy security review, read-only endpoints monitoring, load tests, accessibility and device testing, independent production acceptance and explicit mainnet deployment approval.

**M16 remains partial**: full draft editing and export foundations built, but no real native assets are managed, minted or transferred.
