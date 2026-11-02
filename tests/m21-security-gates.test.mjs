import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {acceptanceGate} from "../lib/testnet-evidence.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("M21 operator receipt verification cannot sign, broadcast, settle or claim assets",()=>{
 const source=read("app/api/operator/testnet/evidence/route.ts");
 const readiness=read("app/api/operator/testnet/readiness/route.ts");
 assert.match(source,/operatorAuthorized\(request,"LOOKE_INDEXER_MONITOR_SECRET"\)/);
 assert.match(source,/checkedIndependentRpc\(/);
 assert.match(source,/corroborateTestnetReceipt\(/);
 assert.match(source,/financialActionAvailable:false/);
 assert.match(source,/tradingEnabled:false/);
 assert.match(readiness,/status:503/);
 assert.doesNotMatch(source,/\.writeContract\(|\.sendTransaction\(|signMessage\(|privateKeyToAccount\(/);
 assert.doesNotMatch(readiness,/\.writeContract\(|\.sendTransaction\(|signMessage\(/);
});
test("new source prevents permissionless reference copying; release still awaits independent audit",()=>{
 const integration=read("tests/creator-coin-contract.test.mjs");
 const factory=read("contracts/LookeCoinFactory.sol");
 assert.match(integration,/A stolen, valid signer approval/);
 assert.match(integration,/Even an attestor-signed second wallet/);
 assert.match(factory,/require\(kind == CREATOR, "ATTESTATION_REQUIRED"\)/);
 assert.match(factory,/SignatureChecker\.isValidSignatureNow\(attestor/);
 assert.match(factory,/referenceCoinFor\[kind\]\[contentRef\] == address\(0\)/);
 assert.match(factory,/request.nonce == authorizationNonces\[msg.sender\]/);
 const release=acceptanceGate();
 assert.equal(release.tradingEnabled,false);
 assert.equal(release.mainnetReady,false);
});
