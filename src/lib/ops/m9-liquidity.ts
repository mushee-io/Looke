/**
 * Independent, READ-ONLY Ultra EVM Testnet V2 pool inspection.
 * Verifies an operator allowlist against real factory/router/pair bytecode,
 * relationships, token creator and two nonzero reserves.
 * This does not supply liquidity, enable execution or create market activity.
 */
import {
  createPublicClient, getAddress, http, type Address, type PublicClient,
} from "viem";
import {ULTRA_EVM_TESTNET} from "../ultra";
import {parseMarketRegistry,erc20Abi,v2FactoryAbi,v2PairAbi,v2RouterAbi,
  type MarketConfig} from "../trading";
import {validateEvmHead} from "./policy";

export type LiquidityObservation={
  id:string;
  status:"verified"|"blocked";
  reason:string;
  pair?:string;
  block?:string;
  reserveBase?:string;
  reserveQuote?:string;
  creator?:string;
};
export type LiquidityReport={
  observedAt:string;
  chainId:18881;
  source:"on-chain-read-only";
  configuredMarkets:number;
  verifiedMarkets:number;
  observations:LiquidityObservation[];
  allVerified:boolean;
  tradingActivated:false;
  betaActivated:false;
};

export function validatePairEvidence(
  market:MarketConfig,
  evidence:{
    routerFactory:Address;pairFactory:Address;factoryPair:Address;
    token0:Address;token1:Address;creator:Address;
    reserve0:bigint;reserve1:bigint;
    codeAddresses:Address[];
  },
):{reserveBase:bigint;reserveQuote:bigint;creator:Address}{
  const a=(v:Address)=>getAddress(v).toLowerCase();
  const match=[market.factory,market.router,market.pair,market.baseToken,market.quoteToken].map(a);
  if(new Set(match).size!==5)throw new Error("Market contract addresses must be distinct.");
  if(evidence.codeAddresses.length!==5||
     match.some(x=>!evidence.codeAddresses.map(a).includes(x)))throw new Error("Missing verified contract bytecode.");
  if(a(evidence.routerFactory)!==a(market.factory)||
     a(evidence.pairFactory)!==a(market.factory)||
     a(evidence.factoryPair)!==a(market.pair))throw new Error("Router/pair/factory provenance mismatch.");
  if(new Set([a(evidence.token0),a(evidence.token1)]).size!==2 ||
     ![a(evidence.token0),a(evidence.token1)].includes(a(market.baseToken)) ||
     ![a(evidence.token0),a(evidence.token1)].includes(a(market.quoteToken)))
     throw new Error("Pair token identity mismatch.");
  if(/^0x0{40}$/i.test(evidence.creator))throw new Error("Base creator identity missing.");
  const base0=a(evidence.token0)===a(market.baseToken);
  const reserveBase=base0?evidence.reserve0:evidence.reserve1;
  const reserveQuote=base0?evidence.reserve1:evidence.reserve0;
  if(reserveBase<=0n||reserveQuote<=0n)throw new Error("No actual two-sided pool liquidity.");
  return {reserveBase,reserveQuote,creator:getAddress(evidence.creator)};
}

export function liquidityReport(
  observations:LiquidityObservation[],now=new Date(),
):LiquidityReport{
  const configured=observations.filter(x=>x.id!=="allowlist");
  const ok=configured.filter(x=>x.status==="verified").length;
  return {
    observedAt:now.toISOString(),chainId:18881,source:"on-chain-read-only",
    configuredMarkets:configured.length,verifiedMarkets:ok,
    observations,allVerified:configured.length>0&&ok===configured.length,
    tradingActivated:false,betaActivated:false,
  };
}

export async function probeUltraLiquidity(raw:string|undefined=process.env.LOOKE_M4_MARKETS_JSON):Promise<LiquidityReport>{
  let markets:MarketConfig[];
  try{markets=parseMarketRegistry(raw);}
  catch(error){
    return liquidityReport([{id:"allowlist",status:"blocked",
      reason:error instanceof Error?error.message:"Invalid market allowlist."}]);
  }
  if(!markets.length)return liquidityReport([{id:"allowlist",status:"blocked",
    reason:"No real, operator-reviewed Ultra V2 pool addresses are configured. No volume or liquidity is claimed."}]);
  // Hardcoded known Testnet network unless a server-only operator URL is provided.
  const rpc=process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0];
  const client=createPublicClient({transport:http(rpc,{timeout:15000})});
  try{
    const [chain,head]=await Promise.all([client.getChainId(),client.getBlock({blockTag:"latest"})]);
    if(!validateEvmHead(chain,Number(head.timestamp),Math.floor(Date.now()/1000)).ok)
      throw new Error("Wrong or stale Ultra EVM Testnet chain.");
  }catch{
    return liquidityReport(markets.map(m=>({id:m.id,status:"blocked",reason:"Ultra EVM Testnet RPC not independently verified."})));
  }
  const observations:LiquidityObservation[]=[];
  for(const market of markets){
    try{
      const addresses=[market.factory,market.router,market.pair,market.baseToken,market.quoteToken] as Address[];
      const [bytecodes,routerFactory,pairFactory,factoryPair,token0,token1,creator,reserves,block] = await Promise.all([
        Promise.all(addresses.map(address=>client.getBytecode({address}))),
        client.readContract({address:market.router,abi:v2RouterAbi,functionName:"factory"}),
        client.readContract({address:market.pair,abi:v2PairAbi,functionName:"factory"}),
        client.readContract({address:market.factory,abi:v2FactoryAbi,functionName:"getPair",args:[market.baseToken,market.quoteToken]}),
        client.readContract({address:market.pair,abi:v2PairAbi,functionName:"token0"}),
        client.readContract({address:market.pair,abi:v2PairAbi,functionName:"token1"}),
        client.readContract({address:market.baseToken,abi:[{
          type:"function",name:"creator",inputs:[],outputs:[{type:"address"}],stateMutability:"view",
        }] as const,functionName:"creator"}),
        client.readContract({address:market.pair,abi:v2PairAbi,functionName:"getReserves"}),
        client.getBlockNumber(),
      ]);
      const hasCode=addresses.filter((_,i)=>bytecodes[i]&&bytecodes[i]!=="0x");
      const evidence=validatePairEvidence(market,{
        routerFactory,pairFactory,factoryPair,token0,token1,creator,
        reserve0:reserves[0],reserve1:reserves[1],codeAddresses:hasCode,
      });
      observations.push({id:market.id,status:"verified",
        reason:"Actual V2-compatible pair, router/factory provenance and nonzero reserves verified; independent code audit still required.",
        pair:market.pair,block:block.toString(),
        reserveBase:evidence.reserveBase.toString(),
        reserveQuote:evidence.reserveQuote.toString(),creator:evidence.creator});
    }catch(error){
      observations.push({id:market.id,status:"blocked",
        reason:error instanceof Error?error.message:"Pool read failed."});
    }
  }
  return liquidityReport(observations);
}
