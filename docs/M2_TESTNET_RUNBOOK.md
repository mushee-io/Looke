# M2 — Ultra EVM Testnet creator-coin execution runbook

**Current state:** Implementation and automated tests only. No Looke factory has been deployed by this PR. **Do not publish an address or say creator launches are live until steps below are genuinely verified.** No automated transaction broadcast occurs in GitHub Actions.

Official Ultra EVM resources:
- RPC: https://evm.test.ultra.eosusa.io
- Chain ID: `18881` (`0x49c1`)
- Explorer: https://evmexplorer.testnet.ultra.io
- See: https://developers.ultra.io/tutorials/Ultra-EVM/Resources

## 1. Prepare a funded, authorized signer

Use a throwaway Testnet EVM wallet that YOU control and fund with test UOS for gas. Never paste private keys or seed phrases into GitHub, chat, scripts, CI, or `.env`. An operator may use a hardware wallet supported by Foundry or an encrypted local Foundry keystore.

Import an **existing, operator-controlled Testnet-only key locally**, when needed, using `cast wallet import looke-ultra-testnet --interactive`. This command is local and not part of automated CI; an encrypted keystore is prompted for a password when signing.

```bash
npm install
forge build
cp .env.example .env.local
# inspect environment values; do not put secret keys here
ULTRA_EVM_RPC_URL=https://evm.test.ultra.eosusa.io LOOKE_DEPLOYER_ADDRESS=0xYOUR_PUBLIC_ADDRESS npm run m2:preflight
```

The preflight validates chain 18881 and checks the deployer's publicly visible UOS balance. It is **read-only**.

## 2. Simulate first (no signing/broadcast)

```bash
forge script script/DeployLookeCoinFactory.s.sol:DeployLookeCoinFactory \
  --rpc-url https://evm.test.ultra.eosusa.io
```

The script refuses to run on any chain other than `18881`. No `--broadcast` means simulation only. Check the compiler output, constructor trace and expected gas cost before proceeding.

## 3. Optional deployment: manual authorization only

**Do not execute this step automatically.** After the operator personally reviews the simulation and authorizes the wallet signature:

```bash
forge script script/DeployLookeCoinFactory.s.sol:DeployLookeCoinFactory \
  --rpc-url https://evm.test.ultra.eosusa.io \
  --account looke-ultra-testnet \
  --broadcast
```

Foundry requests the locally managed signing credential. Hardware-wallet signer options are supported by Foundry, when configured. GitHub Actions NEVER passes `--broadcast`. Record the transaction hash and deployment address returned by the wallet/provider, and cross-check against the Ultra Testnet explorer.

If the operator does not approve the signature, stop. **Nothing should be deployed.**

## 4. Verify actual factory code and receipt

```bash
forge build
LOOKE_FACTORY_ADDRESS=0xYOUR_DEPLOYED_FACTORY \
LOOKE_FACTORY_DEPLOY_TX=0xYOUR_REAL_DEPLOY_TX \
npm run m2:verify-factory
```

This checks: the RPC is chain 18881, deployment receipt succeeded and was a contract-creation transaction, receipt address matches the supplied factory, at least **two confirmations** exist, deployed code is present, `coinCount()` works, and the on-chain runtime code hash matches the **locally compiled** `LookeCoinFactory` artifact. A simulated hash will NOT pass.

Do not assume block explorers constitute an audit. Verify artifacts were compiled from the reviewed source.

## 5. Activate the frontend only after verification

Set the two public **frontend build-time** environment variables:

```bash
NEXT_PUBLIC_LOOKE_FACTORY_ADDRESS=0xYOUR_DEPLOYED_FACTORY
NEXT_PUBLIC_LOOKE_FACTORY_DEPLOY_TX=0xYOUR_REAL_DEPLOY_TX
```

Rebuild the site and test with an injected EVM wallet on **Ultra EVM Testnet 18881**. At runtime the frontend independently checks the deployment receipt, code presence and `coinCount()` before enabling a transaction. The build is deliberately disabled if either variable is absent or invalid.

Frontend verification is a sanity check, **not a substitute** for the stricter CLI bytecode comparison or a security review.

## 6. Create one small test coin and verify

Prepare hosted JSON metadata (the form does not upload or fetch metadata automatically). Connect an EVM wallet, review name, symbol, metadata URI and supply, then approve the `createCoin` transaction **in the wallet**. The frontend displays the transaction as **submitted** until two confirmations, the expected factory event, and token contract state have been verified. Failures or timeouts do not turn into successful trades.

Independently verify the on-chain result with:

```bash
LOOKE_FACTORY_ADDRESS=0xYOUR_DEPLOYED_FACTORY \
LOOKE_COIN_TX=0xYOUR_REAL_CREATION_TX \
npm run m2:verify-coin
```

For strict acceptance, also set `LOOKE_EXPECTED_CREATOR`, `LOOKE_EXPECTED_NAME`, `LOOKE_EXPECTED_SYMBOL`, `LOOKE_EXPECTED_METADATA_URI`, and `LOOKE_EXPECTED_SUPPLY_WEI` together. The script asserts chain ID, receipt success, two confirmations, matching factory event, creator identity, deployed token code, fixed total supply, creator balance and URI.

## Release gates

- [ ] Authorized wallet, real test UOS balance, preflight passed
- [ ] Simulation reviewed and gas cost accepted
- [ ] Owner explicitly signs testnet factory deployment
- [ ] Factory address, hash and bytecode independently verified
- [ ] Frontend configured with verified address **and** deployment hash
- [ ] A wallet signs a real small creator-coin transaction
- [ ] Event, code, creator balance and supply verified on chain
- [ ] Security review before wider public beta

**Out of scope:** liquidity pools, token buy/sell, artificial volume, live Uniq minting, native Ultra social messaging and mainnet. No trading or deployment is claimed by M2 code alone.
