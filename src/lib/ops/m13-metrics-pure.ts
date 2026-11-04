import {formatUnits,type Address} from "viem";

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
