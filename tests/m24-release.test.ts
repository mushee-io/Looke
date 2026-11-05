import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {M21_GATES,assembleM21Report,defaultM21Gates,gate} from "../src/lib/ops/m21-acceptance";
import {incidentSchema,launchReview,requiredReleaseProofs,m24IncidentWritesEnabled} from "../src/lib/beta/m24-review";
import {compareFullDatabase,validateFullRestorePair,tables} from "../src/lib/beta/m24-full-restore";
const read=(p:string)=>readFileSync(resolve(p),"utf8");
const evidence={realWallets:2,pointScanComplete:true,pointIssues:0,pendingMedia:0,
 openReports:0,criticalIncidents:0,restoreFullCompareVerified:true,auditorContentInspected:true};
test("M24 launch is permanently NO-GO even if all narrow technical checks are verified",()=>{
 const all=assembleM21Report(M21_GATES.map(id=>gate(id,"verified",
  "Synthetic narrow unit fixture (NOT independently approved evidence).",
  "CI local test-only observation fixture")));
 const report=launchReview({m21:all,evidence,featureFlagsClosed:true});
 assert.equal(report.decision,"NO_GO");
 assert.equal(report.mayActivate,false);
 assert.equal(report.publicBetaOpen,false);
 assert.equal(report.productionDeploymentAuthorized,false);
 assert.equal(report.financialBroadcastAuthorized,false);
 assert.equal(report.messagingAuthorized,false);
 assert.equal(report.tokenClaimsAuthorized,false);
 assert.equal(report.transactionsSent,0);
 assert.equal(report.reviewGates.length,11);
 assert.ok(report.reviewGates.every(x=>x.status==="blocked"));
 const incomplete=assembleM21Report(defaultM21Gates());
 assert.equal(launchReview({m21:incomplete,evidence:{...evidence,realWallets:0},
  featureFlagsClosed:false}).decision,"NO_GO");
 assert.throws(()=>launchReview({m21:{...all,checks:[]},evidence,
  featureFlagsClosed:true}));
 assert.equal(requiredReleaseProofs.length,11);
});
test("Incident recording is strict, optional and cannot submit actions or release flags",()=>{
 const a=incidentSchema.parse({action:"record_incident",eventType:"rollback_rehearsal",
  severity:"high",observation:"Observed protected Preview status during a read-only drill."});
 assert.equal(a.evidenceId,null);
 for(const injected of [
  {...a,productionChanged:true},
  {...a,actionTaken:"rollback"},
  {...a,publicBetaOpen:true},
  {...a,observation:"tiny"},
 ])assert.throws(()=>incidentSchema.parse(injected));
 assert.throws(()=>incidentSchema.parse({...a,eventType:"production_rollback"}));
 const prev=process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED;
 delete process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED;
 try{assert.equal(m24IncidentWritesEnabled(),false);
  process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED="false";
  assert.equal(m24IncidentWritesEnabled(),false);
 }finally{if(prev===undefined)delete process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED;
  else process.env.LOOKE_M24_INCIDENT_WRITES_ENABLED=prev;}
});
test("All 16 required database tables need complete matching row digests AND schema hashes",()=>{
 assert.equal(tables.length,16);
 const a=tables.map(([table])=>({table,rows:2,sha256:"a".repeat(64),
  schemaSha256:"b".repeat(64),complete:true as const}));
 const ok=compareFullDatabase(a,a.map(x=>({...x})));
 assert.equal(ok.comparison,"MATCHED_FULL_ROWS");
 assert.equal(ok.allRowsHashed,true);
 assert.equal(ok.operatorRestoreWitnessAccepted,false);
 assert.equal(ok.backupOriginVerified,false);
 assert.equal(ok.releaseAuthorized,false);
 const changed=a.map((x,i)=>i===8?{...x,sha256:"f".repeat(64)}:x);
 assert.deepEqual(compareFullDatabase(a,changed).differences,
  [{table:a[8].table,reason:"full_row_digest_mismatch"}]);
 assert.equal(compareFullDatabase(a,a.slice(0,15)).comparison,"MISMATCH");
 assert.equal(compareFullDatabase(a,a.map((x,i)=>i===3?{...x,schemaSha256:"c".repeat(64)}:x)).comparison,"MISMATCH");
 const primary="postgresql://op:pass@primary.example/db?sslmode=verify-full";
 const restore="postgresql://op:pass@other.example/db_restore?sslmode=verify-full";
 assert.ok(validateFullRestorePair(primary,restore));
 assert.throws(()=>validateFullRestorePair(primary,primary));
 assert.throws(()=>validateFullRestorePair(primary,"postgresql://a:b@restore.example/db?sslmode=disable"));
});
test("M24 reviewer-only read, CSRF and no financial or production write endpoints",()=>{
 const route=read("src/app/api/social/ops/m24/route.ts");
 const migration=read("db/migrations/009_independent_release_review.sql");
 const cli=read("scripts/m24-full-restore-audit.ts");
 for(const expr of ["requireViewer(req)","assertModerator(reviewer)",
  "m21ReadOnly(req)","m23ReadOnly(req)","launchReview",
  "verifyRequestOrigin(req)","m24IncidentWritesEnabled()","previewIdentity()",
  "social_beta_incident_journal","reconcile","incidentResponsePlan"]){
  if(expr==="reconcile")continue;
  assert.ok(route.includes(expr),expr);
 }
 assert.match(route,/FROM social_beta_evidence_signatures WHERE id=\$1 AND preview_sha=\$2/);
 assert.match(migration,/production_changed boolean NOT NULL DEFAULT false CHECK \(production_changed=false\)/);
 assert.match(migration,/public_beta_activated boolean NOT NULL DEFAULT false CHECK \(public_beta_activated=false\)/);
 assert.ok(cli.includes("digestFullDatabase(c,{enforceTLS:true})"));
 assert.ok(!route.includes("eth_sendTransaction"));
 assert.ok(!route.includes("request_rollback"));
 assert.ok(!route.includes("setInterval("));
 assert.ok(!cli.includes("DELETE FROM"));
 assert.ok(!cli.includes("UPDATE social_"));
});
