import "server-only";
import {
  createPublicClient, formatUnits, getAddress, http, isAddress, parseAbiItem,
  type Address, type Hash,
} from "viem";
import { ULTRA_EVM_TESTNET } from "./ultra";
import {
  ULTRA_TRADING_CHAIN_ID, candlesFromSwaps, deriveSwap, erc20Abi,
  exactAmount, marketConfig, minimumOutput, parseMarketRegistry,
  reservePrice, v2FactoryAbi, v2PairAbi, v2RouterAbi,
  type MarketConfig, type MarketSnapshot, type SwapQuote, type SwapActivity,
} from "./trading";

const rpc = process.env.ULTRA_EVM_RPC_URL?.trim() || ULTRA_EVM_TESTNET.rpcUrls[0];
export const ultraTradeClient = createPublicClient({transport:http(rpc,{timeout:20_000}),pollingInterval:2_000});
const swapEvent = parseAbiItem("event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)");

export function registeredMarkets(): MarketConfig[] {
  return parseMarketRegistry(process.env.LOOKE_M4_MARKETS_JSON);
}

export async function requireUltraRpc(): Promise<void> {
  const chain = await ultraTradeClient.getChainId();
  if(chain !== ULTRA_TRADING_CHAIN_ID) throw new Error(`Refusing non-Ultra-Testnet chain ${chain}; expected 18881.`);
}

function ensureAddress(a: string): Address {
  if (!isAddress(a) || /^0x0{40}$/i.test(a)) throw new Error("Invalid wallet address.");
  return getAddress(a);
}

async function existsOnChain(addresses: Address[]): Promise<void> {
  const bytecodes = await Promise.all(addresses.map(address => ultraTradeClient.getBytecode({address})));
  if (bytecodes.some(code => !code || code === "0x")) throw new Error("Verified market has missing on-chain contract code.");
}

export async function verifiedMarket(id: string): Promise<MarketSnapshot> {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) throw new Error("Invalid market ID.");
  const market = registeredMarkets().find(item => item.id === id);
  if (!market) throw new Error("Market not allowlisted by operator.");
  await requireUltraRpc();
  await existsOnChain([market.factory,market.router,market.pair,market.baseToken,market.quoteToken]);
  const [
    routerFactory, pairFactory, token0, token1, factoryPair,
    baseSymbol, baseDecimals, quoteSymbol, quoteDecimals, creator, reserves, blockNumber,
  ] = await Promise.all([
    ultraTradeClient.readContract({address:market.router,abi:v2RouterAbi,functionName:"factory"}),
    ultraTradeClient.readContract({address:market.pair,abi:v2PairAbi,functionName:"factory"}),
    ultraTradeClient.readContract({address:market.pair,abi:v2PairAbi,functionName:"token0"}),
    ultraTradeClient.readContract({address:market.pair,abi:v2PairAbi,functionName:"token1"}),
    ultraTradeClient.readContract({address:market.factory,abi:v2FactoryAbi,functionName:"getPair",args:[market.baseToken,market.quoteToken]}),
    ultraTradeClient.readContract({address:market.baseToken,abi:erc20Abi,functionName:"symbol"}),
    ultraTradeClient.readContract({address:market.baseToken,abi:erc20Abi,functionName:"decimals"}),
    ultraTradeClient.readContract({address:market.quoteToken,abi:erc20Abi,functionName:"symbol"}),
    ultraTradeClient.readContract({address:market.quoteToken,abi:erc20Abi,functionName:"decimals"}),
    ultraTradeClient.readContract({address:market.baseToken,abi:[{type:"function",name:"creator",inputs:[],outputs:[{type:"address"}],stateMutability:"view"}] as const,functionName:"creator"}),
    ultraTradeClient.readContract({address:market.pair,abi:v2PairAbi,functionName:"getReserves"}),
    ultraTradeClient.getBlockNumber(),
  ]);
  if (getAddress(routerFactory) !== market.factory || getAddress(pairFactory) !== market.factory ||
      getAddress(factoryPair) !== market.pair) throw new Error("Router/factory/pair provenance does not match the market manifest.");
  const sorted = [getAddress(token0),getAddress(token1)];
  if (sorted[0] === sorted[1] ||
      !sorted.includes(market.baseToken) || !sorted.includes(market.quoteToken)) {
    throw new Error("Pair token addresses do not match the allowlisted market.");
  }
  if (/^0x0{40}$/i.test(creator) || baseDecimals > 18 || quoteDecimals > 18) {
    throw new Error("Base token must expose a valid creator; token decimals must be 0–18.");
  }
  if (!/^[A-Za-z0-9_.-]{1,24}$/.test(baseSymbol) ||
      !/^[A-Za-z0-9_.-]{1,24}$/.test(quoteSymbol)) {
    throw new Error("Invalid token symbol in on-chain metadata.");
  }
  const [reserve0,reserve1] = reserves;
  const baseIsToken0 = getAddress(token0) === market.baseToken;
  const reserveBase = baseIsToken0 ? reserve0 : reserve1;
  const reserveQuote = baseIsToken0 ? reserve1 : reserve0;
  const poolPrice = reservePrice(reserveBase,reserveQuote,baseDecimals,quoteDecimals);
  return {
    ...market,baseSymbol,quoteSymbol,baseDecimals,quoteDecimals,
    reserveBase:formatUnits(reserveBase,baseDecimals),
    reserveQuote:formatUnits(reserveQuote,quoteDecimals),
    poolPrice,blockNumber:blockNumber.toString(),
  };
}

export async function activeMarkets(): Promise<{markets: MarketSnapshot[];errors: {id:string;reason:string}[]; executionEnabled:boolean}> {
  const registry = registeredMarkets();
  if (registry.length === 0) return {markets:[],errors:[],executionEnabled:false};
  const results = await Promise.allSettled(registry.map(item => verifiedMarket(item.id)));
  const markets:MarketSnapshot[] = [], errors:{id:string;reason:string}[]=[];
  for (let i=0;i<results.length;i++) {
    const result=results[i];
    if(result.status==="fulfilled")markets.push(result.value);
    else errors.push({id:registry[i].id,reason:result.reason instanceof Error?result.reason.message:"Market verification failed."});
  }
  return {markets,errors,executionEnabled:process.env.LOOKE_M4_TRADING_ENABLED==="true" && markets.length>0};
}

export async function quotedTrade(marketId:string,direction:"buy"|"sell",inputAmount:string,slippageBps:number):Promise<SwapQuote> {
  const snapshot=await verifiedMarket(marketId);
  const buy=direction==="buy";
  const inputToken=buy?snapshot.quoteToken:snapshot.baseToken;
  const outputToken=buy?snapshot.baseToken:snapshot.quoteToken;
  const inputDecimals=buy?snapshot.quoteDecimals:snapshot.baseDecimals;
  const outputDecimals=buy?snapshot.baseDecimals:snapshot.quoteDecimals;
  const amountIn=exactAmount(inputAmount,inputDecimals);
  const path=[inputToken,outputToken] as [Address,Address];
  const [amounts,block]=await Promise.all([
    ultraTradeClient.readContract({address:snapshot.router,abi:v2RouterAbi,functionName:"getAmountsOut",args:[amountIn,path]}),
    ultraTradeClient.getBlockNumber(),
  ]);
  if (amounts.length!==2 || amounts[0]!==amountIn || amounts[1]<=0n) throw new Error("Router returned a non-executable quote.");
  const minOut=minimumOutput(amounts[1],slippageBps);
  return {
    market:marketConfig(snapshot),direction,inputToken,outputToken,
    inputSymbol:buy?snapshot.quoteSymbol:snapshot.baseSymbol,
    outputSymbol:buy?snapshot.baseSymbol:snapshot.quoteSymbol,
    inputDecimals,outputDecimals,inputAmount,amountIn:amountIn.toString(),
    amountOut:amounts[1].toString(),minOut:minOut.toString(),
    minOutFormatted:formatUnits(minOut,outputDecimals),
    quotedOutFormatted:formatUnits(amounts[1],outputDecimals),
    quotedAt:Date.now(),slippageBps,blockNumber:block.toString(),
  };
}

export async function portfolio(marketId:string,account:string) {
  const market=await verifiedMarket(marketId);
  const owner=ensureAddress(account);
  const [base,quote,baseAllowance,quoteAllowance,block]=await Promise.all([
    ultraTradeClient.readContract({address:market.baseToken,abi:erc20Abi,functionName:"balanceOf",args:[owner]}),
    ultraTradeClient.readContract({address:market.quoteToken,abi:erc20Abi,functionName:"balanceOf",args:[owner]}),
    ultraTradeClient.readContract({address:market.baseToken,abi:erc20Abi,functionName:"allowance",args:[owner,market.router]}),
    ultraTradeClient.readContract({address:market.quoteToken,abi:erc20Abi,functionName:"allowance",args:[owner,market.router]}),
    ultraTradeClient.getBlockNumber(),
  ]);
  return {
    account:owner, market:market.id, blockNumber:block.toString(),
    base:{symbol:market.baseSymbol,balance:formatUnits(base,market.baseDecimals),allowance:baseAllowance.toString()},
    quote:{symbol:market.quoteSymbol,balance:formatUnits(quote,market.quoteDecimals),allowance:quoteAllowance.toString()},
  };
}

export async function recentSwaps(marketId:string, intervalSeconds:number) {
  const market=await verifiedMarket(marketId);
  if(![300,900,3600].includes(intervalSeconds))throw new Error("Unsupported interval.");
  const latest=BigInt(market.blockNumber);
  const lookback=3600n;
  const from=latest>=lookback?latest-lookback+1n:0n;
  const logs:Awaited<ReturnType<typeof ultraTradeClient.getLogs<typeof swapEvent>>> = [];
  // 6 bounded queries of at most 600 blocks; no unbounded explorer/history crawl.
  for(let start=from;start<=latest;start+=600n){
    const end=start+599n>latest?latest:start+599n;
    const part=await ultraTradeClient.getLogs({address:market.pair,event:swapEvent,fromBlock:start,toBlock:end});
    logs.push(...part);
    if(logs.length>500)break;
  }
  // No sampled trades are ever invented. If network history exceeds caps, explicitly mark partial.
  const truncated=logs.length>80 || logs.length>500;
  const selected=logs.slice(-80);
  const blocks=[...new Set(selected.map(x=>x.blockNumber?.toString()).filter((x):x is string=>Boolean(x)))];
  const ts=new Map<string,number>();
  for(let index=0;index<blocks.length;index+=8){
    const batch=blocks.slice(index,index+8);
    const records=await Promise.all(batch.map(x=>ultraTradeClient.getBlock({blockNumber:BigInt(x)})));
    records.forEach((block,i)=>ts.set(batch[i],Number(block.timestamp)));
  }
  const baseIsToken0=market.baseToken.toLowerCase() < market.quoteToken.toLowerCase();
  const activities:SwapActivity[]=[];
  for(const log of selected){
    if(!log.transactionHash||log.blockNumber===null)continue;
    const timestamp=ts.get(log.blockNumber.toString());
    if(timestamp===undefined)continue;
    const activity=deriveSwap({
      amount0In:log.args.amount0In ?? 0n,amount1In:log.args.amount1In ?? 0n,
      amount0Out:log.args.amount0Out ?? 0n,amount1Out:log.args.amount1Out ?? 0n,
      txHash:log.transactionHash,blockNumber:log.blockNumber,timestamp,
    },baseIsToken0,market.baseDecimals,market.quoteDecimals);
    if(activity)activities.push(activity);
  }
  const candles=candlesFromSwaps(activities,intervalSeconds);
  return {
    market:market.id, fromBlock:from.toString(),throughBlock:latest.toString(),
    observedSwapCount:activities.length,
    // This is observed quote-token volume in the scanned / potentially truncated set, NOT whole-market daily volume.
    observedQuoteVolume:activities.reduce((sum,v)=>sum+Number(v.quoteVolume),0).toString(),
    partial:truncated,
    candles,swaps:activities.slice(-20).reverse(),
    notice:"Only genuine pair Swap logs from the bounded recent Testnet block range are displayed. No trades means no candles.",
  };
}
