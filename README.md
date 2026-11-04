# Looke — create on Ultra

Looke is an **Ultra-first** creator platform for coins, native Uniq NFTs and communities. This is a fresh codebase in `mushee-io/looke`. It selectively reuses permitted open-source Zora SDK code; it is **not** a fork of Zora's commercial product, frontend or restricted coin contracts.

## Current capabilities

- Original Next.js frontend with Discover, Create, Uniq NFTs and Messages screens.
- Injected EVM wallet connection with an explicit Ultra EVM **Testnet** chain switch (chain ID `18881`).
- Creator coin draft, local image/metadata validation and fixed-supply preview.
- Independently implemented ERC-20 `LookeCoin` and `LookeCoinFactory` Solidity contracts.
- Wallet-approved `createCoin` transaction path **only when** a verified factory address is configured.
- Unit tests, Foundry contract tests and CI configuration.

**Not yet live:** creator token issuance (no deployed factory address supplied), NFT minting, real swaps/market liquidity, candlesticks, staking, production indexer, social messaging or public beta. A submitted hash is not the same as a confirmed transaction. Nothing here is an audited trading system.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Use an injected EVM wallet and switch to **Ultra EVM Testnet (18881)**. The UI can connect before any contract deployment.

## Tests

```bash
npm test
npm run typecheck
npm run build
forge test -vv
```

Foundry is needed for Solidity tests. The CI workflow runs frontend and contract tests separately.

## Creator coin deployment on testnet

1. Audit and test the independent contracts. There is **no mainnet release approval**.
2. Deploy `LookeCoinFactory` on Ultra EVM Testnet using Foundry with the correct RPC and an operator-controlled test wallet. Do **not** put private keys in the repository.
3. Independently verify contract bytecode and transaction receipt on chain ID 18881.
4. Set `NEXT_PUBLIC_LOOKE_FACTORY_ADDRESS` to that **verified testnet address**, rebuild the app, and connect an EVM wallet.
5. Prepare a valid published JSON metadata URI. Preview the draft, review supply and confirm the wallet transaction.
6. Verify the `CoinCreated` event, token address and actual token supply before declaring success.

The creator receives all fixed-supply tokens at launch. **Trading does not automatically exist**: liquidity pools and swap infrastructure are future work.

## Ultra is two integration tracks

**Ultra EVM:** creator coins, EVM wallets and eventual liquidity. **Ultra native:** Uniq NFT minting, ownership, collections and listings. Native Uniq functionality requires dedicated integration with Ultra's native wallet and APIs, not an ERC-721 factory.

## License and credits

Looke code: MIT, copyright © 2026 Mushee Labs. A small upstream metadata-validation utility from Zora's **MIT-licensed** `@zoralabs/coins-sdk` is vendored under `vendor/zora/` with Zora's MIT license and credit.

**Do not copy the current Zora Coins smart contracts**: multiple active contracts use `ZORA-DELAYED-OSL-v1`, which restricts commercial/competing use pending their applicable open dates. See [licensing and roadmap](docs/LICENSING_AND_ROADMAP.md).


## M2 — authorized Ultra EVM Testnet deployment (in review)

M2 adds an explicit testnet-only factory deployment script, a read-only gas/network preflight,
independent deployment bytecode and transaction receipt verifiers, and an on-chain verified
coin creation flow. None of these steps has deployed a contract on its own.

**Operator workflow** (no automatic broadcast):

```bash
npm install
forge build
npm run m2:preflight
# No signing/broadcast: simulate first
forge script script/DeployLookeCoinFactory.s.sol:DeployLookeCoinFactory --rpc-url https://evm.test.ultra.eosusa.io
# To deploy only AFTER owner authorization: follow docs/M2_TESTNET_RUNBOOK.md
# Then manually provide deployment address and hash:
LOOKE_FACTORY_ADDRESS=0x... LOOKE_FACTORY_DEPLOY_TX=0x... npm run m2:verify-factory
# Only after verification set matching NEXT_PUBLIC_... variables in the web build.
# After wallet-approved launch, verify a real coin-creation transaction:
LOOKE_FACTORY_ADDRESS=0x... LOOKE_COIN_TX=0x... npm run m2:verify-coin
```

See **[M2 Testnet runbook](docs/M2_TESTNET_RUNBOOK.md)** for explicit signing approval,
receipt checks, environment requirements and acceptance criteria. The UI does not
enable token creation without a confirmed factory address **and its real deployment hash**.
Trading, liquidity, Uniq NFT marketplace and live social messaging are out of scope.

## M5 — creator profiles, public social feed and moderation

`/social` provides a distinct, wallet-signed Ultra EVM Testnet (18881)
social identity. The PostgreSQL-backed API implements real user profiles,
following, public posts, comments, token/Uniq references, search, blocking,
abuse reports, and audit-logged moderator controls.

- Sign-in is a **purpose-limited text signature** with a 5-minute
  single-use nonce, not a transaction, approval or token authorization.
- Sessions are hashed in Postgres and delivered in an HttpOnly
  SameSite=Strict cookie. Writes check same-origin and rate-limit actors.
- No fake posts, likes, follower counts, token holdings or sample conversations.
- The social backend fails closed without `DATABASE_URL`, and
  `LOOKE_SOCIAL_WRITES_ENABLED=false` **by default**.
- Private messaging is **not enabled**; encrypted-envelope table stubs
  await audited client-side encryption, key exchange and recovery.
- Public content links are not wallet-ownership attestations.

**Quick local setup (after reviewing the schema):**

```bash
npm install
# PostgreSQL connection is required; do not commit the credential
export DATABASE_URL=postgres://...
npm run db:migrate
export LOOKE_SOCIAL_APP_ORIGIN=http://localhost:3000
export LOOKE_SOCIAL_WRITES_ENABLED=true
npm run dev
# Visit http://localhost:3000/social
```

The GitHub Actions `social_db` job provisions a **disposable PostgreSQL
16** service for SQL integration tests; it does not touch production.
See [M5 social acceptance runbook](docs/M5_SOCIAL_ACCEPTANCE.md).
