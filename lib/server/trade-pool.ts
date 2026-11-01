import "server-only";
import {getAddress,isAddress,parseAbi,zeroAddress} from "viem";
import {ultraClient} from "@/lib/server/evm";
import {ULTRA_EVM_TESTNET} from "@/lib/ultra";
import {parseRawTradeAmount,checkedSlippageBps,checkedPoolFeeBps,simulateSwapExactIn} from "@/lib/market/trade-guard.mjs";

const POOL_ABI=parseAbi([
 "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
 "function token0() view returns (address)",
 "function token1() view returns (address)"
]);
const ERC20_ABI=parseAbi([
 "function decimals() view returns (uint8)",
 "function symbol() view returns (string)",
 "function balanceOf(address owner) view returns (uint256)"
]);
const UINT32=2n**32n;
export class TradeReadError extends Error{
 constructor(message:string,public status:number=422){super(message);}
}
export function configuredPools() {
 const values=(process.env.LOOKE_ALLOWED_TESTNET_POOLS??"").split(",").map(s=>s.trim()).filter(Boolean);
 // A configured address is not, on its own, proof that an exchange is safe.
 if(values.length>10)throw new TradeReadError("Too many configured testnet pools",503);
 if(values.some(s=>!isAddress(s)))throw new TradeReadError("Unrecognized pool in server allowlist",503);
 return Array.from(new Set(values.map(s=>getAddress(s).toLowerCase())));
}
export async function readPoolQuote(input:{pool:string;tokenIn:string;amountIn:string;slippageBps:string}) {
 const pools=configuredPools();
 if(!pools.length)throw new TradeReadError("No operator-approved Ultra EVM testnet pools configured",503);
 if(!isAddress(input.pool)||!isAddress(input.tokenIn)||!pools.includes(input.pool.toLowerCase()))
  throw new TradeReadError("Invalid or unapproved pool or input token",400);
 let amount:bigint,slippage:number,fee:number;
 try{
  amount=parseRawTradeAmount(input.amountIn);
  slippage=checkedSlippageBps(input.slippageBps);
  const rawFee=process.env.LOOKE_POOL_FEE_BPS;
  if(rawFee===undefined||rawFee==="")throw Error("Missing verified fee config");
  fee=checkedPoolFeeBps(rawFee);
 }catch {throw new TradeReadError("Invalid amount/slippage or missing pool fee configuration",400);}
 if(await ultraClient.getChainId()!==ULTRA_EVM_TESTNET.chainId)
  throw new TradeReadError("Ultra EVM RPC is on the wrong chain",503);
 const pool=getAddress(input.pool),tokenIn=getAddress(input.tokenIn);
 // Pin all reads to the same chain block to avoid mixed-state quotes.
 const blockNumber=await ultraClient.getBlockNumber();
 const [bytecode,block,token0,token1,reserves]=await Promise.all([
  ultraClient.getCode({address:pool,blockNumber}),
  ultraClient.getBlock({blockNumber}),
  ultraClient.readContract({address:pool,abi:POOL_ABI,functionName:"token0",blockNumber}),
  ultraClient.readContract({address:pool,abi:POOL_ABI,functionName:"token1",blockNumber}),
  ultraClient.readContract({address:pool,abi:POOL_ABI,functionName:"getReserves",blockNumber})
 ]);
 if(!bytecode||bytecode==="0x")throw new TradeReadError("No deployed pool code at allowlisted address");
 if(token0===zeroAddress||token1===zeroAddress||token0.toLowerCase()===token1.toLowerCase())
  throw new TradeReadError("Invalid pool token contracts");
 if(tokenIn.toLowerCase()!==token0.toLowerCase()&&tokenIn.toLowerCase()!==token1.toLowerCase())
  throw new TradeReadError("Input token does not belong to selected pool",400);
 const zeroIn=tokenIn.toLowerCase()===token0.toLowerCase();
 const tokenOut=zeroIn?token1:token0;
 const reserveIn=zeroIn?reserves[0]:reserves[1];
 const reserveOut=zeroIn?reserves[1]:reserves[0];
 const ageSeconds=Number(((block.timestamp%UINT32)-BigInt(reserves[2])+UINT32)%UINT32);
 if(ageSeconds>3600)throw new TradeReadError("Last pool reserve update is older than one hour; no fresh quote available");
 let result;
 try{result=simulateSwapExactIn({amountIn:amount,reserveIn,reserveOut,feeBps:fee,slippageBps:slippage});}
 catch{throw new TradeReadError("Insufficient liquidity or amount outside safe simulation bounds");}
 const [inDecimals,outDecimals,inSymbol,outSymbol]=await Promise.all([
  ultraClient.readContract({address:tokenIn,abi:ERC20_ABI,functionName:"decimals",blockNumber}),
  ultraClient.readContract({address:tokenOut,abi:ERC20_ABI,functionName:"decimals",blockNumber}),
  ultraClient.readContract({address:tokenIn,abi:ERC20_ABI,functionName:"symbol",blockNumber}),
  ultraClient.readContract({address:tokenOut,abi:ERC20_ABI,functionName:"symbol",blockNumber})
 ]);
 if(inDecimals>36||outDecimals>36||inSymbol.length>32||outSymbol.length>32)
  throw new TradeReadError("Unsupported token decimals or metadata");
 return {
  ...result,network:"Ultra EVM Testnet",chainId:ULTRA_EVM_TESTNET.chainId,
  pool,tokenIn,tokenOut,inputDecimals:inDecimals,outputDecimals:outDecimals,
  inputSymbol:inSymbol,outputSymbol:outSymbol,observedBlock:blockNumber.toString(),
  reserveAgeSeconds:ageSeconds,
  expiresAt:new Date(Date.now()+15_000).toISOString(),
  allowanceStatus:"no_independently_audited_router",
  gasEstimateStatus:"no_audited_swap_path",
  tradeEnabled:false,executable:false,
  verification:"Pool is operator-configured and has V2-compatible read methods. Source provenance, router safety and reserve pricing remain unverified.",
  warning:"Read-only estimate. Not an executable offer, price guarantee, liquidity audit or investment recommendation."
 };
}
export async function readWalletPreflight(wallet:string,tokenIn:string,blockNumber:string,amountIn:string) {
 if(!isAddress(wallet))throw new TradeReadError("Invalid wallet address",400);
 const account=getAddress(wallet),token=getAddress(tokenIn),block=BigInt(blockNumber);
 const [tokenBalance,uosBalance]=await Promise.all([
  ultraClient.readContract({address:token,abi:ERC20_ABI,functionName:"balanceOf",args:[account],blockNumber:block}),
  ultraClient.getBalance({address:account,blockNumber:block})
 ]);
 return {
  wallet:account,
  tokenBalanceRaw:tokenBalance.toString(),uosBalanceWei:uosBalance.toString(),
  tokenBalanceEnough:tokenBalance>=BigInt(amountIn),
  gasBalanceKnown:uosBalance>0n,
  // Without an audited router and simulation the gas *requirement* is unknown.
  gasEnough:"unknown_no_router",allowanceEnough:"unknown_no_audited_spender",
  walletOwnershipVerified:false,transactionSimulationPassed:false,
 };
}
