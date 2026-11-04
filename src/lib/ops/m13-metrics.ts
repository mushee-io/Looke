import {getAddress,type Address} from "viem";
import {lookeCoinAbi} from "../coin-abi";
import {erc20Abi,reservePrice,type MarketSnapshot} from "../trading";
import {ultraTradeClient,requireUltraRpc} from "../trading-server";
import type {CreatorLaunch} from "./m13-index";

import {exactHolderCount,verifiedQuoteMarketCap,verifiedPriceChange,validateHolderScan,
  type TransferProof,type VerifiedMarketMetrics} from "./m13-metrics-pure";
const MAX_TRANSFER_EVENTS=2500;
export async function exactOnChainHolders(
  token:Address,launchBlock:bigint,finalized:bigint,
):Promise<number|null>{
  if(!validateHolderScan(launchBlock,finalized))return null;
  const collected:TransferProof[]=[];
  const event=erc20Abi[5];
  try{
    for(let from=launchBlock;from<=finalized;from+=300n){
      const end=from+299n>finalized?finalized:from+299n;
      const logs=await ultraTradeClient.getLogs({address:token,event,fromBlock:from,toBlock:end});
      if(collected.length+logs.length>MAX_TRANSFER_EVENTS)return null;
      for(const l of logs){
        if(!l.args.from||!l.args.to||l.args.value===undefined)return null;
        collected.push({from:getAddress(l.args.from),to:getAddress(l.args.to),value:l.args.value});
      }
    }
    const supply=await ultraTradeClient.readContract({
      address:token,abi:lookeCoinAbi,functionName:"totalSupply",blockNumber:finalized,
    });
    return exactHolderCount(collected,supply);
  }catch{return null;}
}
/** Binary search a real canonical timestamp; archive-unavailable => null, never estimate. */
export async function findBlockAtTime(
 finalized:bigint,target:number,limit=32,
):Promise<bigint|null>{
  if(finalized<=0n||!Number.isFinite(target))return null;
  let low=0n,high=finalized,answer:bigint|null=null;
  let count=0;
  while(low<=high&&count<limit){
    count++;const mid=(low+high)/2n;
    const b=await ultraTradeClient.getBlock({blockNumber:mid});
    const observed=Number(b.timestamp);
    if(observed<=target){answer=mid;low=mid+1n;}else high=mid-1n;
  }
  if(low<=high||answer===null)return null;
  const b=await ultraTradeClient.getBlock({blockNumber:answer});
  if(Math.abs(Number(b.timestamp)-target)>600)return null;
  return answer;
}
export async function metricsForVerifiedMarket(
 market:MarketSnapshot,origin:CreatorLaunch|null,
):Promise<VerifiedMarketMetrics>{
  const unavailable={capUnit:market.quoteSymbol,
    holderCoverage:"unavailable" as const,changeWindow:"unavailable" as const,
    priceSource:"on-chain-pool-reserves" as const};
  const empty:VerifiedMarketMetrics={
    marketCap:null,holders:null,change24h:null,createdAt:origin?.createdAt??null,
    statistics:unavailable,
  };
  if(!origin||origin.token.toLowerCase()!==market.baseToken.toLowerCase())return empty;
  try{
    await requireUltraRpc();
    const latest=await ultraTradeClient.getBlockNumber();
    if(latest<3n)return empty;
    const finalized=latest-2n,launchBlock=BigInt(origin.blockNumber);
    const [supply,latestBlock,holderCount]=await Promise.all([
      ultraTradeClient.readContract({
        address:market.baseToken,abi:lookeCoinAbi,functionName:"totalSupply",
        blockNumber:finalized,
      }),
      ultraTradeClient.getBlock({blockNumber:finalized}),
      exactOnChainHolders(market.baseToken,launchBlock,finalized),
    ]);
    const marketCap=verifiedQuoteMarketCap(supply,market.baseDecimals,market.poolPrice);
    let change24h:string|null=null;
    if(Number(latestBlock.timestamp)-86400>new Date(origin.createdAt).getTime()/1000){
      try{
        const oldBlock=await findBlockAtTime(finalized,Number(latestBlock.timestamp)-86400);
        if(oldBlock!==null&&oldBlock>=launchBlock){
          const [historical,current,token0]=await Promise.all([
            ultraTradeClient.readContract({address:market.pair,abi:[{
              type:"function",name:"getReserves",inputs:[],outputs:[
                {name:"reserve0",type:"uint112"},{name:"reserve1",type:"uint112"},{name:"timestamp",type:"uint32"}],
              stateMutability:"view"}] as const,functionName:"getReserves",blockNumber:oldBlock}),
            ultraTradeClient.readContract({address:market.pair,abi:[{
              type:"function",name:"getReserves",inputs:[],outputs:[
                {name:"reserve0",type:"uint112"},{name:"reserve1",type:"uint112"},{name:"timestamp",type:"uint32"}],
              stateMutability:"view"}] as const,functionName:"getReserves",blockNumber:finalized}),
            ultraTradeClient.readContract({address:market.pair,abi:[{type:"function",name:"token0",inputs:[],outputs:[{type:"address"}],stateMutability:"view"}] as const,functionName:"token0",blockNumber:finalized}),
          ]);
          const base0=token0.toLowerCase()===market.baseToken.toLowerCase();
          const price=(reserve:readonly [bigint,bigint,number])=>
            reservePrice(base0?reserve[0]:reserve[1],base0?reserve[1]:reserve[0],
              market.baseDecimals,market.quoteDecimals);
          change24h=verifiedPriceChange(price(current),price(historical));
        }
      }catch{/* No historical archive or trustworthy 24h reserves: omit change. */}
    }
    return {marketCap,holders:holderCount,change24h,createdAt:origin.createdAt,
      statistics:{...unavailable,
        holderCoverage:holderCount===null?"unavailable":"complete-from-deployment",
        changeWindow:change24h===null?"unavailable":"verified-24h-reserves"}};
  }catch{return empty;}
}
