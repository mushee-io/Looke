# M4 — Ultra wallet integration: verification plan

Looke uses **two distinct Ultra testnet wallet environments**: EIP-1193 Ultra EVM (18881), and the native Ultra Wallet extension with chain ID `7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9`. Wallet connections do not authorize spending.

## Implemented source

- EVM connections validate the selected address and chain again after the user authorizes access; a mismatch requires reconnection. The login workflow checks account/chain before and after signing the login-only message.
- Native Ultra Wallet SDK uses extension-only testnet mode, checks `getChainId()` independently of the returned `blockchainid` account name, and checks selected account consistency.
- Page-level monitor subscribes to account, chain and disconnect events and checks identity again on focus or tab return, even when the connection dialog is closed.
- Explicit EVM 'forget' and native `disconnect()` actions; they do not silently revoke the user's separate Looke web session.
- Read-only `GET /api/native-network` checks the native RPC `get_info` chain identity and head block before reporting online.
- Validation functions have Node regression tests.

## Acceptance tests still required

- [ ] Connect real EIP-1193 wallet on Ultra EVM testnet 18881, verify rejection of a wrong network, user-requested switch and manual reconnection.
- [ ] Connect native Ultra extension account on native testnet, verify chain and account, reject a mainnet connection.
- [ ] Switch EVM accounts/networks and native accounts/networks while the modal is closed, and ensure stale identities are cleared.
- [ ] Test native `disconnect()` trust revocation and EVM local forget separately from the signed-in Looke social session.
- [ ] Test locked, missing and rejecting wallets; real RPC timeouts; browser and mobile UX.
- [ ] Verify no financial transaction, token approval or unsolicited signing popup is triggered by passive monitoring.
- [ ] Run a protected HTTPS staging session on actual browser wallets and capture independent verification evidence; obtain security review.

The code is **not evidence of deployed wallet support**. The protected Vercel staging deployment remains blocked by team permissions; M4 cannot be marked accepted until real wallet/device verification.

Official docs:
- https://developers.ultra.io/tutorials/Ultra-EVM/Resources
- https://developers.ultra.io/products/ultra-wallet-sdk/getting-started
- https://developers.ultra.io/products/ultra-wallet-sdk/connecting
- https://developers.ultra.io/products/ultra-wallet-sdk/accounts-and-networks
- https://developers.ultra.io/products/ultra-wallet-sdk/events
