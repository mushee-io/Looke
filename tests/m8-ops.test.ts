import assert from "node:assert/strict";
import {test} from "node:test";
import {generatePrivateKey,privateKeyToAccount} from "viem/accounts";
import {buildRpcEvidence} from "../src/lib/ops/m8-probe";
import {ULTRA_NATIVE_TESTNET} from "../src/lib/ultra-native";
import {REQUIRED_TABLES,validateAudit,localDbOverrideAllowed} from "../src/lib/ops/m8-db-audit";
import {evaluateAlerts,githubAnnotations} from "../src/lib/ops/m8-alerts";
import {rehearseRollback} from "../src/lib/ops/m8-rollback";
import {verifyWalletAcceptance,walletAcceptanceStatement,type WalletEvidenceInput} from "../src/lib/ops/m8-wallet-evidence";

const time=new Date();
const seconds=Math.floor(time.getTime()/1000);
const fakeHash="0x"+"b".repeat(64);
const goodEvm={status:"verified" as const,reason:"real RPC",chainId:18881,headBlock:"12345",headHash:fakeHash,headTimestamp:seconds-30};
const goodNative={status:"verified" as const,reason:"native verified",chainId:ULTRA_NATIVE_TESTNET.chainId,headBlock:2000,irreversibleBlock:1990};

test("RPC evidence requires two genuine-shaped, fresh correct-chain observations",()=>{
  const report=buildRpcEvidence(goodEvm,goodNative,"a".repeat(40),time);
  assert.equal(report.allVerified,true);
  assert.equal(report.evm.status,"verified");
  assert.equal(report.native.status,"verified");
  assert.equal(report.betaActivated,false);
  assert.equal(report.walletTransactions,0);
  assert.equal(buildRpcEvidence({...goodEvm,chainId:1},goodNative,null,time).allVerified,false);
  assert.equal(buildRpcEvidence({...goodEvm,headTimestamp:seconds-50000},goodNative,null,time).allVerified,false);
  assert.equal(buildRpcEvidence({...goodEvm,headHash:"0xbad"},goodNative,null,time).allVerified,false);
  assert.equal(buildRpcEvidence(goodEvm,{...goodNative,chainId:"mainnet"},null,time).allVerified,false);
  assert.equal(buildRpcEvidence({status:"blocked",reason:"No RPC"},goodNative,null,time).allVerified,false);
});

test("DB audit rejects missing schema, indices, PostgreSQL 14, and non-TLS external connections",()=>{
  const full={serverVersion:160009,ssl:true,relations:[...REQUIRED_TABLES],
    indexed:["social_profiles","social_auth_challenges","social_sessions","social_follows","social_blocks",
      "social_posts","social_comments","social_reports","social_moderation_audit","social_rate_windows"],readOnlyTransaction:true};
  assert.equal(validateAudit(full).status,"verified");
  assert.equal(validateAudit({...full,ssl:false}).status,"blocked");
  assert.equal(validateAudit({...full,serverVersion:140000}).status,"blocked");
  assert.equal(validateAudit({...full,relations:[]}).missingRelations.length,REQUIRED_TABLES.length);
  assert.equal(validateAudit({...full,indexed:[]}).status,"blocked");
  assert.equal(validateAudit({...full,readOnlyTransaction:false}).status,"blocked");
  assert.equal(validateAudit({...full,ssl:false},true).status,"verified");
});
test("DB plaintext override applies exclusively to explicitly opted-in local CI addresses",()=>{
  assert.equal(localDbOverrideAllowed("postgres://x:y@localhost:5432/c","true"),true);
  assert.equal(localDbOverrideAllowed("postgres://x:y@127.0.0.1:5432/c","true"),true);
  assert.equal(localDbOverrideAllowed("postgres://x:y@db.example.com:5432/c","true"),false);
  assert.equal(localDbOverrideAllowed("postgres://x:y@localhost:5432/c","false"),false);
  assert.equal(localDbOverrideAllowed(undefined,"true"),false);
});
test("alerts remain critical without protected staging or actual RPC evidence",()=>{
  const alerts=evaluateAlerts(null,null,false);
  assert.equal(alerts.some(x=>x.code==="STAGING_UNPROTECTED"&&x.severity==="critical"),true);
  assert.equal(alerts.some(x=>x.code==="RPC_UNCHECKED"),true);
  assert.ok(githubAnnotations(alerts).some(x=>x.startsWith("::error")));
  const verified=buildRpcEvidence(goodEvm,goodNative,null,time);
  assert.equal(evaluateAlerts(verified,null,true).length,1);
  assert.equal(evaluateAlerts(verified,null,true)[0].code,"SOCIAL_DB_UNVERIFIED");
});
test("dry-run rollback never changes remote state and always disables public capabilities",()=>{
  const r=rehearseRollback();
  assert.equal(r.simulated,true);
  assert.equal(r.remoteChanges,0);
  assert.equal(r.initialFlagsUnsafe,true);
  assert.equal(r.restoredFlagsSafe,true);
  assert.equal(r.betaActivated,false);
  assert.deepEqual(Object.values(r.recommendedFlags),Array(4).fill("false"));
});
test("wallet acceptance requires distinct EVM and independent reviewer signatures",async()=>{
  // Ephemeral in-memory test keys ONLY; neither is a real user or deployed wallet.
  const account=privateKeyToAccount(generatePrivateKey());
  const observer=privateKeyToAccount(generatePrivateKey());
  const base:WalletEvidenceInput={
    revision:"a".repeat(40),
    stagingOrigin:"https://staging.looke.example",
    capturedAt:new Date().toISOString(),
    evmAddress:account.address,nativeAccount:"testwallet",
    observerAddress:observer.address,
    evmSignature:"0x" as `0x${string}`,
    observerSignature:"0x" as `0x${string}`,
    reviewUrl:"https://github.com/mushee-io/looke/issues/17",
  };
  const msg=walletAcceptanceStatement(base);
  const withSigs={...base,evmSignature:await account.signMessage({message:msg}),
    observerSignature:await observer.signMessage({message:msg})};
  const verified=await verifyWalletAcceptance(withSigs,true,true);
  assert.equal(verified.verified,true); // Only test inputs: provided reviewer flag and account flag.
  assert.equal((await verifyWalletAcceptance(withSigs,true,false)).verified,false);
  assert.equal((await verifyWalletAcceptance(withSigs,false,true)).verified,false);
  assert.equal((await verifyWalletAcceptance({...withSigs,evmSignature:withSigs.observerSignature},true,true)).verified,false);
  assert.match(verified.warning,/NOT cryptographically prove/);
  assert.throws(()=>walletAcceptanceStatement({...base,stagingOrigin:"http://unprotected.test"}),/HTTPS/);
  assert.throws(()=>walletAcceptanceStatement({...base,observerAddress:account.address}),/Different/);
  assert.throws(()=>walletAcceptanceStatement({...base,capturedAt:"2022-01-01T00:00:00Z"}),/30 minutes/);
});
