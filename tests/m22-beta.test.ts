import assert from "node:assert/strict";
import {test} from "node:test";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {createWitnessChallenge,verifyWitness,witnessMessage} from "../src/lib/beta/m22-witness";
import {deriveM22Readiness,REQUIRED_RELEASE_EVIDENCE} from "../src/lib/beta/m22-readiness";
import {validateRestorePair,compareRestoredSnapshots} from "../src/lib/beta/m22-restore";
import {defaultM21Gates,assembleM21Report,M21_GATES,gate} from "../src/lib/ops/m21-acceptance";
const doc=(x:string)=>readFileSync(resolve(x),"utf8");
const commit="a".repeat(40),origin="https://looke-witness.vercel.app";
test("Actual ephemeral EIP-191 key control verifies only the exact short-lived public witness message",async()=>{
 const user=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const stranger=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const at=new Date("2026-11-05T10:00:00.000Z");
 const challenge=createWitnessChallenge({address:user.address,origin,
  previewCommit:commit,now:at});
 assert.match(witnessMessage(challenge),/cannot|No token transfer/);
 const signed=await user.signMessage({message:witnessMessage(challenge)});
 const verified=await verifyWitness({challenge,signature:signed},
  {expectedOrigin:origin,expectedRevision:commit,now:new Date(at.getTime()+50_000)});
 assert.equal(verified.status,"cryptographic-proof-only");
 assert.equal(verified.signatureValid,true);
 assert.equal(verified.walletSessionWitnessAccepted,false);
 assert.equal(verified.operatorReviewed,false);
 assert.equal(verified.replayProtectionProven,false);
 assert.equal(verified.transactionsSent,0);
 assert.equal(verified.proofClass,"signed-public-message-not-onchain-transaction");
 const attacker=await stranger.signMessage({message:witnessMessage(challenge)});
 const impersonation=await verifyWitness({challenge,signature:attacker},
  {expectedOrigin:origin,expectedRevision:commit,now:at});
 assert.equal(impersonation.status,"blocked");
 assert.equal(impersonation.signatureValid,false);
 const otherCommit=await verifyWitness({challenge,signature:signed},{
  expectedOrigin:origin,expectedRevision:"b".repeat(40),now:at,
 });
 assert.equal(otherCommit.status,"blocked");
 assert.equal(otherCommit.correctPreviewCommit,false);
 const otherOrigin=await verifyWitness({challenge,signature:signed},{
  expectedOrigin:"https://attacker.vercel.app",expectedRevision:commit,now:at,
 });
 assert.equal(otherOrigin.status,"blocked");
 assert.equal(otherOrigin.correctPreviewOrigin,false);
 const expired=await verifyWitness({challenge,signature:signed},{
  expectedOrigin:origin,expectedRevision:commit,now:new Date(at.getTime()+300001),
 });
 assert.equal(expired.withinFiveMinuteWindow,false);
 assert.equal(expired.status,"blocked");
 const altered=await verifyWitness({challenge:{...challenge,nonce:"b".repeat(32)},
  signature:signed},{expectedOrigin:origin,expectedRevision:commit,now:at});
 assert.equal(altered.signatureValid,false);
});
test("Witness challenge rejects wrong origin, oversize duration, wrong chain or unrelated signed scopes",async()=>{
 const person=privateKeyToAccount(bytesToHex(randomBytes(32)));
 assert.throws(()=>createWitnessChallenge({address:person.address,
  origin:"http://unsafe.example",previewCommit:commit}));
 assert.throws(()=>createWitnessChallenge({address:person.address,
  origin,previewCommit:"short"}));
 const c=createWitnessChallenge({address:person.address,origin,previewCommit:commit,
  now:new Date("2026-11-05T10:00:00.000Z")});
 const s=await person.signMessage({message:witnessMessage(c)});
 await assert.rejects(()=>verifyWitness({challenge:{...c,network:"Ultra mainnet"},signature:s},
  {expectedOrigin:origin,expectedRevision:commit,now:new Date(c.issuedAt)}));
 await assert.rejects(()=>verifyWitness({challenge:{...c,scope:"transfer-usdc"},signature:s},
  {expectedOrigin:origin,expectedRevision:commit,now:new Date(c.issuedAt)}));
 const long={...c,expiresAt:new Date(Date.parse(c.issuedAt)+600000).toISOString()};
 const a=await verifyWitness({challenge:long,signature:s},{
  expectedOrigin:origin,expectedRevision:commit,now:new Date(c.issuedAt),
 });
 assert.equal(a.status,"blocked");
 assert.equal(a.withinFiveMinuteWindow,false);
});
test("Release policy stays NO-GO even with all narrowly verified technical checks",()=>{
 const defaultReport=assembleM21Report(defaultM21Gates());
 const initial=deriveM22Readiness({m21:defaultReport,flagsClosed:true});
 assert.equal(initial.releaseDecision,"NO_GO");
 assert.equal(initial.mayActivate,false);
 assert.equal(initial.publicBetaOpen,false);
 assert.equal(initial.blockers,M21_GATES.length+REQUIRED_RELEASE_EVIDENCE.length);
 const nominal=assembleM21Report(M21_GATES.map(id=>
  gate(id,"verified","Narrow source check in isolated local fixture.","CI-only fixture; not live acceptance")));
 const forever=deriveM22Readiness({m21:nominal,flagsClosed:true,
  restoredDbIndependentlySignedOff:true,humanSignedBetaAuthorization:true});
 assert.equal(forever.releaseDecision,"NO_GO");
 assert.equal(forever.requiredWitnesses.length,9);
 assert.equal(forever.publicBetaOpen,false);
 assert.equal(forever.financialTransactionsEnabled,false);
 assert.equal(forever.pointsClaimsEnabled,false);
 assert.equal(forever.privateMessagingEnabled,false);
 const unsafe=deriveM22Readiness({m21:defaultReport,flagsClosed:false});
 assert.ok(unsafe.blockers>initial.blockers);
 assert.throws(()=>deriveM22Readiness({m21:{...defaultReport,checks:[]},flagsClosed:true}));
});
test("Restore audit rejects same DB, unverified TLS and missing separate restore",()=>{
 const a="postgresql://operator:password@primary.local:5432/looke?sslmode=verify-full";
 const b="postgresql://operator:password@restore.local:5432/looke_restore?sslmode=verify-full";
 const c=validateRestorePair(a,b);
 assert.equal(c.primaryDatabase,"looke");
 assert.equal(c.restoredDatabase,"looke_restore");
 assert.throws(()=>validateRestorePair(a,a),/independently addressable/);
 assert.throws(()=>validateRestorePair(a,undefined),/required/);
 assert.throws(()=>validateRestorePair(a,"postgresql://test:pass@restore.local/db?sslmode=disable"),/TLS-verified/);
 const primary=[{table:"social_posts",rows:"2",sampleDigest:"first",sampleSize:2},
  {table:"social_points_ledger",rows:"1",sampleDigest:"second",sampleSize:1}];
 const matching=compareRestoredSnapshots(primary,primary.map(x=>({...x})));
 assert.equal(matching.status,"sample_matched");
 assert.equal(matching.independentRestoreWitness,false);
 assert.equal(matching.backupProvenanceValidated,false);
 assert.equal(matching.fullRowHashCoverage,false);
 const changed=compareRestoredSnapshots(primary,[primary[0],
  {...primary[1],sampleDigest:"tampered"}]);
 assert.equal(changed.status,"needs_operator_review");
 assert.equal(changed.drift[0].table,"social_points_ledger");
});
test("M22 beta ops rejects public reads and does not create financial or release endpoints",()=>{
 const beta=doc("src/app/api/social/ops/beta/route.ts");
 const witness=doc("src/app/api/social/ops/beta/witness/route.ts");
 const restore=doc("scripts/m22-restore-audit.ts");
 const unit=doc("scripts/m22-preflight.ts");
 assert.match(beta,/requireViewer\(req\)/);
 assert.match(beta,/assertModerator\(reviewer\)/);
 assert.match(beta,/deriveM22Readiness/);
 assert.match(beta,/inspectEvmCoin/);
 assert.match(beta,/inspectNativeUniq/);
 assert.match(beta,/p\.hidden=false AND p\.deleted_at IS NULL/);
 assert.match(witness,/verifyRequestOrigin\(req\)/);
 assert.match(witness,/assertModerator\(reviewer\)/);
 assert.match(doc("src/lib/beta/m22-witness.ts"),/walletSessionWitnessAccepted:false/);
 assert.match(restore,/auditReadOnlySnapshot/);
 assert.match(unit,/releaseDecision/);
 assert.ok(!beta.includes("export async function POST"));
 for(const src of [beta,witness,restore,unit]){
  assert.ok(!src.includes("eth_sendTransaction"));
  assert.ok(!src.includes("walletClient.writeContract"));
  assert.ok(!src.includes("mintToken("));
  assert.ok(!src.includes("claimRewards("));
  assert.ok(!src.includes("setInterval("));
 }
});
