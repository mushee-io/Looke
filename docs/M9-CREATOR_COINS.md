# M9 — Creator coin launch preparation and testnet contract verification

M9's product goal is to let Looke creators design and eventually launch fixed-supply creator tokens on Ultra EVM. **This change implements a secure draft/review foundation, not public token issuance.** The existing Solidity `LookeCoinFactory` remains **unaudited and undeployed** on Ultra EVM testnet.

## Built in source

- `db/007_creator_coin_drafts.sql` creates a private **one-draft-per-signed-in-profile** table in Looke's dedicated Neon database, with supply, symbol and name constraints.
- `GET/PUT/DELETE /api/creator-coins/draft` requires an authenticated cookie session. Mutations additionally verify same-origin and bounded JSON, with normalized creator token parameters. Only the session's profile can read, modify or delete its draft. A public creator handle must be saved to create drafts.
- Token inputs: name 2–80 UTF-8 bytes with no control characters; symbol 2–12 uppercase ASCII letters/numbers; integer supply 1 to 1,000,000,000 whole tokens; pinned IPFS CID metadata URI, optionally ending in a safe relative path.
- Onchain `LookeCoinFactory.createCoin` uses **kind 0 (creator)** with all-zero `contentRef`. The factory permits only one creator coin per EVM sender and permanently mints the specified token supply to that same sender (18 decimals). There is no liquidity, buy/sell mechanism, creator revenue, auto-airdrop, or monetary value at this point.
- `GET /api/creator-coins/preflight` is **read-only**: derives the creator from the authenticated session, retrieves the private draft, reports 18881 testnet intent, checks an explicitly configured factory address, checks the RPC chain ID and code presence, and calls `coinFor(keccak256(abi.encode(creator,0,zeroRef)))` to detect an existing creator coin.
- An unknown bytecode's presence and a successful ABI read do **not** prove that the factory is official or audited. Preflight always sets `audited:false` and `issuanceEnabled:false` and never prepares a signed spend or broadcasts a transaction.
- The Profile page includes a non-custodial **Creator coin — launch preparation** lab with private draft saving, explicit draft deletion confirmation, real account address comparison, and a read-only chain status button.
- `tests/creator-coin.test.mjs` checks malformed token fields, supply bounds, IPFS metadata rules, and exact 18-decimal supply preview calculations.
- `tests/creator-coin-contract.test.mjs` compiles the current Solidity factory and deploys it in **an isolated Ganache EVM** under Ultra EVM's testnet chain ID 18881; checks minted total/balance, creator ownership, zero contentRef, duplicate creator coin prevention, wrong symbol/supply/metadata rejection, and distinct creators.
- No private keys, admin issuance keys, trading secrets or recipient overrides are stored by these APIs. Ganache accounts are throwaway local simulation accounts, not funded Ultra accounts.

## Database

Apply `db/007_creator_coin_drafts.sql` after `db/001_social.sql` in each authorized environment. The migration has been applied to Looke's **dedicated** isolated Neon staging project. Saving a draft never touches the chain, and the database is **not** a token registry or audit ledger.

## Release gates

1. Obtain protected HTTPS staging deployment rights for Looke. Current Mushee Vercel team permissions have returned HTTP 403 when creating a new project.
2. Validate private draft creation, edit, deletion and account isolation with two independent signed-in Ultra EVM testnet wallets; verify that a disconnected or wrong-account wallet cannot be used for future issuance.
3. Independently verify the factory source, compilation settings, known runtime bytecode and deployed address. Run fuzz tests, stateful invariants, adversarial testing and an **independent security audit** before public token issuance.
4. Pin and content-address genuine metadata JSON; implement immutable creator link attestations, name/trademark/impersonation protections and reporting. A social handle by itself cannot prove legal identity or authorization to launch another brand's token.
5. Obtain genuine signed testnet deployment and creator token transaction receipts with block/chain verification. Confirm creator token balance, one-per-creator rules and indexer parity with independently verified explorer results.
6. Implement transparent user opt-in, wallet preflight, transaction simulation, gas/fees and explicit review/acknowledgement. There is currently **no launch/mint transaction button**.
7. Define token economics, liquidity, fee sharing, tax/legal requirements, anti-spam and anti-bot policies before allowing trading or mainnet. Fixed-supply ERC-20 deployment alone does not create a functioning market.
8. Complete the production abuse/security review, monitoring, accessibility and separate M21 testnet audit signoff.

**M9 status: core planning and local EVM contract test source is built; true testnet issuance, audited creator token launch and public operation remain BLOCKED.**
