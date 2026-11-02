# M21 — Testnet evidence and adversarial security verification

**Status: security tooling source implemented; operational testnet acceptance NOT MET.** Looke does not possess real verified Ultra testnet factory launch/swaps, Ultra Native Uniq transactions, an authorized deployed factory/pool cohort, independent contract audits, protected Vercel staging, or permission to spend user assets. No signed transaction is being created by this milestone.

## Evidence checker implementation

- `lib/testnet-evidence.mjs` offers a strict, read-only verifier requiring two **operator-configured, distinct-host, HTTPS** Ultra EVM testnet RPCs, chain ID **18881**, an exact user-supplied 32-byte transaction hash, a confirmed successful receipt, block hash and number agreement between transactions, receipts and canonical block queries, **at least 12 observed blocks of confirmation on both RPCs**, matching source code at the receipt block, and the exact full receipt log set and corresponding contract-emitted target event on both nodes. Invalid/missing logs, wrong chain, code differences, event data differences, missing origin, reverted transactions and shallow confirmations fail closed.
- `GET /api/operator/testnet/evidence?stream=coins&tx=0x...&from=0x...` is **private** and requires `Authorization: Bearer <LOOKE_INDEXER_MONITOR_SECRET>`. The factory address is taken from `LOOKE_FACTORY_TESTNET_ADDRESS` and must have a configured trusted deployment block. The event ABI is the current `CoinCreated` emission; the decoded creator must equal the real chain transaction signer and the transaction destination must equal the configured factory.
- `GET /api/operator/testnet/evidence?stream=swaps&pool=0x...&tx=0x...&from=0x...` checks only a `LOOKE_ALLOWED_TESTNET_POOLS` source contract, decodes the V2-compatible `Swap` event, and refuses an empty four-amount swap. Swap callers can interact through a router; the transaction destination need not equal the pool. Supplying `from` requires the transaction's chain-reported sender to match. The caller cannot choose an arbitrary RPC URL.
- The second RPC is server configuration `LOOKE_INDEPENDENT_EVM_TESTNET_RPC`; **it is intentionally blank by default**. The hostname must differ from Ultra's documented primary URL, but separate hostnames **do not guarantee independent operators, archive quality or disjoint infrastructure**. Responses contain no RPC URLs, credentials or raw unrelated wallet history. Re-check canonicality at operation time. No DB writes are performed, and the endpoint cannot sign, deploy, mint, trade, transfer, withdraw or claim.
- `GET /api/operator/testnet/readiness` requires the monitor bearer and reports a hard **HTTP 503 NO-GO** with missing acceptance gates, distinct RPC configuration and the known reference-authorization flaws. `acceptanceGate` is deliberately non-enabling regardless of supplied booleans. No operator-supplied claim of an audit can turn on token issuance or mainnet through this checker.
- Pure regression tests cover malicious/malformed hashes, untrusted RPC endpoints, wrong chain, reverted status, missing/mismatched canonical blocks, insufficient confirmations, mismatched logs and bytecode, unexpected signer and immutably disabled trading. Source release-gate tests assert routes have no wallet-signing/spending code, that private monitor auth is enforced, and that the old **copyable content/trend reference** attack is still documented by actual local Ganache contract tests.
- The project already contains a real isolated EVM adversarial test (`tests/creator-coin-contract.test.mjs`) proving that a different wallet can reproduce a contentRef or trendRef and mint a separate token. This is a **vulnerability finding**, not a pass for author authorization; it blocks financial activation until reviewed, binding onchain authorization exists.

## How to use on protected Ultra testnet staging

1. Obtain Vercel team project-create permission (the documented `looke-staging` creation attempt returned **HTTP 403**). Configure protected preview deployments and isolated Neon before using production credentials.
2. Independently review actual Ultra EVM testnet factory/pool deployments, bytecode/compiler provenance, event ABI, deploy blocks, and known authorization vulnerabilities; do NOT claim the current permissionless copied-ref implementation is safe.
3. Set `LOOKE_FACTORY_TESTNET_ADDRESS` and `LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK` only after verified factory deployment. Configure approved V2 pools only after independently validating pool code, token addresses, router permissions, price calculations and safety.
4. Set a **separate, operator-controlled, HTTPS** `LOOKE_INDEPENDENT_EVM_TESTNET_RPC`, distinct from the documented primary Ultra EVM testnet RPC. Test both nodes' `eth_chainId`, tx/receipt/block query support and matching current chain head. Do not expose RPC access tokens in responses or logs.
5. Generate 32+ character random `LOOKE_INDEXER_MONITOR_SECRET` and keep it server-side. Query `/api/operator/testnet/readiness` first. A failed 503 is an expected safe result until independently verified requirements pass.
6. **Only with an independently authorized and funded test wallet**, perform documented Ultra EVM testnet deployments and contract calls following human-reviewed contract permissions. Signing must occur outside the read-only verifier using a secure, owner-approved wallet; do not provide seed phrases/private keys to Looke or ChatGPT. Record the genuine transaction ID, expected signer and approved source.
7. Invoke the evidence checker with the genuine transaction hash and compare the returned chain/block/hash/code/event with a **third independently reviewed explorer/chain source** and logs at the actual receipt block. Record time, test actor, transaction/receipt, expected contract, results and approval or rejection in a controlled operator runbook. A matching 12-confirmed receipt **does not prove smart-contract audit, authorization, economic safety, hidden chains or user consent**.
8. Run security tests for owner spoofing, copied content/trend refs, repeated nonce/replay, unauthorized manager actions, malformed signatures, duplicate event processing, cursor reorg/legacy checkpoints, evil pool contracts, decimal/fee slippage, stale quote, gas limits and refund/failed swap handling. Independently audit any fixes before public trading.
9. Test **Ultra Native chain** separately: native-account wallet authorization, genuine Uniq factory/issuance/resale/buy/cancel receipts, native finality, lockups and royalties. The EVM receipt verifier **does not validate native-chain Antelope transactions**.
10. Require independent audited creator authorization, anti-Sybil controls, economic risk/security review, complete wallet security, incident response, protected staging and independently corroborated receipts across relevant products. Only a **separately controlled and audited explicit release authorization process** can decide activation. M21 deliberately has no method to self-approve.

## Important limitations

- Two matching RPC responses corroborate a chain observation but are **not cryptographic proof of independent operators**, immutable economic settlement, author ownership, lack of deep reorg, secure/verified smart contract code, KYC/AML, or wallet intent.
- Checking the receipt's `from` matches an expected address shows what the EVM transaction recorded; it does not prove what a Looke web session user intended or whether a malicious signer was used.
- Testnet transactions, when actually obtained, are not equivalent to independently audited and production-safe onchain contracts. Do not infer current user positions or treasury balances from token creation events.
- All indexer/network observations have 12-block confirmation delay, not guaranteed irreversible finality.
- M21 changes no production financial contract, token issuance toggle or user trading capability; there are no payment or reward permissions in this milestone.

**M21 remains partial until live authorized signed testnet transactions and third-party verification, independent security audit, corrected contract authorization, native wallet proof and protected staging are available.**


## M21 continued: source-only issuance authorization mitigation (2 November 2026)

The next iteration hardens `contracts/LookeCoinFactory.sol` **in source, not in any verified deployed contract**:

- The legacy `createCoin(name,symbol,kind,contentRef,supply,metadataURI)` entry point now accepts **creator coins only** (`kind=0`). A nonzero reference for content/trend **cannot** pass this path.
- A new `createCoinAuthorized(request,signature)` path allows content/trend only with a trusted **immutable attestor** (EOA or ERC-1271 wallet verified with OpenZeppelin `ECDSA` and a guarded `IERC1271` read). The typed EIP-712 authorization includes the caller's EVM wallet, kind, reference, name/symbol/metadata hashes, token supply, per-caller nonce and maximum 24-hour deadline. Chain ID and verifying factory address are in the EIP-712 domain. The caller still submits their own transaction.
- All non-creator references are additionally **globally unique per kind**, so even an erroneously approved second wallet cannot create a second coin for the same post/topic on this factory.
- The trusted attestor must securely verify authenticated post ownership, current revision/publication status, content disputes and moderated trend governance **before** it signs anything. **No issuance-attestor service, signing key, deployment address or governance authority is configured or activated.** A malicious, compromised or careless attestor could still approve false assertions; this is **not cryptographic proof of offchain authorship**.
- Existing/older independently deployed bytecode would remain vulnerable; replacing source does not upgrade existing immutable contracts. A new, separately reviewed deployment and migration must explicitly reject old factory addresses, verify provenance and update allowlists.
- Updated isolated Ganache tests must prove authorized issuance, stolen signature rejection, nonce replay refusal, expiry/future deadline rejection, altered terms rejection, domain/chain/factory replay rejection and global reference uniqueness. Passing these tests is **not** an audit or independent Ultra Testnet acceptance.

**Release still NO-GO:** source-level mitigation is not operational activation. Independent security review, an audited attestor trust model with revocation/governance controls, protected staging, genuine two-wallet testnet transactions, two independent RPC corroborations and third-party chain evidence are still required. No public issuance, trading, funds movement or mainnet capability is enabled.


## M21 operator content attestation review and signed Testnet receipt acceptance (2 November 2026)

**Status: source-only operational preparation; external attestor / deployment / testnet acceptance NOT ACTIVE.**

### Trust boundary

- `GET /api/operator/attestor/review?postId=<uuid>` is a separately authenticated operator-only **read-only** endpoint. Its own long bearer `LOOKE_ATTESTATION_REVIEW_SECRET` must not equal the indexer or monitor credentials. The handler refuses requests unless explicitly enabled via `LOOKE_ATTESTATION_REVIEW_ENABLED=true` in **protected staging**; it is off by default. It does not accept user-supplied RPC URLs, factory addresses, issuer keys or approval booleans.
- Content proposals are pulled exclusively from the dedicated Looke SQL tables: `looke_content_coin_drafts` joined to the current `looke_posts`, author profile and private `looke_post_reports`. A missing/deleted/hidden/reported/edited source, mismatched profile/wallet, invalid metadata, invalid supply or stale snapshot **fails closed**. This is an engineering preflight, **not independent legal authorship, safety approval, secure anti-Sybil identity or metadata pinning proof.** Moderator decisions and legal/content disputes still require review.
- All onchain reads are from the documented Ultra EVM Testnet 18881 RPC and a second independently configured HTTPS host. The handler reads at the same 12-confirmed block on both nodes, requiring matching canonical hash, immutable factory `attestor()`, per-sender `authorizationNonces()`, unused global `referenceCoinFor(1,contentRef)` and **exact runtime keccak256** equal to `LOOKE_EXPECTED_FACTORY_CODE_HASH`. That hash must be independently established from approved source/compiler and deployment provenance. Merely copying a hash from an untrusted RPC is **not** security acceptance.
- Only **unsigned** EIP-712 `CoinAuthorization` data are generated: chain + factory domain, wallet/creator, content ref, token-term hashes, nonce, five-minute expiry derived from the corroborated block timestamp. Original source text and token terms are included for *operator review*, never public browsing. The response says `manualApprovalRequired:true`, `signed:false`, `issuanceEnabled:false`. The chain/nonce/post may change after a 12-confirmed snapshot; an external signer must revalidate immediately before signing and must refuse stale payloads.
- **Trend issuer path is denied:** existing trend nominations cannot become onchain-approved just from mutable social nominations and endorsements. A separate reviewed governance registry/policy, anti-Sybil review, appeals and explicit audited approval mechanism are still required.

### External signing/operational controls NOT built or enabled

**There is intentionally no Vercel signing key or signing API.** Do not upload attestor seed phrases, private keys or raw hardware-wallet secrets to Looke, Vercel, GitHub, ChatGPT, analytics or CI. To operationalize safely, an independent team must specify an attestor wallet/custody system (ideally hardware-backed or multi-party with a revocation/rotation plan), dual-person issuance approvals, complete source/content dispute checks, immutable audit logs, rate limits, expiry/nonces and independent security assessment. An immutable attestor set in the factory constructor cannot be rotated without a new factory migration. ERC-1271 attestors must be separately audited for replay and authorization bypass.

### Unsigned deployment manifest (NO submission)

After source audit and independent approval of a specific attestor **public address**:

```powershell
$env:LOOKE_EXPECTED_ATTESTOR_ADDRESS="0x...reviewed-public-attestor..."
$env:LOOKE_UNSIGNED_DEPLOY_ACK="REVIEWED_TESTNET_ONLY"
npm run factory:prepare:testnet > unsigned-factory.json
```

The local `scripts/prepare-testnet-factory.mjs` compiles Shanghai-compatible Solidity, with pinned optimizer runs, and outputs ABI, compiler version, creation bytecode hash and **unsigned** constructor calldata for chain 18881. It **does not** connect to a chain, deploy or sign anything. An authorized owner must independently verify the build, then approve and sign any Testnet deployment with their own secure wallet, after audit. Do **not** reuse previously vulnerable factory deployments or treat constructor/creation hash as deployed runtime hash.

### Genuine wallet-signed Testnet acceptance (read-only)

After an authorized owner has independently deployed the reviewed factory on **Ultra EVM Testnet 18881**, and independent source/compiler/constructor/runtime code analysis has established the expected runtime hash:

1. Set private operator configuration `LOOKE_FACTORY_TESTNET_ADDRESS`, `LOOKE_FACTORY_DEPLOY_TX_HASH`, `LOOKE_EXPECTED_ATTESTOR_ADDRESS`, `LOOKE_EXPECTED_FACTORY_CODE_HASH`, and a distinct provider `LOOKE_INDEPENDENT_EVM_TESTNET_RPC`. The independent RPC URL may include a provider access token only in server-local config; never commit/log/share it.
2. Set local `LOOKE_TESTNET_ACCEPTANCE_ACK=REVIEWED_TESTNET_ONLY` and run `npm run factory:verify:testnet`. This **does not** broadcast or sign.
3. The script fails closed unless two nodes both verify chain 18881, a successful **externally wallet-signed** contract creation receipt with >=12 confirmation blocks, the same canonical block and logs, receipt contract address matching the configured factory, historical and current runtime bytecode hash equal to pinned reviewed hash, and immutable attestor equal to the intended public address.
4. Optionally, after independently reviewing and obtaining a legitimate creator-signed Ultra Testnet content coin issuance transaction with an externally approved EIP-712 attestor signature, configure `LOOKE_CONTENT_ISSUANCE_TX_HASH` and rerun. It checks the caller, exact factory events, `CoinAuthorizationUsed` nonce, globally reserved contentRef, issued ERC-20 totalSupply and token runtime code across both RPCs.
5. Independently corroborate hashes, source provenance and bytecode with a third reputable explorer/source. Verify in an actual user wallet and indexer; record receipt IDs, block/hash/time, signer and source audit artifact in a private human-reviewed change record. Cross-node agreement alone does not prove independent providers, intent or economic safety.

**No execution or financial release permission follows from these checks.** Native Ultra Uniq wallet-signed activity remains separate; public issuance/trading and mainnet remain NO-GO pending attestor operations, independent audit, protected staging, real wallet acceptance and explicit multi-party release approval.
