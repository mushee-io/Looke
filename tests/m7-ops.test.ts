import assert from "node:assert/strict";
import { test } from "node:test";
import {
  validateEvmHead,validateNativeHead,releaseControlsFromEnv,
  rollbackEnvironment,makeHealth,type OperatorCheck,
} from "../src/lib/ops/policy";
import {parseProofManifest,summarizeProofs} from "../src/lib/ops/acceptance";

const nativeId="7fc56be645bb76ab9d747b53089f132dcb7681db06f0852cfa03eaf6f7ac80e9";
const now=1793811600;
test("M7 rejects wrong EVM chain and stale or future blocks",()=>{
  assert.equal(validateEvmHead(18881,now-15,now).ok,true);
  assert.equal(validateEvmHead(1,now-15,now).ok,false);
  assert.equal(validateEvmHead(18881,now-1201,now).ok,false);
  assert.equal(validateEvmHead(18881,now+121,now).ok,false);
  assert.equal(validateEvmHead(18881,0,now).ok,false);
});
test("M7 validates native chain ID, head and irreversible lag",()=>{
  assert.equal(validateNativeHead(nativeId,nativeId,10010,10000).ok,true);
  assert.equal(validateNativeHead("mainnet",nativeId,10010,10000).ok,false);
  assert.equal(validateNativeHead(nativeId,nativeId,101,102).ok,false);
  assert.equal(validateNativeHead(nativeId,nativeId,1301,100).ok,false);
  assert.equal(validateNativeHead(nativeId,nativeId,1,0).ok,false);
});
test("rollback controls are ALWAYS false and staging preflight rejects enabled capabilities",()=>{
  const rollback=rollbackEnvironment();
  assert.deepEqual(rollback,{
    LOOKE_PUBLIC_BETA_ENABLED:"false",
    LOOKE_M4_TRADING_ENABLED:"false",
    LOOKE_SOCIAL_WRITES_ENABLED:"false",
    LOOKE_M6_EVIDENCE_ENABLED:"false",
  });
  assert.equal(releaseControlsFromEnv({...rollback}).safe,true);
  assert.equal(releaseControlsFromEnv({LOOKE_PUBLIC_BETA_ENABLED:"true"}).safe,false);
  assert.deepEqual(releaseControlsFromEnv({LOOKE_M4_TRADING_ENABLED:"true",LOOKE_SOCIAL_WRITES_ENABLED:"true"}).violations,
    ["LOOKE_M4_TRADING_ENABLED","LOOKE_SOCIAL_WRITES_ENABLED"]);
});
test("public beta never declared healthy from incomplete or duplicated diagnostic checks",()=>{
  const ids=["evm","native","database","release"] as const;
  const rows:OperatorCheck[]=ids.map(id=>({id,status:"pass",reason:"verified",checkedAt:"2026-11-04T00:00:00.000Z"}));
  assert.equal(makeHealth(rows,false).status,"healthy");
  assert.equal(makeHealth(rows,false).beta,"closed");
  assert.equal(makeHealth(rows.slice(1),false).status,"degraded");
  assert.equal(makeHealth([...rows,rows[0]],false).status,"degraded");
  assert.equal(makeHealth(rows.map(x=>x.id==="evm"?{...x,status:"fail" as const}:x),false).status,"degraded");
  // Being live-flagged never implies operational readiness.
  assert.equal(makeHealth(rows.slice(1),true).status,"degraded");
});
test("public evidence manifest rejects missing, malformed and zero hashes",()=>{
  const data={
    evmFactory:{address:"0x1111111111111111111111111111111111111111",deploymentTx:"0x"+"a".repeat(64)},
    creatorCoin:{creationTx:"0x"+"b".repeat(64)},
    nativeUniq:{factoryId:"42",tokenId:"13",owner:"testwallet"},
  };
  const parsed=parseProofManifest(data);
  assert.equal(parsed.evmFactory.address,data.evmFactory.address);
  assert.throws(()=>parseProofManifest({...data,evmFactory:{...data.evmFactory,deploymentTx:"0x"+"0".repeat(64)}}),/nonzero/);
  assert.throws(()=>parseProofManifest({...data,nativeUniq:{...data.nativeUniq,owner:"BAD"}}),/account/);
  assert.throws(()=>parseProofManifest({...data,creatorCoin:{}}),/hash/);
});
test("proof summary never labels absent checks as success or activates beta",()=>{
  assert.throws(()=>summarizeProofs([]),/three/);
  const result=summarizeProofs([
    {id:"factory",status:"verified",reason:"onchain"},
    {id:"creatorCoin",status:"blocked",reason:"missing"},
    {id:"nativeUniq",status:"blocked",reason:"missing"},
  ]);
  assert.equal(result.betaActivated,false);
  assert.equal(result.readOnly,true);
  assert.equal(result.results.filter(x=>x.status==="verified").length,1);
});
