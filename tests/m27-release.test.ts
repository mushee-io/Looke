import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {completeTables} from "../src/lib/beta/m26-acceptance";
import {allM27Tables,compareM27Databases,m27ReleaseRehearsal,
 reconcileEntirePointsLedger,digestM27Database} from "../src/lib/beta/m27-evidence";
import {tables} from "../src/lib/beta/m24-full-restore";

const read=(p:string)=>readFileSync(resolve(p),"utf8");
test("M27 includes all 19 real baseline tables including both M25 and M26 release evidence ledgers",()=>{
 assert.equal(tables.length,17);
 assert.equal(completeTables.length,18);
 assert.equal(allM27Tables.length,19);
 assert.equal(allM27Tables[17][0],"social_beta_release_reviews");
 assert.equal(allM27Tables[18][0],"social_beta_release_witnesses");
 const valid=allM27Tables.map(([table])=>({table,rows:1,sha256:"a".repeat(64),
  schemaSha256:"b".repeat(64),complete:true as const}));
 assert.equal(compareM27Databases(valid,valid.map(x=>({...x}))).comparison,"MATCHED_FULL_ROWS");
 assert.equal(compareM27Databases(valid,valid.slice(0,-1)).comparison,"MISMATCH");
 const changed=valid.map(x=>x.table==="social_beta_release_witnesses"?
  {...x,sha256:"c".repeat(64)}:x);
 assert.deepEqual(compareM27Databases(valid,changed).differences,
  [{table:"social_beta_release_witnesses",reason:"full_row_digest_mismatch"}]);
 assert.equal(compareM27Databases(valid,valid.map((x,i)=>i===17?
  {...x,schemaSha256:"d".repeat(64)}:x)).comparison,"MISMATCH");
});
test("M27 release remains NO-GO even if all technical observations are artificially passed",()=>{
 const actual=m27ReleaseRehearsal({flagsClosed:true,publicBetaFlag:false,
  realKeyCount:2,roleWallets:["0xa".padEnd(42,"a"),"0xb".padEnd(42,"b")],
  providerStatus:"verified",pointsComplete:true,pointsIssues:0,recoveryMatches:true,
  humanRestoreWitness:true,externalAuditContentApproved:true,
  independentlyWitnessedHumans:true,assetsVerified:true,
  productionAliasMatches:true,incidentDrillObserved:true});
 assert.deepEqual(actual.blockers,[]);
 assert.equal(actual.decision,"NO_GO");
 assert.equal(actual.publicBetaOpen,false);
 assert.equal(actual.allowProductionPromotion,false);
 assert.equal(actual.allowSocialWrites,false);
 assert.equal(actual.allowMediaWrites,false);
 assert.equal(actual.allowPointsAccounting,false);
 assert.equal(actual.allowTokenMinting,false);
 assert.equal(actual.allowTokenClaims,false);
 assert.equal(actual.allowFinancialBroadcast,false);
 assert.equal(actual.allowPrivateMessaging,false);
 assert.equal(actual.humanReleaseAuthorizationAccepted,false);
 assert.equal(actual.transactionsSent,0);
 const absent=m27ReleaseRehearsal({flagsClosed:false,publicBetaFlag:true,
  realKeyCount:0,roleWallets:[],providerStatus:null,pointsComplete:false,pointsIssues:3,
  recoveryMatches:false,humanRestoreWitness:false,externalAuditContentApproved:false,
  independentlyWitnessedHumans:false,assetsVerified:false,
  productionAliasMatches:false,incidentDrillObserved:false});
 assert.ok(absent.blockers.length>=10);
 assert.equal(absent.decision,"NO_GO");
});
test("Complete Points scan is capped and requires a genuine read-only PostgreSQL client",async()=>{
 await assert.rejects(()=>reconcileEntirePointsLedger({query:async()=>({rows:[],rowCount:0})} as never,
  {batchSize:0}),/Invalid bounded/);
 await assert.rejects(()=>reconcileEntirePointsLedger({query:async()=>({rows:[],rowCount:0})} as never,
  {maxRows:200001}),/Invalid bounded/);
 assert.equal(typeof digestM27Database,"function");
});
test("Read-only external verifier does not advertise any financial, release or social mutation",()=>{
 const api=read("src/app/api/social/ops/m27/route.ts");
 const cli=read("scripts/m27-readonly-release-rehearsal.ts");
 const audit=read("scripts/m27-full-restore-audit.ts");
 for(const required of ["requireViewer(req)","assertModerator(actor)","m26ReadOnly(req)",
  "reconcileEntirePointsLedger","social_beta_release_witnesses",
  "social_beta_release_reviews","social_beta_evidence_signatures",
  "m27ReleaseRehearsal","releaseDecision:\"NO_GO\""]){
  assert.ok(api.includes(required),"Must include "+required);
 }
 assert.ok(!api.includes("export async function POST("));
 for(const forbidden of ["eth_sendTransaction","writeContract(","request_rollback","setInterval("]){
  assert.ok(!api.includes(forbidden));
  assert.ok(!cli.includes(forbidden));
 }
 assert.ok(cli.includes('method:"GET"'));
 assert.ok(cli.includes("dpl_29EdVrfrJNTC5Q7gkZMcpaxLhQiG"));
 assert.ok(audit.includes("digestM27Database(c,true)"));
 assert.ok(audit.includes("validateFullRestorePair"));
});
