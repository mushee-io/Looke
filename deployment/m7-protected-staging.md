# M7 — Protected staging and real Testnet acceptance

## Current operational situation (4 Nov 2026)

- The M6 PR #6 passed the standard CI jobs plus the no-broadcast staging smoke job and has been merged into `main`.
- The connected Vercel team `mushee-ios-projects` (`team_sUozs2OsaXlQcWcxyIjWzmRw`) returned **no Looke projects** during inspection.
- An attempt to create a dedicated `looke-ultra-staging` project with **Vercel Authentication on all URLs** and public/trading/social-write/evidence flags `false` was **rejected with 403 Forbidden — permission to create the project was missing**.
- No protected staging deployment, public URL, web wallet signing, coin creation, NFT minting, liquidity, or production database setup resulted from this request. Do not claim they are live.

## Secure Vercel operator setup (requires sufficient project-create permission)

1. In the intended Vercel team, grant an authorized operator *project creation* permission or have an admin create the project directly. Never change teams to bypass a permission error.
2. Create a dedicated `looke-ultra-staging` Next.js project, linked to GitHub `mushee-io/looke`. Avoid attaching public production domains or modifying another Mushee project. Use a protected preview deployment, not a publicly accessible production deployment.
3. Configure **Deployment Protection > Vercel Authentication** on **all deployment URLs**, including production/deployment aliases if any. Verify the project API reflects `ssoProtection.deploymentType="all"` *before* deployment. Do not create or distribute shareable bypass URLs.
4. Configure environment variables for Preview and any other enabled target:
   ```text
   LOOKE_PUBLIC_BETA_ENABLED=false
   LOOKE_M4_TRADING_ENABLED=false
   LOOKE_SOCIAL_WRITES_ENABLED=false
   LOOKE_M6_EVIDENCE_ENABLED=false
   LOOKE_M4_MARKETS_JSON=[]
   ULTRA_EVM_RPC_URL=https://evm.test.ultra.eosusa.io
   ULTRA_NATIVE_TESTNET_RPC_URL=https://ultra-testnet.eosphere.io
   ```
5. Leave the Looke creator factory, coin, native Uniq, runtime bytecode hash, liquidity and review signatures **unset** until genuine chain proofs exist. Do not paste wallet keys or database credentials into ChatGPT or Git.
6. Deploy a verified, pinned Git commit from a preview branch only after protection is confirmed. Double-check deployment target is `preview`. Verify a signed-out visitor is challenged by Vercel Authentication rather than shown the app.
7. Once protected, run `/api/beta/health` and `/api/ops/monitor` with a team-authorized session; a **503 degraded** result is correct when PostgreSQL or RPC is missing. Confirm `/api/beta/readiness` says `publicBetaOpen: false`.
8. Make sure the staging project never automatically aliases to a mainnet/public domain and that all public, trading and social-write flags remain disabled until independently approved.

## M7 Testnet and wallet acceptance (read-only)

### Network tests
Use the live monitor API: `GET /api/ops/monitor`. It checks EVM chain ID **18881**, the timestamp of a real recent EVM head, the separate native Testnet chain ID and irreversible ledger lag, PostgreSQL social-table existence, and release flags. It emits only aggregate status; no DB URLs, session cookies, secrets or wallet identities.

### Browser wallet inspection
Open `/beta` on protected staging and explicitly click both wallet checks. Confirm EVM 18881 in the injected wallet and native Ultra **Testnet browser extension** account. These checks request account access, **not a signature or transaction**. Attach operator evidence to a real GitHub issue before asserting acceptance. Browser presence alone is **not** security signoff.

### On-chain independent proof
Create a local JSON file with public identifiers only (never a private key), shaped as follows:

```json
{
  "evmFactory": {
    "address": "0x<verified factory contract address>",
    "deploymentTx": "0x<verified actual deploy transaction hash>"
  },
  "creatorCoin": {
    "creationTx": "0x<verified real wallet-signed createCoin transaction hash>"
  },
  "nativeUniq": {
    "factoryId": "<actual native Uniq factory ID>",
    "tokenId": "<actual native Uniq token ID>",
    "owner": "<native Ultra Testnet account>"
  }
}
```

Values shown above are placeholders, **not accepted evidence**. After actual contract and NFT transactions have been independently authorized and performed by their own wallet owners, run:

```bash
npm install
npm run m7:preflight
npm run m7:acceptance -- ./testnet-public-proofs.json
```

This performs **read-only** chain checks using M6's verified factory/coin and native ownership readers. Any missing or failed receipt returns a nonzero exit code; do not set release approvals based on a shaped but nonexistent hash. Retain a real linked GitHub acceptance issue with receipts and results. M7 does not deploy the factory, create a coin, or mint a Uniq itself.

## Monitoring and rollback

- `/api/ops/monitor` returns 200 only when both chains are responding with consistent, fresh heads, the required social schema exists, and the staging release flags are closed. It returns 503 when any dependency is absent, stale, or unsafe.
- Configure alerts in the host's monitoring dashboard for repeated 503s and deployment errors. Keep health requests rate-limited by the host/edge to avoid load.
- `npm run m7:rollback-plan` prints a safe rollback manifest and manual instructions. It does **not** modify Vercel.
- To roll back in the Vercel UI: identify the scoped Looke staging project, keep Deployment Protection active, set all four flags to `false`, redeploy the last passing Git SHA after review, revoke compromised secrets if applicable, and rerun `/api/beta/readiness` and `/api/ops/monitor`. Never promote an unverified build.
- Keep previous deployment/DB backups, and rehearse restoring staging separately with human approval. A missing social DB must not be hidden by fake rows.
- No automatic market making, fake swaps, fake posts, or bulk test transactions are performed.

## Operator blockers before any beta or public release

- [ ] An authorized Vercel team operator creates and authenticates the dedicated protected Looke staging project (403 blocked this attempt)
- [ ] Protected staging URL exists and unauthenticated visitors cannot access it
- [ ] Ultra EVM and native Testnet RPCs return real fresh chain data, recorded by the monitor
- [ ] Real wallet-owned factory deployment and created coin proof exists (wallet owner explicitly signed)
- [ ] Real native Uniq ID/owner/factory proof exists (wallet owner explicitly signed previous mint)
- [ ] Verified testnet liquidity is supplied and audited by an authorized LP
- [ ] PostgreSQL database is configured and migrated; moderation and retention accepted
- [ ] Separate EVM and native wallet connect-only acceptance completed, evidence linked
- [ ] Independent security review and operations signoff completed
- [ ] Beta release is explicitly authorized by a fresh revision-bound operator wallet signature; `/api/beta/readiness` verifies every gate
- [ ] Vercel protection changes and public launch are independently approved (no automatic switch)

M7 engineering tests and acceptance tooling alone do not satisfy these real-world gates. **Public beta must remain closed.**
