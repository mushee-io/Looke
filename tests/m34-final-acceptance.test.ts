import assert from "node:assert/strict";
import {test} from "node:test";
import {assessM34Acceptance} from "../src/lib/beta/m34-final-acceptance";
test("M34 stays closed without independent sources",()=>{
 const r=assessM34Acceptance({flags:{LOOKE_PUBLIC_BETA_ENABLED:"false"},
  media:{enabled:false,moderationRequired:true},
  messaging:{transport:"disabled",messagesSent:0}});
 assert.equal(r.milestone,"M34_FINAL");
 assert.equal(r.releaseDecision,"NO_GO");
 assert.equal(r.publicBetaOpen,false);
 assert.equal(r.gates.length,17);
 assert.equal(r.technicalVerified,3);
 assert.equal(r.originalHumanApprovals,0);
 assert.equal(r.transactionsSent,0);
});
test("Even complete technical observations never auto-authorize release",()=>{
 const live={milestone:"M33",mode:"live",releaseDecision:"NO_GO",
  publicBetaOpen:false,flagsClosed:true,liveRPCChecksPerformed:true,
  cloudinaryAssetsQueried:true,
  evm:{verified:true,chainId:18881,latestBlock:"100"},
  native:{verified:true,headBlock:100,irreversibleBlock:99},
  postgres:{verified:true,status:"schema_verified_only",currentTables:19,requiredTables:19},
  hostedMedia:{providerVerified:true,status:"authenticated_prefix_search",matchingLookePrefixAssets:0}};
 const r=assessM34Acceptance({flags:{},live,
  media:{enabled:false,moderationRequired:true},
  messaging:{transport:"disabled",messagesSent:0}});
 assert.equal(r.technicalVerified,7);
 assert.equal(r.releaseDecision,"NO_GO");
 assert.ok(r.blocked.includes("independent_human_release_witnesses"));
 assert.ok(r.blocked.includes("original_creator_coin_receipt"));
 assert.equal(r.gates.every(x=>x.humanApproved===false),true);
});
