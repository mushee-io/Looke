export const MAX_TRADE_SLIPPAGE_BPS:number;
export const MAX_PRICE_IMPACT_BPS:number;
export function parseRawTradeAmount(raw:unknown):bigint;
export function checkedSlippageBps(raw:unknown):number;
export function checkedPoolFeeBps(raw:unknown):number;
export function simulateSwapExactIn(args:{amountIn:bigint;reserveIn:bigint;reserveOut:bigint;feeBps:number;slippageBps:number}):{
 expectedOut:string;minOut:string;priceImpactBps:number;feeEstimateInRaw:string;reserveIn:string;
 reserveOut:string;amountIn:string;feeBps:number;slippageBps:number;highImpact:boolean;executable:false;
};
export function isQuoteFresh(value:unknown,now?:number):boolean;
export function tradePreflightReadiness(args:{chainMatches:boolean;poolAllowlisted:boolean;codePresent:boolean;reservesPositive:boolean;quoteFresh:boolean;impactBps:number;walletBalanceEnough:boolean;hasRouterAudit:boolean}):{
 checks:Record<string,boolean>;passing:boolean;executionEnabled:false;
};
