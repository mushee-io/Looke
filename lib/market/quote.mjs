/**
 * Conservative constant-product quote math for a prospective Ultra EVM AMM.
 * Pure math ONLY. Does not discover a deployed pool, confirm reserves or authorize trading.
 * All inputs and outputs are raw base-unit BigInts; UI must supply correct decimals.
 */
export function quoteExactIn(amountIn, reserveIn, reserveOut, feeBps) {
  for(const x of [amountIn,reserveIn,reserveOut]){
    if(typeof x!=="bigint"||x<=0n)throw new RangeError("Positive BigInt required");
  }
  if(!Number.isInteger(feeBps)||feeBps<0||feeBps>1000)throw new RangeError("Fee out of range");
  const feeScale=10000n;
  const effective=amountIn*BigInt(10000-feeBps);
  const output=(effective*reserveOut)/(reserveIn*feeScale+effective);
  if(output<=0n || output>=reserveOut)throw new RangeError("No executable output");
  return output;
}
export function minOutput(expectedOut, slippageBps) {
  if(typeof expectedOut!=="bigint"||expectedOut<=0n)throw new RangeError("Expected output must be positive");
  if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>2000)throw new RangeError("Slippage out of range");
  const minimum=expectedOut*BigInt(10000-slippageBps)/10000n;
  // Never emit a zero minimum: future swaps must not accept zero-output protection.
  if(minimum<=0n)throw new RangeError("Minimum output would be zero");
  return minimum;
}
