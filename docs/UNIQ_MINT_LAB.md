# Authorized native Uniq mint lab

Looke includes a **disabled-by-default**, opt-in testnet lab for an existing authorized Ultra Uniq factory (M14 partial). Enable only in private staging with `NEXT_PUBLIC_LOOKE_UNIQ_MINT_LAB=true`. This flag does NOT authorize public minting or a mainnet launch.

- The client uses Ultra's official `@ultraos/wallet-sdk` with `environment:testnet` and `provider:extension`.
- User must connect a matching native Ultra account, provide a valid existing factory ID and choose a maximum test UOS payment, then review the exact quantity (one), recipient and action.
- User explicitly acknowledges and clicks to sign `eosio.nft.ft::issue.b` with their native wallet; no signing credentials or private keys are stored. If not factory manager or authorized minter, contract rejects.
- `maximum_uos_payment` is capped at 10 test UOS, and the wallet must consent. Contract, factory and expected fees require independent preflight before public beta.
- Returned transaction hash links to the **native** Ultra testnet explorer; the UI does not treat broadcast as irreversibility/finality.
- No factory creation, production mint UI, marketplace listing, purchase or resale is implemented by this lab.
- Required next: metadata hashing/hosting, factory preflight, creator ownership validation, contract-authorized signer inspection, receipts/indexing, test transaction evidence and security review.

Official sources:
https://developers.ultra.io/blockchain/contracts/nft-contract/nft-actions/issue.b
https://developers.ultra.io/products/ultra-wallet-sdk/signing
https://explorer.testnet.ultra.io/
