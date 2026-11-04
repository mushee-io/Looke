import assert from "node:assert/strict";
import {test} from "node:test";
import {getAddress} from "viem";
import {
  validatePairEvidence,liquidityReport,
  type LiquidityObservation,
} from "../src/lib/ops/m9-liquidity";
import {assessVercelProtection,DISABLED_FLAGS,
  EXPECTED_PROJECT,type VercelEnvironmentVariable} from "../src/lib/ops/m9-vercel";
import {createAcceptancePacket,REQUIRED_M9_STAGES} from "../src/lib/ops/m9-acceptance";
import {buildRpcEvidence} from "../src/lib/ops/m8-probe";
import {ULTRA_NATIVE_TESTNET} from "../src/lib/ultra-native";
import {REQUIRED_TABLES,validateAudit} from "../src/lib/ops/m8-db-audit";
import type {MarketConfig} from "../src/lib/trading";

const addr=(n:number)=>getAddress("0x"+n.toString(16).padStart(40,"0"));
const m:MarketConfig={id:"real-market",factory:addr(1),router:addr(2),
  pair:addr(3),baseToken:addr(4),quoteToken:addr(5)};
const live={routerFactory:m.factory,pairFactory:m.factory,factoryPair:m.pair,
  token0:m.baseToken,token1:m.quoteToken,creator:addr(6),
  reserve0:1000n,reserve1:2000n,
  codeAddresses:[m.factory,m.router,m.pair,m.baseToken,m.quoteToken]};
test("V2 pool proof requires correct router, factory, pair, deployed code and genuine two-sided reserves",()=>{
  const result=validatePairEvidence(m,live);
  assert.equal(result.reserveBase,1000n);
  assert.equal(result.reserveQuote,2000n);
  assert.throws(()=>validatePairEvidence(m,{...live,reserve0:0n}),/two-sided/);
  assert.throws(()=>validatePairEvidence(m,{...live,codeAddresses:live.codeAddresses.slice(1)}),/bytecode/);
  assert.throws(()=>validatePairEvidence(m,{...live,pairFactory:addr(7)}),/provenance/);
  assert.throws(()=>validatePairEvidence(m,{...live,token0:addr(7)}),/token identity/);
  assert.throws(()=>validatePairEvidence(m,{...live,creator:addr(0)}),/creator/);
});
test("liquidity observation never fabricates a funded market or turns on execution",()=>{
  const missing=liquidityReport([]);
  assert.equal(missing.allVerified,false);
  assert.equal(missing.tradingActivated,false);
  const observed:LiquidityObservation={id:"real-market",status:"verified",reason:"on-chain"};
  const report=liquidityReport([observed]);
  assert.equal(report.allVerified,true);
  assert.equal(report.tradingActivated,false);
  assert.equal(report.betaActivated,false);
  assert.equal(liquidityReport([observed,{id:"unknown",status:"blocked",reason:"no code"}]).allVerified,false);
});
test("project metadata must attest Vercel Authentication for all URLs and exact safe env values",()=>{
  const project={id:"prj_test",name:EXPECTED_PROJECT,
    ssoProtection:{deploymentType:"all"},link:{repo:"mushee-io/looke",type:"github"}};
  const envs:VercelEnvironmentVariable[]=[];
  for(const target of ["preview","production"] as const){
    for(const key of [...DISABLED_FLAGS,"LOOKE_M4_MARKETS_JSON"])
      envs.push({key,target,value:key==="LOOKE_M4_MARKETS_JSON"?"[]":"false"});
  }
  const good=assessVercelProtection(project,envs);
  assert.equal(good.status,"verified-metadata");
  assert.equal(good.signedOutBrowserChecked,false);
  assert.equal(assessVercelProtection({...project,ssoProtection:{deploymentType:"preview"}},envs).status,"blocked");
  assert.equal(assessVercelProtection({...project,previewDeploymentsDisabled:true},envs).status,"blocked");
  assert.equal(assessVercelProtection({...project,link:{repo:"another/repo",type:"github"}},envs).status,"blocked");
  assert.equal(assessVercelProtection(project,envs.filter(x=>x.target!=="preview")).status,"blocked");
  assert.equal(assessVercelProtection(project,[...envs,{key:"LOOKE_PUBLIC_BETA_ENABLED",value:"true",target:"production"}]).status,"blocked");
  assert.equal(assessVercelProtection(null,[]).status,"blocked");
});
test("M9 acceptance packet is always closed and missing proof remains clearly blocked",()=>{
  const packet=createAcceptancePacket({rpc:null,liquidity:null,db:null,stagingProtectionVerified:false,
    factoryReceiptVerified:false,coinReceiptVerified:false,uniqOwnershipVerified:false,
    walletWitnessVerified:false,securityApproved:false,operatorApproved:false,
    rollbackDrillPassed:true,
    flags:{LOOKE_PUBLIC_BETA_ENABLED:"false",LOOKE_M4_TRADING_ENABLED:"false",
      LOOKE_SOCIAL_WRITES_ENABLED:"false",LOOKE_M6_EVIDENCE_ENABLED:"false"}});
  assert.equal(packet.publicBetaOpen,false);
  assert.equal(packet.stagingDeployed,false);
  assert.equal(packet.items.length,REQUIRED_M9_STAGES.length);
  assert.ok(packet.missing.includes("reviewedLiquidity"));
  assert.ok(packet.missing.includes("protectedStaging"));
  assert.equal(packet.items.find(x=>x.stage==="rollbackDrill")?.status,"verified");
});
test("even full synthetic input objects never authorize a public launch",()=>{
  const now=new Date();
  const sec=Math.floor(now.getTime()/1000);
  const rpc=buildRpcEvidence(
    {status:"verified",reason:"test data only",chainId:18881,
      headBlock:"1",headHash:"0x"+"a".repeat(64),headTimestamp:sec},
    {status:"verified",reason:"test data only",chainId:ULTRA_NATIVE_TESTNET.chainId,
      headBlock:100,irreversibleBlock:99},null,now,
  );
  const db=validateAudit({serverVersion:160000,ssl:true,readOnlyTransaction:true,
    relations:[...REQUIRED_TABLES],
    indexed:["social_profiles","social_auth_challenges","social_sessions",
      "social_follows","social_blocks","social_posts","social_comments","social_reports",
      "social_moderation_audit","social_rate_windows"]});
  const packet=createAcceptancePacket({
    rpc,liquidity:liquidityReport([{id:"test",status:"verified",reason:"test data only"}]),
    db,stagingProtectionVerified:true,factoryReceiptVerified:true,coinReceiptVerified:true,
    uniqOwnershipVerified:true,walletWitnessVerified:true,securityApproved:true,
    operatorApproved:true,rollbackDrillPassed:true,
    flags:{LOOKE_PUBLIC_BETA_ENABLED:"false"},
  });
  assert.equal(packet.status,"ready-for-independent-review");
  assert.equal(packet.publicBetaOpen,false);
  assert.equal(packet.stagingDeployed,false);
  assert.equal(packet.walletTransactions,0);
  const unsafe=createAcceptancePacket({
    rpc,liquidity:liquidityReport([{id:"test",status:"verified",reason:"test data only"}]),db,
    stagingProtectionVerified:true,factoryReceiptVerified:true,coinReceiptVerified:true,
    uniqOwnershipVerified:true,walletWitnessVerified:true,securityApproved:true,
    operatorApproved:true,rollbackDrillPassed:true,
    flags:{LOOKE_PUBLIC_BETA_ENABLED:"true"},
  });
  assert.equal(unsafe.status,"blocked");
  assert.ok(unsafe.missing.includes("rollbackDrill"));
});
