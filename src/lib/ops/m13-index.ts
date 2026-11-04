/**
 * M13: independently verified, bounded and cursor-paged Ultra EVM Testnet
 * CoinCreated index. No off-chain tokens, mock entries or provider scraping.
 *
 * A page is a fully covered range of 600 blocks, starting from finalized head
 * and walking backwards. It is NOT a complete history until all pages are read.
 * Reorganization safety: source head - 2 and provenance-checked receipts.
 */
import {getAddress,isAddress,type Address,type Hash} from "viem";
import {lookeCoinFactoryAbi,lookeCoinAbi} from "../coin-abi";
import {
  createUltraPublicClient,assertUltraTestnet,verifyFactoryDeployment,
} from "../verification";
import {ULTRA_EVM_TESTNET} from "../ultra";

export const M13_BLOCKS_PER_PAGE=600n;
export const M13_LOG_CAP=50;
const validTx=(v:string)=>/^0x[0-9a-fA-F]{64}$/.test(v)&&!/^0x0{64}$/i.test(v);
export type CreatorLaunch={
  id:string;token:string;creator:string;name:string;symbol:string;
  factory:string;txHash:string;blockNumber:string;createdAt:string;
  initialSupply:string;source:"verified-CoinCreated";
};
export type LaunchPage={
  chainId:18881;status:"verified"|"unconfigured"|"blocked";
  asOf:string;factory:string|null;fromBlock:string|null;throughBlock:string|null;
  nextCursor:string|null;complete:boolean;
  launches:CreatorLaunch[];errors:string[];transactionsSent:0;
};
export function parseFactoryConfig(address:string|undefined,tx:string|undefined):
  {address:Address;txHash:Hash}|null{
  if(!address&&!tx)return null;
  if(!address||!isAddress(address)||/^0x0{40}$/i.test(address)||
    !tx||!validTx(tx))throw new Error("Factory address and genuine deployment transaction hash must both be configured.");
  return {address:getAddress(address),txHash:tx as Hash};
}
export function launchWindow(deployed:bigint,finalizedHead:bigint,cursor:string|null):
 {from:bigint;through:bigint;nextCursor:string|null;complete:boolean}{
  if(deployed<0n||finalizedHead<0n)throw new Error("Invalid verified factory/head block.");
  let through=finalizedHead;
  if(cursor!==null){
    if(!/^(0|[1-9][0-9]{0,19})$/.test(cursor))throw new Error("Invalid on-chain block cursor.");
    const n=BigInt(cursor);
    if(n>finalizedHead)throw new Error("Future block cursor is not allowed.");
    through=n;
  }
  if(through<deployed)return {from:deployed,through,nextCursor:null,complete:true};
  const from=through-deployed+1n>M13_BLOCKS_PER_PAGE?through-(M13_BLOCKS_PER_PAGE-1n):deployed;
  const complete=from===deployed;
  return {from,through,nextCursor:complete?null:(from-1n).toString(),complete};
}
export function validateLaunchEvent(input:{
  factory:Address;contract:Address;coin:Address;creator:Address;transactionFrom:Address;
  receiptStatus:"success"|"reverted";receiptBlock:bigint;eventBlock:bigint;
  blockHash:string;receiptBlockHash:string;runtimeCode?:string;
  creatorOnChain:Address;totalSupply:bigint;initialSupply:bigint;
}):void {
  if(input.factory.toLowerCase()!==input.contract.toLowerCase()||
     input.receiptStatus!=="success"||
     input.receiptBlock!==input.eventBlock||
     input.blockHash.toLowerCase()!==input.receiptBlockHash.toLowerCase()||
     input.creator.toLowerCase()!==input.transactionFrom.toLowerCase()||
     input.creator.toLowerCase()!==input.creatorOnChain.toLowerCase()||
     !input.runtimeCode||input.runtimeCode==="0x"||
     input.totalSupply<0n||input.initialSupply<=0n||
     /^0x0{40}$/i.test(input.coin)){
    throw new Error("CoinCreated receipt, signer, token bytecode or chain state do not match.");
  }
}
function blocked(status:LaunchPage["status"],reason:string,now=new Date()):LaunchPage{
  return {chainId:18881,status,asOf:now.toISOString(),
    factory:null,fromBlock:null,throughBlock:null,nextCursor:null,
    complete:false,launches:[],errors:[reason],transactionsSent:0};
}
export async function indexCreatorLaunches(cursor:string|null=null,now=new Date()):Promise<LaunchPage>{
  let cfg:ReturnType<typeof parseFactoryConfig>;
  try{cfg=parseFactoryConfig(process.env.LOOKE_M13_FACTORY_ADDRESS,process.env.LOOKE_M13_FACTORY_DEPLOY_TX);}
  catch{return blocked("blocked","Factory provenance configuration is invalid.",now);}
  if(!cfg)return blocked("unconfigured","No verified Looke factory deployment configured. No tokens will be invented.",now);
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  try{
    await assertUltraTestnet(client);
    const [factory,receipt,latest]=await Promise.all([
      verifyFactoryDeployment(client,cfg.address,cfg.txHash),
      client.getTransactionReceipt({hash:cfg.txHash}),
      client.getBlockNumber(),
    ]);
    if(factory.address!==cfg.address||receipt.blockNumber>latest-2n)
      throw new Error("Factory deployment receipt is not finalized.");
    const plan=launchWindow(receipt.blockNumber,latest-2n,cursor);
    const page:LaunchPage={
      chainId:18881,status:"verified",asOf:now.toISOString(),factory:cfg.address,
      fromBlock:plan.from.toString(),throughBlock:plan.through.toString(),
      nextCursor:plan.nextCursor,complete:plan.complete,launches:[],errors:[],transactionsSent:0,
    };
    if(plan.through<plan.from)return page;
    // Queries are bounded and retain a canonical block hash per decoded receipt.
    const logs: Array<{address:Address;transactionHash:Hash|null;blockNumber:bigint|null;args:{creator?:Address;coin?:Address;name?:string;symbol?:string;initialSupply?:bigint}}> = [];
    for(let from=plan.from;from<=plan.through;from+=150n){
      const to=from+149n>plan.through?plan.through:from+149n;
      const chunk=await client.getLogs({address:cfg.address,
        event:lookeCoinFactoryAbi[2], // genuine indexed CoinCreated event
        fromBlock:from,toBlock:to});
      logs.push(...chunk);
      if(logs.length>M13_LOG_CAP)
        throw new Error("Too many factory events in this page; reduce the bounded scan before indexing.");
    }
    for(const log of logs){
      try{
        if(!log.transactionHash||log.blockNumber===null||
           !log.args.creator||!log.args.coin||!log.args.name||!log.args.symbol||
           log.args.initialSupply===undefined)throw new Error("Incomplete event.");
        const creator=getAddress(log.args.creator),coin=getAddress(log.args.coin);
        const [rc,block,code,owner,totalSupply]=await Promise.all([
          client.getTransactionReceipt({hash:log.transactionHash}),
          client.getBlock({blockNumber:log.blockNumber}),
          client.getBytecode({address:coin}),
          client.readContract({address:coin,abi:lookeCoinAbi,functionName:"creator"}),
          client.readContract({address:coin,abi:lookeCoinAbi,functionName:"totalSupply"}),
        ]);
        validateLaunchEvent({
          factory:cfg.address,contract:getAddress(log.address),coin,creator,
          transactionFrom:rc.from,receiptStatus:rc.status,
          receiptBlock:rc.blockNumber,eventBlock:log.blockNumber,
          blockHash:block.hash??"",receiptBlockHash:rc.blockHash,
          runtimeCode:code,creatorOnChain:owner,totalSupply,
          initialSupply:log.args.initialSupply,
        });
        if(!/^[\w .-]{1,80}$/.test(log.args.name)||
           !/^[a-zA-Z0-9_.-]{1,24}$/.test(log.args.symbol))
          throw new Error("Untrusted coin name or symbol.");
        page.launches.push({
          id:coin.toLowerCase(),token:coin,creator,name:log.args.name,
          symbol:log.args.symbol,factory:cfg.address,
          txHash:log.transactionHash,blockNumber:log.blockNumber.toString(),
          createdAt:new Date(Number(block.timestamp)*1000).toISOString(),
          initialSupply:log.args.initialSupply.toString(),source:"verified-CoinCreated",
        });
      }catch{
        page.errors.push("An event failed token-code, creator or canonical receipt verification and was excluded.");
      }
    }
    page.launches.sort((a,b)=>Number(BigInt(b.blockNumber)-BigInt(a.blockNumber))||a.id.localeCompare(b.id));
    return page;
  }catch{
    return blocked("blocked","Actual Ultra EVM factory RPC, deployment proof or bounded log scan unavailable.",now);
  }
}
