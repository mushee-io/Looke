import assert from "node:assert/strict";
import {test} from "node:test";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex,verifyMessage} from "viem";
import {signInMessage} from "../src/lib/social/validation";
import {
 M21_GATES,gate,defaultM21Gates,replaceM21Gate,
 assembleM21Report,releaseFlagsClosed,
} from "../src/lib/ops/m21-acceptance";
import {
 uploadDraft,createUploadAuthorization,verifyProviderAsset,
} from "../src/lib/social/upload-provider";
import {parseAssetLookup} from "../src/lib/experience/assets";
import {buildRpcEvidence} from "../src/lib/ops/m8-probe";

const src=(path:string)=>readFileSync(resolve(path),"utf8");
test("M21 requires every gate exactly once and never certifies beta by tests alone",()=>{
 const report=assembleM21Report(defaultM21Gates(),new Date("2026-11-05T08:00:00Z"));
 assert.equal(report.required,18);
 assert.deepEqual(report.blocked,M21_GATES);
 assert.equal(report.status,"blocked");
 assert.equal(report.verified,0);
 assert.equal(report.publicBetaOpen,false);
 assert.equal(report.financialBroadcastEnabled,false);
 assert.equal(report.privateMessagingEnabled,false);
 assert.equal(report.tokenClaimsEnabled,false);
 assert.equal(report.transactionsSent,0);
 assert.throws(()=>assembleM21Report([]));
 assert.throws(()=>assembleM21Report([...defaultM21Gates(),defaultM21Gates()[0]]));
 assert.throws(()=>gate("ultraEvmReadOnlyHead","verified","test-only pass"));
 const partial=replaceM21Gate(defaultM21Gates(),gate("ultraEvmReadOnlyHead","verified",
  "Real read-only Ultra Testnet head observed.","0x"+"a".repeat(64)));
 const incomplete=assembleM21Report(partial);
 assert.equal(incomplete.status,"blocked");
 assert.equal(incomplete.verified,1);
});
test("All protected Preview flags remain fail-closed including missing ones",()=>{
 assert.equal(releaseFlagsClosed({}),true);
 assert.equal(releaseFlagsClosed({
  LOOKE_PUBLIC_BETA_ENABLED:"false",LOOKE_M4_TRADING_ENABLED:"false",
  LOOKE_SOCIAL_WRITES_ENABLED:"false",LOOKE_MEDIA_UPLOADS_ENABLED:"false",
  LOOKE_POINTS_ACCOUNTING_ENABLED:"false",LOOKE_M20_INDEX_WRITES_ENABLED:"false",
 }),true);
 for(const key of [
  "LOOKE_PUBLIC_BETA_ENABLED","LOOKE_M4_TRADING_ENABLED",
  "LOOKE_SOCIAL_WRITES_ENABLED","LOOKE_MEDIA_UPLOADS_ENABLED",
  "LOOKE_POINTS_ACCOUNTING_ENABLED","LOOKE_M20_INDEX_WRITES_ENABLED",
 ])assert.equal(releaseFlagsClosed({[key]:"true"}),false);
});
test("Ephemeral local test wallet signs a wallet-scoped, nonfinancial, origin-bound challenge",async()=>{
 // CI-only random key is never stored, used on Testnet or supplied to operator scripts.
 const wallet=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const attacker=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const issued="2026-11-05T08:00:00.000Z";
 const expires="2026-11-05T08:05:00.000Z";
 const args={origin:"https://looke.example",address:wallet.address.toLowerCase(),
  nonce:randomBytes(16).toString("hex"),issued,expires};
 const message=signInMessage(args);
 assert.match(message,/Network: Ultra EVM Testnet \(18881\)/);
 assert.match(message,/cannot move funds or authorize transactions/);
 const signature=await wallet.signMessage({message});
 assert.equal(await verifyMessage({address:wallet.address,message,signature}),true);
 assert.equal(await verifyMessage({address:attacker.address,message,signature}),false);
 assert.notEqual(signInMessage({...args,origin:"https://another.example"}),message);
 assert.notEqual(signInMessage({...args,nonce:randomBytes(16).toString("hex")}),message);
});
test("M21 secure upload proofs bind file kind, size, provider URL and wallet",()=>{
 const config={cloudName:"lookecloud",apiKey:"12345678901234",
  apiSecret:"ci-secret-not-production-xxxxxxxxxxxxxx"};
 const owner="0x"+"a".repeat(40),other="0x"+"b".repeat(40);
 const draft=uploadDraft.parse({kind:"image",mime:"image/png",bytes:4096});
 const signed=createUploadAuthorization(config,owner,draft,1793862000);
 const asset={public_id:signed.publicId,asset_id:"ciassetid1234567890123456789",
  resource_type:"image",type:"upload",bytes:4096,format:"png",
  secure_url:"https://res.cloudinary.com/lookecloud/image/upload/v77/"+signed.publicId+".png"};
 assert.equal(verifyProviderAsset({config,asset,publicId:signed.publicId,
  draft,expectedOwner:owner}).url,asset.secure_url);
 for(const change of [{...asset,bytes:5120},{...asset,resource_type:"video"},
  {...asset,secure_url:"https://cdn.invalid/"+signed.publicId+".png"}]){
  assert.throws(()=>verifyProviderAsset({config,asset:change,publicId:signed.publicId,
   draft,expectedOwner:owner}));
 }
 assert.throws(()=>verifyProviderAsset({config,asset,publicId:signed.publicId,
  draft,expectedOwner:other}));
 assert.throws(()=>uploadDraft.parse({kind:"image",mime:"image/png",bytes:5000001}));
});
test("Chain references reject malformed or cross-network claims without inventing ownership",()=>{
 assert.throws(()=>parseAssetLookup(new URLSearchParams("kind=token&id=fake")));
 assert.throws(()=>parseAssetLookup(new URLSearchParams("kind=token&id=0x"+"0".repeat(40))));
 assert.throws(()=>parseAssetLookup(new URLSearchParams("kind=uniq&id=0&account=ultraacct1")));
 assert.throws(()=>parseAssetLookup(new URLSearchParams("kind=uniq&id=42&account=INVALID")));
 const invalid=buildRpcEvidence(
  {status:"verified",chainId:1,headBlock:"123",headHash:"0x"+"a".repeat(64),
   headTimestamp:1793862000,reason:"test"}, 
  {status:"blocked",reason:"No native RPC"},null,new Date("2026-11-05T08:00:00Z"));
 assert.equal(invalid.evm.status,"blocked");
 assert.equal(invalid.allVerified,false);
});
test("M21 security entrypoints are read-only and require a real signed moderator session",()=>{
 const route=src("src/app/api/social/ops/acceptance/route.ts");
 assert.match(route,/requireViewer\(req\)/);
 assert.match(route,/assertModerator\(actor\)/);
 assert.match(route,/reconcileApproved\(connection,40\)/);
 assert.match(route,/collectLiveRpcEvidence/);
 assert.match(route,/probeProtectedStaging/);
 assert.match(route,/fetchProviderAsset/);
 assert.match(route,/LOOKE_M21_PREVIEW_URL/);
 assert.ok(!route.includes("export async function POST"));
 const probe=src("scripts/m21-acceptance.ts");
 for(const symbol of ["inspectEvmFactory","inspectEvmCoin","inspectNativeUniq",
  "collectLiveRpcEvidence","probeProtectedStaging"]){
  assert.ok(probe.includes(symbol));
 }
 for(const code of [route,probe]){
  assert.ok(!code.includes("eth_sendTransaction"));
  assert.ok(!code.includes("claimRewards("));
  assert.ok(!code.includes("mintToken("));
  assert.ok(!code.includes("setInterval("));
 }
 const safety=src(".github/workflows/m21-testnet-security-acceptance.yml");
 assert.match(safety,/LOOKE_PUBLIC_BETA_ENABLED: "false"/);
 assert.match(safety,/LOOKE_SOCIAL_WRITES_ENABLED: "false"/);
 assert.match(safety,/LOOKE_POINTS_ACCOUNTING_ENABLED: "false"/);
});
