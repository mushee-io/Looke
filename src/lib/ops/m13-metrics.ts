import {getAddress,formatUnits,type Address} from "viem";
import {lookeCoinAbi} from "../coin-abi";
import {erc20Abi,reservePrice,type MarketSnapshot} from "../trading";
import {ultraTradeClient,requireUltraRpc} from "../trading-server";
import type {CreatorLaunch} from "./m13-index";

export type TransferProof={from:Address;to:Address;value:bigint};
export type VerifiedMarketMetrics={
  marketCap:string|null;holders:number|null;change24h:string|null;
  createdAt:string|null;
  statistics:{
    capUnit:string;holderCoverage:"complete-from-deployment"|"unavailable";
    changeWindow:"verified-24h-reserves"|"unavailable";
    priceSource:"on-chain-pool-reserves";
  };
};
const ZERO="0x0000000000000000000000000000000000000000";
export const MAX_HOLDER_HISTORY_BLOCKS=3600n;
const MAX_TRANSFER_EVENTS=2500;
export function exactHolderCount(transfers:TransferProof[],totalSupply:bigint):number|null{
  if(totalSupply<0n)return null;
  const balances=new Map<string,bigint>();
  const add=(owner:Address,delta:bigint)=>{
    if(owner.toLowerCase()===ZERO)return;
    const key=owner.toLowerCase();
    const current=(balances.get(key)??0n)+delta;
    if(current<0n)throw new Error("Non-canonical transfer history: negative balance.");
    balances.set(key,current);
  };
  try{
    for(const tr of transfers){
      if(tr.value<0n) return null;
      add(tr.from,-tr.value);add(tr.to,tr.value);
    }
  }catch{return null;}
  let sum=0n,count=0;
  for(const amount of balances.values()){
    sum+=amount;if(amount>0n)count++;
  }
  // A complete transfer journal must reconcile against genuine totalSupply.
  return sum===totalSupply?count:null;
}
export function verifiedQuoteMarketCap(supply:bigint,decimals:number,poolPrice:string):string|null{
  if(supply<0n||!Number.isInteger(decimals)||decimals<0||decimals>18)return null;
  const amount=Number(formatUnits(supply,decimals)), price=Number(poolPrice);
  if(!Number.isFinite(amount)||!Number.isFinite(price)||price<=0)return null;
  const cap=amount*price;
  return Number.isFinite(cap)&&cap>=0?cap.toPrecision(12):null;
}
export function verifiedPriceChange(current:string,previous:string):string|null{
  const a=Number(current),b=Number(previous);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return null;
  const change=(a/b-1)*100;
  return Number.isFinite(change)?change.toFixed(2):null;
}
export function validateHolderScan(launchBlock:bigint,finalized:bigint):boolean{
  return launchBlock>=0n&&finalized>=launchBlock&&finalized-launchBlock+1n<=MAX_HOLDER_HISTORY_BLOCKS;
}
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
