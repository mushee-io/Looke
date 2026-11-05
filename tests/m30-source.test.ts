import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {m30ConfigPreflight,m30AcceptanceReport,m30ReleaseFlagsClosed,
 M30_CATEGORIES,M30_EXPECTED_PRODUCTION} from "../src/lib/beta/m30-operator-readiness";
import {GET as configGET} from "../src/app/api/experience/m30-readiness/route";
test("No real connected source or secret yields precise missing-credential blockers, never fabricated proof",()=>{
 const x=m30ConfigPreflight({});
 assert.equal(x.canQueryExistingPostgreSQL,false);
 assert.equal(x.canAttemptRealProviderInspection,false);
 assert.equal(x.canAttemptSeparateTLSRecovery,false);
 assert.equal(x.exactImmutablePreviewIdentityConfigured,false);
 assert.ok(x.missingEnvironmentKeys.includes("DATABASE_URL"));
 assert.ok(x.missingEnvironmentKeys.includes("LOOKE_CLOUDINARY_API_SECRET"));
 assert.ok(x.missingEnvironmentKeys.includes("LOOKE_M27_RESTORE_DATABASE_URL"));
 assert.equal(x.releaseFlagsClosed,true);
 assert.equal(x.launchDecision,"NO_GO");
 const r=m30AcceptanceReport({});
 assert.equal(r.steps.length,8);
 assert.equal(r.technicallyVerifiedCount,0);
 assert.equal(r.humanAcceptanceVerifiedCount,0);
 assert.equal(r.releaseDecision,"NO_GO");
 assert.equal(r.publicBetaOpen,false);
 assert.equal(r.productionPromotionAllowed,false);
 assert.equal(r.financialBroadcastAllowed,false);
 assert.equal(r.socialMediaWritesAllowed,false);
 assert.equal(r.tokenMintOrClaimAllowed,false);
 assert.equal(r.privateMessagingAllowed,false);
 assert.equal(r.transactionsSent,0);
});
test("Even ALL eight genuine technical observations do not establish distinct people or unlock launch",()=>{
 const env={
  DATABASE_URL:"postgres://operator@source.invalid/db",
  LOOKE_M27_RESTORE_DATABASE_URL:"postgres://operator@independent-restore.invalid/db",
  LOOKE_CLOUDINARY_CLOUD_NAME:"configured",LOOKE_CLOUDINARY_API_KEY:"present",
  LOOKE_CLOUDINARY_API_SECRET:"present",LOOKE_M29_SECURITY_REVIEWERS:"0xabc",
  LOOKE_M29_OPERATOR_REVIEWERS:"0xdef",VERCEL_TOKEN:"provided",
  LOOKE_M23_PREVIEW_ORIGIN:"https://looke-m30-preview.vercel.app",
  VERCEL_GIT_COMMIT_SHA:"a".repeat(40),
 };
 const observed=Object.fromEntries(M30_CATEGORIES.map(id=>[id,{observed:true,sourceVerified:true}]));
 const v=m30AcceptanceReport(env,observed);
 assert.equal(v.technicallyVerifiedCount,8);
 assert.equal(v.humanAcceptanceVerifiedCount,0);
 assert.equal(v.distinctRealHumanWitnessesAccepted,false);
 assert.equal(v.externalAuditorFindingsApproved,false);
 assert.equal(v.operatorAndSecurityReleaseSignoffAccepted,false);
 assert.equal(v.releaseDecision,"NO_GO");
 assert.equal(v.publicBetaOpen,false);
 assert.equal(v.configuration.exposedCredentialValues,false);
 assert.deepEqual(v.configuration.missingEnvironmentKeys,[]);
 const json=JSON.stringify(v);
 assert.ok(!json.includes("postgres://operator"));
 assert.ok(!json.includes("LOOKE_M29_SECURITY_REVIEWERS:0xabc"));
});
test("One unsafe release flag or market JSON fails closed independent of external files",()=>{
 assert.equal(m30ReleaseFlagsClosed({LOOKE_PUBLIC_BETA_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_M4_TRADING_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_SOCIAL_WRITES_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_MEDIA_UPLOADS_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_POINTS_ACCOUNTING_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_M23_ACCEPTANCE_WRITES_ENABLED:"true"}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_M4_MARKETS_JSON:'[{"enabled":true}]'}),false);
 assert.equal(m30ReleaseFlagsClosed({LOOKE_PUBLIC_BETA_ENABLED:"false",LOOKE_M4_MARKETS_JSON:"[]"}),true);
 const v=m30AcceptanceReport({LOOKE_PUBLIC_BETA_ENABLED:"true"});
 assert.equal(v.configuration.releaseFlagsClosed,false);
 assert.equal(v.releaseDecision,"NO_GO");
});
test("No-auth config route cannot disclose credentials or serve production",async()=>{
 const initial=process.env.VERCEL_ENV;
 process.env.VERCEL_ENV="production";
 try{
  const r=await configGET();assert.equal(r.status,404);
  const s=JSON.stringify(await r.json());
  assert.ok(!s.includes("DATABASE_URL"));
 }finally{
  if(initial===undefined)delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV=initial;
 }
 assert.ok(M30_EXPECTED_PRODUCTION.startsWith("dpl_"));
});
test("Actual source endpoints are read only, no external approval or financial write path",()=>{
 const source=readFileSync(resolve("src/app/api/social/ops/m30/route.ts"),"utf8");
 const publicRoute=readFileSync(resolve("src/app/api/experience/m30-readiness/route.ts"),"utf8");
 const cli=readFileSync(resolve("scripts/m30-operator-acceptance.ts"),"utf8");
 for(const marker of ["requireViewer(req)","assertModerator(user)","readM29(req)",
  "m30AcceptanceReport","externalHumanSecurityAndOperatorApproval:false",
  "realBackupRestoredByThisAPI:false"]){
  assert.ok(source.includes(marker),marker);
 }
 assert.ok(!source.includes("export async function POST("));
 assert.ok(!publicRoute.includes("process.env.DATABASE_URL!")&&!publicRoute.includes("requireViewer(req)"));
 for(const marker of ["verifyConsumedWalletPair","inspectProviderRows","inspectEvmCoin",
  "inspectNativeUniq","digestM27Database","compareM27Databases",
  "reconcileEntirePointsLedger","verifyM29Packet","method:\"GET\"","m30AcceptanceReport"]){
  assert.ok(cli.includes(marker),marker);
 }
 for(const forbidden of ["writeContract(","eth_sendTransaction","request_rollback(","setInterval("]){
  assert.ok(!cli.includes(forbidden)&&!source.includes(forbidden));
 }
});
