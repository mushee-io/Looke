# Uniq holdings read-only integration

`GET /api/uniqs?wallet=ultraaccount` performs a restricted, server-side GraphQL query to Ultra's documented `uniqsOfWallet` endpoint, returning at most 20 records (name/owner/price). It never accepts caller GraphQL, is not a minting/listing service, and does not prove the caller owns the account. The UI displays queried public ownership data only.

Before enabling:
- Obtain API registration token and X-Client-ID (or approved backend credentials) from developers@ultra.io.
- Configure server-only `ULTRA_API_BEARER_TOKEN` and `ULTRA_API_CLIENT_ID`; don't prefix them with `NEXT_PUBLIC_`.
- Use `ULTRA_API_ENV=staging` for testnet and confirm the GraphQL field shape with your Ultra API credentials.
- Apply edge request limits / response cache; this initial proxy lacks a distributed rate limiter.
- For create/mint/buy/resale, implement and audit the appropriate native Ultra NFT contract actions, wallet authorization and receipt indexing separately.

Sources: https://developers.ultra.io/products/nft-api/queries and https://developers.ultra.io/products/nft-api/authentication.
