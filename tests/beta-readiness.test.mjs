import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {summarizeBetaReadiness,assessWalletObservation,LOOKE_BETA_CHAIN_ID} from "../lib/beta-readiness.mjs";

const alice="0x1111111111111111111111111111111111111111";
const bob="0x2222222222222222222222222222222222222222";
test("M22 public beta never self-authorizes, even when RPC has confirmed a head",()=>{
 const healthy=summarizeBetaReadiness({chainId:18881,head:300n,
  externalSecurityAuditAccepted:true,tradingEnabled:true,publicBetaOpen:true});
 assert.equal(healthy.chainId,LOOKE_BETA_CHAIN_ID);
 assert.equal(healthy.observation.state,"rpc_reachable");
 assert.equal(healthy.observation.observedBlock,"300");
 assert.equal(healthy.observation.observedBlockFinal,false);
 for(const key of ["publicBetaOpen","protectedStagingAccepted","realUserWalletAcceptanceVerified",
  "externalSecurityAuditAccepted","issuerOperational","nativeUniqAccepted",
  "publicIssuanceEnabled","publicTradingEnabled","mainnetReady","approvalEligible"])
  assert.equal(healthy[key],false,key+" must stay false");
 assert.equal(healthy.mode,"preview_only");
 assert.equal(healthy.requiredGates.length,6);
 assert(healthy.requiredGates.every(g=>g.state==="external_evidence_required"));
 assert(healthy.sourceModules.some(m=>m.id==="trading"&&m.state==="disabled"));
});
test("M22 missing, wrong-chain and invalid RPC observations cannot be advertised as available",()=>{
 for(const value of [null,{}, {chainId:1,head:100n},
  {chainId:18881,head:0n},{chainId:18881,head:-1n},
  {chainId:18881,head:"100"},{chainId:18881,head:Infinity}]) {
  const s=summarizeBetaReadiness(value);
  assert.equal(s.publicBetaOpen,false);
  assert.equal(s.observation.observedBlock,null);
  assert.equal(s.observation.state,"unavailable_or_wrong_chain");
 }
});
test("M22 wallet observations match chain, account and social session but never prove signing",()=>{
 const matched=assessWalletObservation({
  chainId:"0x49c1",accounts:[alice],connectedAddress:alice,
  sessionAddress:alice.toUpperCase().replace(/^0X/,"0x")
 });
 assert.equal(matched.networkMatch,true);
 assert.equal(matched.matchesConnectedWallet,true);
 assert.equal(matched.matchesSignedInSession,true);
 assert.equal(matched.status,"session_matches_wallet");
 assert.equal(matched.walletControlCryptographicallyVerified,false);
 assert.equal(matched.nativeWalletVerified,false);
 assert.equal(matched.betaApproved,false);
 for(const [value,expected] of [
  [{chainId:"0x1",accounts:[alice],connectedAddress:alice,sessionAddress:alice},"wrong_network"],
  [{chainId:"0x49c1",accounts:[],connectedAddress:alice,sessionAddress:alice},"reconnect_required"],
  [{chainId:"0x49c1",accounts:[alice],connectedAddress:bob,sessionAddress:alice},"reconnect_required"],
  [{chainId:"0x49c1",accounts:[alice],connectedAddress:alice,sessionAddress:bob},"session_wallet_mismatch"],
  [{chainId:"0x49c1",accounts:[alice],connectedAddress:alice,sessionAddress:null},"login_required"],
  [{chainId:"0x49c1",accounts:["not-an-address"],connectedAddress:alice,sessionAddress:alice},"reconnect_required"]
 ]) {
  const actual=assessWalletObservation(value);
  assert.equal(actual.status,expected);
  assert.equal(actual.betaApproved,false);
 }
});
test("M22 public API and beta wallet UI are strictly read-only, no secret values or execution paths",()=>{
 const route=fs.readFileSync("app/api/beta/status/route.ts","utf8");
 const ui=fs.readFileSync("components/TestnetBetaHub.tsx","utf8");
 const app=fs.readFileSync("app/page.tsx","utf8");
 assert.match(route,/summarizeBetaReadiness/);
 assert.match(route,/no-store/);
 assert.match(route,/export async function GET/);
 assert.doesNotMatch(route,/process\.env|operatorAuthorized|Authorization:|privateKeyToAccount|\.writeContract|sendTransaction/);
 assert.match(ui,/"eth_accounts"/);
 assert.match(ui,/"eth_chainId"/);
 assert.doesNotMatch(ui,/eth_requestAccounts|personal_sign|eth_sendTransaction|wallet_switchEthereumChain|privateKeyToAccount|signTypedData|\.writeContract/);
 assert.match(app,/label="Testnet beta"/);
 assert.match(app,/page === "beta"/);
 assert.match(ui,/publicBetaOpen!==false/);
 assert.match(ui,/publicTradingEnabled!==false/);
 assert.match(ui,/publicIssuanceEnabled!==false/);
 assert.match(ui,/mainnetReady!==false/);
 assert.match(ui,/Public financial beta: closed/);
});
