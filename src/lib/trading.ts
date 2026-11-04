import {
  decodeEventLog, getAddress, isAddress, parseUnits, formatUnits, type Address,
  type Hash, type TransactionReceipt,
} from "viem";

export const ULTRA_TRADING_CHAIN_ID = 18881;
export const MAX_MARKETS = 8;
export const MAX_SLIPPAGE_BPS = 300;
export const QUOTE_MAX_AGE_MS = 25_000;

export type MarketConfig = {
  id: string;
  baseToken: Address;
  quoteToken: Address;
  pair: Address;
  router: Address;
  factory: Address;
};

export type MarketSnapshot = MarketConfig & {
  baseSymbol: string;
  quoteSymbol: string;
  baseDecimals: number;
  quoteDecimals: number;
  reserveBase: string;
  reserveQuote: string;
  blockNumber: string;
  poolPrice: string;
};

export type SwapQuote = {
  market: MarketConfig;
  direction: "buy" | "sell";
  inputToken: Address;
  outputToken: Address;
  inputSymbol: string;
  outputSymbol: string;
  inputDecimals: number;
  outputDecimals: number;
  inputAmount: string;
  amountIn: string;
  amountOut: string;
  minOut: string;
  minOutFormatted: string;
  quotedOutFormatted: string;
  quotedAt: number;
  slippageBps: number;
  blockNumber: string;
};

export type SwapActivity = {
  txHash: Hash;
  blockNumber: string;
  timestamp: number;
  price: string;
  quoteVolume: string;
  baseVolume: string;
  direction: "buy" | "sell";
};

export type Candle = {
  start: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  count: number;
};

export const erc20Abi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "event", name: "Transfer", anonymous: false,
    inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256" }] },
] as const;

export const v2FactoryAbi = [
  { type: "function", name: "getPair", stateMutability: "view", inputs: [{type:"address",name:"tokenA"},{type:"address",name:"tokenB"}], outputs: [{type:"address"}] },
] as const;

export const v2PairAbi = [
  { type:"function",name:"token0",stateMutability:"view",inputs:[],outputs:[{type:"address"}] },
  { type:"function",name:"token1",stateMutability:"view",inputs:[],outputs:[{type:"address"}] },
  { type:"function",name:"factory",stateMutability:"view",inputs:[],outputs:[{type:"address"}] },
  { type:"function",name:"getReserves",stateMutability:"view",inputs:[],outputs:[{name:"reserve0",type:"uint112"},{name:"reserve1",type:"uint112"},{name:"blockTimestampLast",type:"uint32"}] },
  { type:"event",name:"Swap",anonymous:false,inputs:[
    {name:"sender",type:"address",indexed:true},
    {name:"amount0In",type:"uint256"},{name:"amount1In",type:"uint256"},
    {name:"amount0Out",type:"uint256"},{name:"amount1Out",type:"uint256"},
    {name:"to",type:"address",indexed:true}] },
] as const;

export const v2RouterAbi = [
  { type:"function",name:"factory",stateMutability:"view",inputs:[],outputs:[{type:"address"}] },
  { type:"function",name:"getAmountsOut",stateMutability:"view",inputs:[{name:"amountIn",type:"uint256"},{name:"path",type:"address[]"}],outputs:[{type:"uint256[]"}] },
  { type:"function",name:"swapExactTokensForTokens",stateMutability:"nonpayable",
    inputs:[{name:"amountIn",type:"uint256"},{name:"amountOutMin",type:"uint256"},{name:"path",type:"address[]"},{name:"to",type:"address"},{name:"deadline",type:"uint256"}],
    outputs:[{type:"uint256[]"}] },
] as const;

function addr(v: unknown, field: string): Address {
  if (typeof v !== "string" || !isAddress(v) || /^0x0{40}$/i.test(v)) {
    throw new Error(`Invalid nonzero EVM address: ${field}`);
  }
  return getAddress(v);
}

export function marketConfig(value: unknown): MarketConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid market configuration.");
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(v.id)) throw new Error("Invalid market identifier.");
  const result: MarketConfig = {
    id: v.id,
    baseToken: addr(v.baseToken, "baseToken"), quoteToken: addr(v.quoteToken, "quoteToken"),
    pair: addr(v.pair, "pair"), router: addr(v.router, "router"), factory: addr(v.factory, "factory"),
  };
  if (result.baseToken === result.quoteToken) throw new Error("Base and quote tokens must be different.");
  if (new Set(Object.values(result).filter(x => typeof x === "string" && x.startsWith("0x")).map(x => x.toLowerCase())).size !== 5) {
    throw new Error("Markets must use five distinct contract addresses.");
  }
  return result;
}

export function parseMarketRegistry(raw: string | undefined): MarketConfig[] {
  if (!raw?.trim()) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > MAX_MARKETS) throw new Error("Expected at most 8 allowlisted markets.");
  const result = data.map(marketConfig);
  if (new Set(result.map(x => x.id)).size !== result.length) throw new Error("Duplicate market IDs.");
  return result;
}

export function validateSlippage(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SLIPPAGE_BPS) {
    throw new Error("Slippage must be between 1 and 300 basis points.");
  }
  return value;
}

export function exactAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 ||
      typeof value !== "string" || !/^(0|[1-9][0-9]{0,25})(\.[0-9]{1,18})?$/.test(value)) {
    throw new Error("Amount must be a positive decimal token amount (up to 18 places).");
  }
  if (value.split(".")[1]?.length && value.split(".")[1].length > decimals) throw new Error("Amount precision exceeds token decimals.");
  const amount = parseUnits(value, decimals);
  if (amount <= 0n || amount > (1n << 128n)) throw new Error("Amount out of supported range.");
  return amount;
}

export function minimumOutput(quotedAmount: bigint, slippageBps: number): bigint {
  validateSlippage(slippageBps);
  if (quotedAmount <= 0n) throw new Error("No executable output quote.");
  const result = quotedAmount * BigInt(10_000 - slippageBps) / 10_000n;
  if (result <= 0n) throw new Error("Slippage-adjusted output is zero.");
  return result;
}

export function reservePrice(base: bigint, quote: bigint, baseDecimals: number, quoteDecimals: number): string {
  if (base <= 0n || quote <= 0n) throw new Error("Pool has no real two-sided liquidity.");
  const a = Number(formatUnits(base, baseDecimals));
  const b = Number(formatUnits(quote, quoteDecimals));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || !Number.isFinite(b / a)) {
    throw new Error("Pool reserve ratio is outside supported chart range.");
  }
  return (b / a).toPrecision(12);
}

export type RawSwap = {
  amount0In: bigint; amount1In: bigint; amount0Out: bigint; amount1Out: bigint;
  txHash: Hash; blockNumber: bigint; timestamp: number;
};

export function deriveSwap(swap: RawSwap, baseIsToken0: boolean, baseDecimals: number, quoteDecimals: number): SwapActivity | null {
  const baseIn = baseIsToken0 ? swap.amount0In : swap.amount1In;
  const baseOut = baseIsToken0 ? swap.amount0Out : swap.amount1Out;
  const quoteIn = baseIsToken0 ? swap.amount1In : swap.amount0In;
  const quoteOut = baseIsToken0 ? swap.amount1Out : swap.amount0Out;
  // Exclude flash / multi-sided swaps from ordinary price candles to avoid mispricing.
  const buy = baseOut > 0n && quoteIn > 0n && baseIn === 0n && quoteOut === 0n;
  const sell = baseIn > 0n && quoteOut > 0n && baseOut === 0n && quoteIn === 0n;
  if (!buy && !sell) return null;
  const base = buy ? baseOut : baseIn;
  const quote = buy ? quoteIn : quoteOut;
  const amountBase = Number(formatUnits(base, baseDecimals));
  const amountQuote = Number(formatUnits(quote, quoteDecimals));
  if (amountBase <= 0 || amountQuote <= 0 || !Number.isFinite(amountBase) || !Number.isFinite(amountQuote)) return null;
  const price = amountQuote / amountBase;
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    txHash: swap.txHash, blockNumber: swap.blockNumber.toString(), timestamp: swap.timestamp,
    price: String(price), quoteVolume: String(amountQuote), baseVolume: String(amountBase),
    direction: buy ? "buy" : "sell",
  };
}

export function candlesFromSwaps(swaps: SwapActivity[], intervalSeconds: number): Candle[] {
  if (![300, 900, 3600].includes(intervalSeconds)) throw new Error("Unsupported candle interval.");
  const ordered = [...swaps].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    const left=BigInt(a.blockNumber),right=BigInt(b.blockNumber);
    return left<right?-1:left>right?1:0;
  });
  const map = new Map<number, Candle>();
  for (const swap of ordered) {
    const price = Number(swap.price), volume = Number(swap.quoteVolume);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(volume) || volume <= 0) continue;
    const start = Math.floor(swap.timestamp / intervalSeconds) * intervalSeconds;
    const previous = map.get(start);
    if (previous) {
      previous.high = Math.max(previous.high, price);
      previous.low = Math.min(previous.low, price);
      previous.close = price;
      previous.volume += volume;
      previous.count += 1;
    } else map.set(start, { start, open:price, high:price, low:price, close:price, volume, count:1 });
  }
  // Missing buckets are intentionally blank; never synthesize candles or volume.
  return Array.from(map.values()).sort((a,b) => a.start - b.start);
}

export function verifySwapReceipt(
  receipt: TransactionReceipt, market: MarketConfig, recipient: Address,
  outputToken: Address, minOut: bigint,
): { txHash: Hash; actualOut: bigint } {
  if (receipt.status !== "success") throw new Error("Swap transaction failed.");
  if (!receipt.to || getAddress(receipt.to) !== market.router) throw new Error("Receipt destination differs from the approved router.");
  if (getAddress(receipt.from) !== getAddress(recipient)) throw new Error("Receipt signer differs from the connected account.");
  let actualPairOut = 0n;
  let actualOut = 0n;
  const baseIsToken0 = market.baseToken.toLowerCase() < market.quoteToken.toLowerCase();
  const outputIsToken0 = outputToken === (baseIsToken0 ? market.baseToken : market.quoteToken);
  for (const log of receipt.logs) {
    if (getAddress(log.address) === market.pair) {
      try {
        const e = decodeEventLog({abi:v2PairAbi,eventName:"Swap",topics:log.topics,data:log.data,strict:true});
        if (e.eventName === "Swap") {
          const inputAmount = outputIsToken0 ? e.args.amount1In : e.args.amount0In;
          const outputAmount = outputIsToken0 ? e.args.amount0Out : e.args.amount1Out;
          if (inputAmount > 0n && outputAmount > 0n) actualPairOut += outputAmount;
        }
      } catch { /* unrelated pair log */ }
    }
    if (getAddress(log.address) === outputToken) {
      try {
        const e = decodeEventLog({abi:erc20Abi,eventName:"Transfer",topics:log.topics,data:log.data,strict:true});
        if (e.eventName === "Transfer" &&
            getAddress(e.args.from) === market.pair && getAddress(e.args.to) === getAddress(recipient)) actualOut += e.args.value;
      } catch { /* unrelated ERC20 log */ }
    }
  }
  if (actualPairOut < minOut || actualPairOut <= 0n) {
    throw new Error("Verified pair did not emit a directional Swap meeting the reviewed minimum.");
  }
  if (actualOut < minOut || actualOut <= 0n || actualOut !== actualPairOut) {
    throw new Error("Received token transfer does not match the directional pair output and reviewed minimum.");
  }
  return {txHash:receipt.transactionHash,actualOut};
}
