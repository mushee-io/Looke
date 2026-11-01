import { quoteExactIn, minOutput } from "./quote.mjs";

const RAW=/^[1-9][0-9]{0,76}$/;
const UINT112_MAX=(1n<<112n)-1n;
const MAX_QUOTE_AGE_MS=15_000;
export const MAX_TRADE_SLIPPAGE_BPS=500;
export const MAX_PRICE_IMPACT_BPS=1_500;

export function parseRawTradeAmount(value) {
 if(typeof value!=="string"||!RAW.test(value))throw new RangeError("Invalid positive integer amount in token base units");
 const amount=BigInt(value);
 if(amount<=0n||amount>=(1n<<256n))throw new RangeError("Amount exceeds EVM uint256");
 return amount;
}
export function checkedSlippageBps(raw){
 const text=typeof raw==="number"?String(raw):raw;
 if(typeof text!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(text))throw new RangeError("Invalid slippage");
 const n=Number(text);
 if(n>MAX_TRADE_SLIPPAGE_BPS)throw new RangeError("Slippage must be 0–500 bps");
 return n;
}
export function checkedPoolFeeBps(raw) {
 if(typeof raw!=="string"||!/^(0|[1-9][0-9]{0,3})$/.test(raw))throw new RangeError("Invalid pool fee");
 const n=Number(raw);
 if(n>1_000)throw new RangeError("Pool fee must be 0–1000 bps");
 return n;
}
export function simulateSwapExactIn({amountIn,reserveIn,reserveOut,feeBps,slippageBps}){
 for(const v of [amountIn,reserveIn,reserveOut]) {
  if(typeof v!=="bigint"||v<=0n||v>UINT112_MAX)throw new RangeError("Invalid reserve or amount (uint112 maximum)");
 }
 if(!Number.isInteger(feeBps)||feeBps<0||feeBps>1000)throw new RangeError("Invalid fee");
 if(!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>MAX_TRADE_SLIPPAGE_BPS)
   throw new RangeError("Slippage must be 0–500 bps");
 const expected=quoteExactIn(amountIn,reserveIn,reserveOut,feeBps);
 const minOut=minOutput(expected,slippageBps);
 if(minOut<=0n)throw new RangeError("Minimum output rounds to zero");
 // No-fee AMM impact: 1 - reserveIn/(reserveIn+amountIn), ceiling bps.
 // Excludes the LP fee, token decimals, sandwich/MEV or price oracle divergence.
 const impactBps=Number((amountIn*10_000n+reserveIn+amountIn-1n)/(reserveIn+amountIn));
 const feeAmountIn=(amountIn*BigInt(feeBps)+9999n)/10_000n;
 return {
  expectedOut:expected.toString(), minOut:minOut.toString(),
  priceImpactBps:impactBps,
  feeEstimateInRaw:feeAmountIn.toString(),
  reserveIn:reserveIn.toString(),reserveOut:reserveOut.toString(),
  amountIn:amountIn.toString(),feeBps,slippageBps,
  highImpact:impactBps>MAX_PRICE_IMPACT_BPS,
  executable:false,
 };
}
export function isQuoteFresh(expiresAt,now=Date.now()){
 const date=Date.parse(expiresAt);
 return typeof expiresAt==="string"&&Number.isFinite(date)&&Number.isFinite(now)&&
   date>now&&date<=now+MAX_QUOTE_AGE_MS;
}
export function tradePreflightReadiness({chainMatches,poolAllowlisted,codePresent,
 reservesPositive,quoteFresh,impactBps,walletBalanceEnough,hasRouterAudit}){
 const checks={chainMatches:chainMatches===true,poolAllowlisted:poolAllowlisted===true,
   codePresent:codePresent===true,reservesPositive:reservesPositive===true,
   quoteFresh:quoteFresh===true,impactWithinReviewLimit:
     Number.isInteger(impactBps)&&impactBps>=0&&impactBps<=MAX_PRICE_IMPACT_BPS,
   walletBalanceEnough:walletBalanceEnough===true,routerAudited:hasRouterAudit===true};
 return {checks,passing:Object.values(checks).every(Boolean),executionEnabled:false};
}
