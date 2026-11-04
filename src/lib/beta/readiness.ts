import "server-only";
import { getAddress, keccak256 } from "viem";
import { createUltraPublicClient, verifyFactoryDeployment } from "../verification";
import { inspectEvmCoin, inspectNativeUniq } from "./acceptance";
import { getNativeTestnetInfo } from "../ultra-native-rpc";
import { activeMarkets } from "../trading-server";
import { query } from "../social/db";
import {
  BETA_GATES, gate, parseAcceptance, validEvmAddress, validHash,
  validReleaseSignature, completeGates, requiredRevision,
  type Gate, type GateId, type ReleaseConfig,
} from "./policy";
import { ULTRA_EVM_TESTNET } from "../ultra";

export type BetaReadiness = {
  stage:"closed"|"public";
  publicBetaOpen:boolean;
  checkedAt:string;
  gates:Gate[];
  summary:{passed:number;total:number};
};
const CLOSED="Closed: no automatic deployment, public onboarding or wallet execution is authorized.";

async function safeCheck(id:GateId,fn:()=>Promise<boolean>,success:string,blocked:string):Promise<Gate> {
  try{return gate(id,await fn(),success,blocked);}
  catch{return gate(id,false,success,blocked);}
}
function runtimeRevision():string {
  return requiredRevision(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.LOOKE_M6_DEPLOY_REVISION);
}

/** Configuration view never claims real chain/business readiness; use only for CI smoke & liveness. */
export function closedConfigReadiness():BetaReadiness {
  const gates=BETA_GATES.map(id=>gate(id,false,"","Live verification has not been performed."));
  return {
    stage:"closed",publicBetaOpen:false,checkedAt:new Date().toISOString(),
    gates,summary:{passed:0,total:BETA_GATES.length},
  };
}

/** All evidence must pass on this actual running deployment before public beta can open. */
export async function computeBetaReadiness():Promise<BetaReadiness> {
  const publicFlag=process.env.LOOKE_PUBLIC_BETA_ENABLED==="true";
  const config={
    factory:process.env.LOOKE_FACTORY_ADDRESS || "",
    factoryTx:process.env.LOOKE_FACTORY_DEPLOY_TX || "",
    factoryCode:process.env.LOOKE_M6_FACTORY_RUNTIME_KECCAK || "",
    coinTx:process.env.LOOKE_M6_COIN_CREATION_TX || "",
    uniqFactory:process.env.LOOKE_M6_UNIQ_FACTORY_ID || "",
    uniqOwner:process.env.LOOKE_M6_UNIQ_OWNER || "",
    uniqToken:process.env.LOOKE_M6_UNIQ_TOKEN_ID || "",
  };
  const client=createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]);
  let attestation:ReturnType<typeof parseAcceptance>|null=null;
  try{attestation=parseAcceptance(process.env.LOOKE_M6_ACCEPTANCE_JSON);}catch{ /* fail closed */ }
  const candidateSignature:ReleaseConfig = {
    signer:process.env.LOOKE_BETA_RELEASE_SIGNER || "",
    revision:process.env.LOOKE_BETA_RELEASE_REVISION || "",
    expiresAt:process.env.LOOKE_BETA_RELEASE_EXPIRES_AT || "",
    signature:(process.env.LOOKE_BETA_RELEASE_SIGNATURE || "0x") as `0x${string}`,
  };
  const checks: Array<Promise<Gate>>=[
    safeCheck("evmRpc",async()=>await client.getChainId()===18881,
      "Ultra EVM Testnet chain ID 18881 confirmed.","Ultra EVM RPC unverified or on wrong network."),
    safeCheck("nativeRpc",async()=>{
      const info=await getNativeTestnetInfo();
      return info.last_irreversible_block_num>0;
    },"Ultra native Testnet irreversible ledger confirmed.","Native Testnet RPC or ledger unverified."),
    safeCheck("factory",async()=>{
      if(!validEvmAddress(config.factory)||!validHash(config.factoryTx)||!validHash(config.factoryCode))return false;
      const result=await verifyFactoryDeployment(client,config.factory,config.factoryTx);
      return keccak256(result.runtimeCode).toLowerCase()===config.factoryCode.toLowerCase();
    },"Factory deployment, runtime code hash, receipt and confirmations verified.",
      "Factory receipt or independently compiled runtime code hash missing/unverified."),
    safeCheck("creatorCoin",async()=>{
      if(!validEvmAddress(config.factory)||!validHash(config.coinTx))return false;
      const result=await inspectEvmCoin(config.factory,config.coinTx);
      return result.confirmations>=2 && BigInt(result.totalSupply)>0n;
    },"Real signed creator coin event, deployed token and creator balance verified.",
      "Genuine creator coin creation transaction/state not verified."),
    safeCheck("uniqHolding",async()=>{
      if(!config.uniqFactory||!config.uniqOwner||!config.uniqToken)return false;
      const proof=await inspectNativeUniq(config.uniqFactory,config.uniqOwner,config.uniqToken);
      return proof.irreversibleBlock>0 && proof.uniq.id===config.uniqToken;
    },"Native Uniq ownership and factory verified from Testnet tables.",
      "Real native Uniq factory and owned token proof missing."),
    safeCheck("liquidity",async()=>{
      const result=await activeMarkets();
      return result.executionEnabled && result.markets.length>0 && result.errors.length===0 &&
        process.env.LOOKE_M4_TRADING_ENABLED==="true";
    },"Allowlisted V2 Testnet pools have real two-sided reserves and execution approval.",
      "Trading execution disabled or real V2 liquidity provenance unverified."),
    safeCheck("socialDatabase",async()=>{
      if(!process.env.DATABASE_URL||process.env.LOOKE_SOCIAL_WRITES_ENABLED!=="true"||
        !process.env.LOOKE_SOCIAL_APP_ORIGIN?.startsWith("https://"))return false;
      const r=await query<{profiles:string|null;posts:string|null;reports:string|null}>(`
        SELECT to_regclass('public.social_profiles')::text as profiles,
               to_regclass('public.social_posts')::text as posts,
               to_regclass('public.social_reports')::text as reports`);
      const row=r.rows[0];
      return Boolean(row?.profiles && row?.posts && row?.reports);
    },"Social PostgreSQL schema, moderation tables and controlled writes configured.",
      "Social database, production origin or moderated writes not operational."),
    safeCheck("walletAcceptance",async()=>Boolean(attestation?.walletAcceptance),
      "Recent independent wallet acceptance record supplied.","Wallet acceptance evidence absent or expired."),
    safeCheck("securityReview",async()=>Boolean(attestation?.securityReview),
      "Recent security review record supplied.","Security review evidence absent or expired."),
    safeCheck("operationsApproval",async()=>Boolean(attestation?.operationsApproval),
      "Operator release approval recorded.","Operator launch approval absent or expired."),
    safeCheck("releaseSignature",async()=>{
      if(!publicFlag||!attestation||!validEvmAddress(candidateSignature.signer))return false;
      const deployedRevision=runtimeRevision();
      if(candidateSignature.revision.toLowerCase()!==deployedRevision)return false;
      if(getAddress(candidateSignature.signer)!==getAddress(attestation.operationsApproval.reviewer))return false;
      return validReleaseSignature(candidateSignature);
    },"Time-limited, revision-bound operator wallet release signature verified.",
      "Public beta release signature, Git revision or operator identity not approved."),
  ];
  const gates=await Promise.all(checks);
  const publicBetaOpen=completeGates(gates,publicFlag);
  return {
    stage:publicBetaOpen?"public":"closed",publicBetaOpen,
    checkedAt:new Date().toISOString(),
    gates,summary:{passed:gates.filter(g=>g.status==="passed").length,total:gates.length},
  };
}

export async function checkBetaHealth() {
  const checks=await Promise.all([
    safeCheck("evmRpc",async()=>await createUltraPublicClient(process.env.ULTRA_EVM_RPC_URL||ULTRA_EVM_TESTNET.rpcUrls[0]).getChainId()===18881,
      "Connected","Unavailable"),
    safeCheck("nativeRpc",async()=>(await getNativeTestnetInfo()).last_irreversible_block_num>0,
      "Connected","Unavailable"),
    safeCheck("socialDatabase",async()=>{
      if(!process.env.DATABASE_URL)return false;
      const r=await query<{ok:number}>("SELECT 1 AS ok");
      return r.rows[0]?.ok===1;
    },"Connected","Unavailable"),
  ]);
  return {
    service:"looke",
    environment:"ultra-testnet",
    checkedAt:new Date().toISOString(),
    status:checks.every(x=>x.status==="passed")?"healthy":"degraded",
    checks,
    betaDefault:CLOSED,
  };
}
