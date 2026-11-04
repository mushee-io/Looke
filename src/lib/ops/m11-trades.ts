/**
 * M11: verify historical, independently wallet-submitted Ultra EVM swaps.
 * Never requests an account, prepares an approval, signs or broadcasts.
 */
import {
  decodeFunctionData,getAddress,isAddress,type Address,type Hex,type Hash,
} from "viem";
import {createUltraPublicClient,assertConfirmations,assertHash,assertUltraTestnet} from "../verification";
import {ULTRA_EVM_TESTNET} from "../ultra";
import {parseMarketRegistry,verifySwapReceipt,v2PairAbi,v2RouterAbi,type MarketConfig} from "../trading";
import {probeUltraLiquidity} from "./m9-liquidity";

export type SwapDirection="buy"|"sell";
export type TradeSubmission={marketId:string;direction:SwapDirection;txHash:string;wallet:string};
export type VerifiedSwap={
  status:"verified";marketId:string;direction:SwapDirection;txHash:string;
  account:string;blockNumber:string;inputAmount:string;minimumOutput:string;
  actualOutput:string;router:string;pair:string;confirmations:number;
  source:"ultra-evm-testnet-chain";walletAuthorization:"historical-on-chain-sender-only";
};
const address=(s:string)=>getAddress(s).toLowerCase();
export function validateTradeSubmissions(input:unknown):TradeSubmission[]{
  if(!Array.isArray(input)||input.length!==2)throw new Error("M11 needs exactly one real BUY and one real SELL receipt.");
  const data=input.map((v:unknown)=>{
    if(!v||typeof v!=="object"||Array.isArray(v))throw new Error("Invalid trade evidence.");
    const o=v as Record<string,unknown>;
    if(typeof o.marketId!=="string"||!/^[a-z0-9][a-z0-9-]{0,31}$/.test(o.marketId)||
       (o.direction!=="buy"&&o.direction!=="sell")||
       typeof o.txHash!=="string"||!/^0x[0-9a-fA-F]{64}$/.test(o.txHash)||
       /^0x0{64}$/i.test(o.txHash)||
       typeof o.wallet!=="string"||!isAddress(o.wallet)||/^0x0{40}$/i.test(o.wallet))
       throw new Error("Provide actual Ultra EVM wallet, market, direction and nonzero transaction hash.");
    return {marketId:o.marketId,direction:o.direction as SwapDirection,txHash:o.txHash,wallet:getAddress(o.wallet)};
  });
  if(data[0].marketId!==data[1].marketId||
     data[0].direction===data[1].direction ||
     data[0].txHash.toLowerCase()===data[1].txHash.toLowerCase())
     throw new Error("Real BUY/SELL evidence must be distinct transactions for the same market.");
  return data;
}
export function validateOnChainSwapCall(params:{
  market:MarketConfig;direction:SwapDirection;wallet:string;
  from:Address;to:Address|null;value:bigint;input:Hex;blockTime:bigint;
}):{inputAmount:bigint;minOut:bigint;outputToken:Address}{
  const {market,direction,wallet,from,to,value,input,blockTime}=params;
  if(!to||address(to)!==address(market.router)||address(from)!==address(wallet)||
     value!==0n)throw new Error("Historical swap was not sent by the reviewed wallet to the expected router.");
  const decoded=decodeFunctionData({abi:v2RouterAbi,data:input});
  if(decoded.functionName!=="swapExactTokensForTokens")throw new Error("Transaction did not call the supported swap method.");
  const [amountIn,minOut,path,recipient,deadline]=decoded.args;
  if(amountIn<=0n||minOut<=0n||deadline<blockTime||path.length!==2||
     address(recipient)!==address(wallet))throw new Error("Swap calldata lacks positive amounts, wallet recipient or valid deadline.");
  const inputToken=direction==="buy"?market.quoteToken:market.baseToken;
  const outputToken=direction==="buy"?market.baseToken:market.quoteToken;
  if(address(path[0])!==address(inputToken)||address(path[1])!==address(outputToken))
    throw new Error("Swap path does not match claimed BUY or SELL market direction.");
  return {inputAmount:amountIn,minOut,outputToken};
}

export async function verifySubmittedSwap(proof:TradeSubmission):Promise<VerifiedSwap>{
  assertHash(proof.txHash);
  const market=parseMarketRegistry(process.env.LOOKE_M4_MARKETS_JSON)
    .find(m=>m.id===proof.marketId);
  if(!market)throw new Error("No real, operator-allowlisted market matches the receipt.");
  const poolProof=await probeUltraLiquidity();
  if(!poolProof.observations.some(o=>o.id===market.id&&o.status==="verified"))
    throw new Error("The on-chain V2 pool and its current real liquidity are unverified.");
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  await assertUltraTestnet(client);
  const hash=proof.txHash as Hash;
  const [tx,receipt]=await Promise.all([
    client.getTransaction({hash}),client.getTransactionReceipt({hash}),
  ]);
  const [block,latest,token0]=await Promise.all([
    client.getBlock({blockNumber:receipt.blockNumber}),client.getBlockNumber(),
    client.readContract({address:market.pair,abi:v2PairAbi,functionName:"token0"}),
  ]);
  if(receipt.transactionHash.toLowerCase()!==hash.toLowerCase()||
     receipt.blockHash.toLowerCase()!==block.hash?.toLowerCase()||
     tx.blockHash?.toLowerCase()!==block.hash?.toLowerCase())
    throw new Error("EVM swap does not match a canonical Ultra Testnet block.");
  const confirmations=assertConfirmations(receipt.blockNumber,latest);
  if(getAddress(token0)!==[market.baseToken,market.quoteToken].sort((a,b)=>
       a.toLowerCase().localeCompare(b.toLowerCase()))[0])
    throw new Error("Pair token order does not match the supported V2 event verifier.");
  const call=validateOnChainSwapCall({
    market,direction:proof.direction,wallet:proof.wallet,
    from:tx.from,to:tx.to,value:tx.value,input:tx.input,blockTime:block.timestamp,
  });
  const checked=verifySwapReceipt(receipt,market,getAddress(proof.wallet),
    call.outputToken,call.minOut);
  return {
    status:"verified",marketId:market.id,direction:proof.direction,txHash:checked.txHash,
    account:getAddress(proof.wallet),blockNumber:receipt.blockNumber.toString(),
    inputAmount:call.inputAmount.toString(),minimumOutput:call.minOut.toString(),
    actualOutput:checked.actualOut.toString(),router:market.router,pair:market.pair,
    confirmations,source:"ultra-evm-testnet-chain",
    walletAuthorization:"historical-on-chain-sender-only",
  };
}
