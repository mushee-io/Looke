# Read-only testnet pool preflight

`GET /api/quote?pool=0x...&tokenIn=0x...&amountIn=<base-unit-raw-number>&slippageBps=50`

- Only explicitly pre-verified addresses in the server-side `LOOKE_ALLOWED_TESTNET_POOLS` comma-separated list can be queried; an unconfigured system returns 503.
- Rejects chain mismatch (must be Ultra EVM testnet 18881), absent code, unapproved token, zero reserves, dust swaps and unsafe slippage/fee parameters.
- Uses a minimal UniswapV2-compatible pool interface `getReserves`, `token0`, `token1`. This MUST NOT be assumed to exist or be secure on Ultra without real factory/pair deployment evidence.
- Reads reserves at one observed block and returns raw-unit expectedOut, minOut and a 15-second expiration. No token decimal, price, liquidity valuation or execution claim is inferred.
- Does **not** send transactions, generate executable calldata, request allowance, estimate gas, guarantee quote validity, or protect against MEV/reorgs.
- Default hypothetical 30 bps pool fee is configurable ONLY after verifying the actual pool implementation; return values are invalid if the true fee differs.
- Before live trades, audit router/pool code, verify factory and code hashes, check ERC20 approvals and gas, signed quote expiration, wallet consent, transaction receipts and actual-liquidity solvency.

The buy/sell interface remains closed and explicitly displays that swaps are not enabled.
