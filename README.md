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


## M4 — Verified Ultra EVM Testnet creator-token trading terminal

The `/trade` terminal is an integration for **real, operator-allowlisted V2-compatible Ultra EVM Testnet (chain 18881) pools**. It checks:
- router, factory, pair and ERC20 token code on the actual chain
- `router.factory()`, `pair.factory()`, `factory.getPair()`, `pair.token0/token1`, token creator, and positive real reserves
- real `getAmountsOut()` swap quotes with fixed-chain wallet signing, exact token approvals, bounded slippage (max 3%) and 5-minute deadlines
- real confirmed receipt, pair Swap event and actual ERC20 token Transfer to the wallet
- genuine pair Swap logs to construct trade candles, observed volume and explorer transaction links
- real on-chain balances in the portfolio view

**By default the market registry is empty and execution is disabled.** No funded Ultra EVM V2-compatible router/pair deployment is claimed. Without actual separately authorized liquidity and reviewed addresses, the terminal shows no market and **cannot buy or sell**. It does not fabricate orders, trades, prices or volume. No contract, transaction, or liquidity provisioning has been performed by M4 engineering work.

See [M4 trading testnet runbook](docs/M4_ULTRA_EVM_TRADING_RUNBOOK.md) and `.env.example` for configuration and acceptance steps.

## M3 — native Uniq collections and resale (in review)

The new [Uniq Studio](src/app/uniqs/page.tsx) at `/uniqs` is distinct from
Ultra EVM and includes: native Testnet extension wallet connect, direct
chain-table reads for owned `token.b` Uniqs, `factory.b` collections
and `resale.a` listings, and reviewed action builders for `create.b`,
`issue.b`, `resell`, `cancelresell` and `buy`. These actions are
never signed/broadcast without a user action and wallet approval.

The publicly documented Ultra NFT GraphQL API requires a `client_id`,
so M3 uses the chain's public Testnet RPC via a read-only server route.
M3 does not scrape arbitrary image metadata or invent creator content.
A wallet broadcast hash is *not* claimed as final: listing/buy/mint results
are checked against native Testnet's last irreversible block and relevant
chain-table state. New factory IDs require separate attribution/proof.
No real wallet transactions have been executed by this milestone.

See [M3 Testnet acceptance runbook](docs/M3_NATIVE_UNIQ_RUNBOOK.md) for
prerequisites, Testnet/extension support and operator test cases.
