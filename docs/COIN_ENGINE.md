# Looke social coin / market architecture

Prototype code, **not deployed or audited**:
- `contracts/LookeCoinFactory.sol` uses OpenZeppelin ERC-20 for fixed-supply tokens. On creation, all tokens go to the caller; liquidity, fees, trading and price discovery are **not** created or implied.
- Creator/content/trend types have an onchain type discriminator and optional content reference. The contract cannot prove the authenticity of an offchain post or creator; a verified identity/content attestation strategy is required before public launch.
- One creation per creator + kind + contentRef; creator coin uses a zero ref. Metadata requires an IPFS URI. Supply is capped and fixed at deployment.
- `lib/market/quote.mjs` tests hypothetical constant-product math only. It is not wired to a deployed AMM or wallets.

## Required before token issuance and trading
1. Confirm which Ultra EVM DEX/AMM protocols actually have deployed verified contracts, depth and audited routers. Do not assume Uniswap v4 from Zora/BASE exists on Ultra.
2. Verify exact token economics, liquidity seeding, creator fee split and treasury custody; ensure creators receive no duplicate claims over pooled assets.
3. Implement execution preflight: correct chain/address, router whitelist, gas and allowance checks, quote expiry, pool reserves, minOut, fee transparency and calldata simulation.
4. Test all contracts in an isolated EVM environment, fuzz invariants, perform independent audit, and deploy to Ultra EVM **testnet** with actual signer receipts.
5. Confirm event indexing, token metadata, anti-spam and content attestation, and controls for manipulated pricing, MEV and trading losses.
6. Only after testnet and independent review, consider a mainnet launch. Never enable irreversible spending by default.

The initial compiler check is a *syntax/ABI gate*, not proof of economic solvency, security or operational readiness.

## M9 creator coin launch preparation

The Profile page now has authenticated, account-scoped fixed-supply creator coin drafts (see `db/007_creator_coin_drafts.sql`). The read-only `/api/creator-coins/preflight` route retrieves the signed-in profile's EVM address, validates the saved draft and optionally reads a specifically configured testnet factory's chain, bytecode presence and `coinFor` mapping. The factory has **not** been audited or deployed on Ultra. The app does **not** expose a transaction signer, minting button or spend authorization. An isolated EVM runtime test suite evaluates factory uniqueness and supply behavior without claiming real chain deployment. See `docs/M9-CREATOR_COINS.md`.
