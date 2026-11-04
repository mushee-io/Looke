# Looke M11 — Genuine Ultra Testnet activation acceptance

**Engineering status (4 November 2026):** M10 PR #10 was squash-merged into main after verifying all six workflows on its final commit. M11 adds read-only verification tooling, **not automatic Testnet transactions**. The connected Vercel team still contains no Looke project and a renewed attempt to create a dedicated `looke-ultra-staging` with all-URL Vercel Authentication and disabled beta/execution flags received **403 Forbidden**. No protected Preview URL was deployed. Public beta remains CLOSED.

## How to run genuine acceptance (no wallet secrets)

```bash
npm install
npm run m7:preflight
npm run m11:acceptance
# report: artifacts/m11/acceptance.json
```

With no externally supplied public receipts this makes only read-only chain and DB/protection observations. The report lists all **16 required independent acceptance checks** with the actual verified/blocked status, never invents market activity or social accounts, and always reports `publicBetaOpen:false`.

After **real, separately user-approved Testnet transactions have been signed and broadcast by their owners**, create a local `public-testnet-receipts.json` file containing only these public identifiers (values below are illustrative and NOT evidence):

```json
{
  "evmFactory": {
    "address": "0xACTUAL_FACTORY_ADDRESS",
    "deploymentTx": "0xACTUAL_DEPLOY_TRANSACTION_HASH"
  },
  "creatorCoin": {
    "creationTx": "0xACTUAL_CREATOR_COIN_TRANSACTION_HASH"
  },
  "nativeUniq": {
    "factoryId": "ACTUAL_POSITIVE_DECIMAL_ID",
    "tokenId": "ACTUAL_POSITIVE_DECIMAL_ID",
    "owner": "actualnativeaccount"
  },
  "nativeMint": {
    "txHash": "ACTUAL_64_CHAR_NATIVE_TRANSACTION_ID_WITHOUT_0x",
    "owner": "actualnativeaccount",
    "factoryId": "ACTUAL_POSITIVE_DECIMAL_ID",
    "tokenId": "ACTUAL_POSITIVE_DECIMAL_ID"
  },
  "trades": [
    {
      "marketId": "ACTUAL_ALLOWLISTED_MARKET_ID",
      "direction": "buy",
      "txHash": "0xACTUAL_BUY_SWAP_TRANSACTION_HASH",
      "wallet": "0xACTUAL_TRADER_ADDRESS"
    },
    {
      "marketId": "ACTUAL_ALLOWLISTED_MARKET_ID",
      "direction": "sell",
      "txHash": "0xACTUAL_SELL_SWAP_TRANSACTION_HASH",
      "wallet": "0xACTUAL_TRADER_ADDRESS"
    }
  ]
}
```

```bash
npm run m11:acceptance -- ./public-testnet-receipts.json --strict
```

`--strict` returns a nonzero exit code while any real-world acceptance gate is blocked. An operator **must never** replace these fields with fabricated receipts, random addresses or synthetic market activity. Do not upload credentials, session cookies, wallet seed phrases or private keys.

## Exact verification behavior

### EVM creator-token
- `inspectEvmFactory` checks Ultra EVM Testnet chain ID 18881, successful creation receipt, exact deployed factory address, runtime code, real `coinCount()`, and at least two confirmations.
- `inspectEvmCoin` checks real successful `createCoin` receipt sent to the verified factory, exactly one `CoinCreated` event whose creator equals the **actual transaction signer**, deployed ERC20 bytecode, supply, balance, and metadata state.
- This is historical chain evidence. **It does not itself establish that a human expressly approved the transaction.** Wallet acceptance and independent review remain mandatory.

### EVM BUY and SELL
- Market must be in the operator's `LOOKE_M4_MARKETS_JSON` allowlist, with actual router/factory/pair code, corresponding token addresses, creator identity, and nonzero two-sided reserves independently observed on chain.
- Both genuine, different historical transaction hashes must exist for the **same market**, one BUY and one SELL.
- Exact transaction signer, router recipient, zero native value, real `swapExactTokensForTokens` calldata, input/output token path, positive amounts, non-expired deadline and original recipient are checked.
- Read the successful canonical transaction receipt with at least two confirmations, actual directional `Swap` event and matching ERC20 `Transfer` to the trader meeting the on-chain encoded minimum.
- Nothing calls `eth_sendTransaction`, `personal_sign`, approval, market-making, or an automated swap. A real trade is done separately in Looke's M4 wallet interface with **each user's explicit confirmation**, and its hash is supplied afterwards for verification.
- Real contract audits and independent authorization/wallet-witness records still remain separate.

### Native Uniq mint and ownership
- A history-capable Ultra native Testnet node must return an actual executed `eosio.nft.ft::issue.b` trace, at/before the latest irreversible block, matching the claimed recipient and factory ID.
- The separately fetched owner-scoped `token.b` row must exactly match the specified token and factory and have positive irreversible ledger evidence.
- **Limitation:** an `issue.b` action may issue multiple tokens and the history trace might not contain minted token IDs; M11 cannot guarantee exact attribution of one ID to the action without an independently reviewed native transaction trace/indexer. This remains a reviewer task.
- Some native RPC nodes do not expose `/v1/history/get_transaction`; such cases are **BLOCKED**, not substituted with fabricated history.
- Uniq minting/listing/buying require user wallet authorization in the native Uniq studio, not in M11.

### Social database and moderation
- M8's read-only Postgres audit checks real TLS, PostgreSQL 15+, required relations, indexes, and transaction read-only mode.
- M11 adds an actual database-role query: the staging app role must **not be PostgreSQL superuser** and must possess its required SELECT access. No user, session, post or private-message contents are exported.
- A disposable CI PostgreSQL superuser **does not prove staging readiness**. CI DB tests remain disposable.
- Provider backups, completed restore rehearsal, moderation and privacy policy require separately linked human review. M11 explicitly marks them not accepted without evidence.

### Protected staging and rollback
- Vercel must create `looke-ultra-staging` inside team `team_sUozs2OsaXlQcWcxyIjWzmRw`, linked to `mushee-io/looke`, with all-URL Vercel Authentication and **all four** beta/trading/social-write/evidence flags false.
- M10 protection verifier requires READY **Preview** deploy from correct project at the exact pinned Git SHA and a signed-out authentication challenge; it cannot be overridden by a self-reported link.
- No Vercel project/deployment could be created because project creation permission still returns `403 Forbidden`. A Vercel team administrator must grant proper project-creation access or create the project securely.
- `npm run m8:rollback-rehearsal` verifies only **in-memory** shutdown values; a real Vercel rollback and PostgreSQL backup restore require an authorized operator.
- `/api/ops/monitor` returns degraded/503 when real RPC or database dependencies fail. Review host monitoring separately once staging actually exists.

## Remaining real acceptance

- [ ] Authorized and protected Vercel staging deployed; signed-out access test
- [ ] Two real Testnet EVM wallet-approved factory/creator coin receipts verified
- [ ] Native Ultra Uniq `issue.b` trace and exact current owner/factory/token confirmed
- [ ] A real reviewed V2 liquidity pool (nonzero funded reserves) with contract security review
- [ ] Genuine wallet-confirmed BUY and SELL transactions, independent explorer receipts
- [ ] Real TLS-backed PostgreSQL staging role, moderation review, provider backup restore evidence
- [ ] Independent reviewer confirms native wallet control, EVM wallet signing and security approval
- [ ] Operator release approval and signed revision-bound authorization, all beta gates passed

**There is no permission to automatically mint, trade, fund pools, remove deployment protection or open public beta.**
