import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {assertModerator,controlWrite,discoverySort,preferences,reportDecision} from "../src/lib/social/m18";

function source(path:string){return readFileSync(resolve(path),"utf8");}
const wallet="0x1111111111111111111111111111111111111111";
test("M18 enforces explicit moderator allowlist, case insensitive and fail-closed",()=>{
 const old=process.env.LOOKE_SOCIAL_MODERATORS;
 try{
  delete process.env.LOOKE_SOCIAL_MODERATORS;
  assert.throws(()=>assertModerator(wallet),/Moderator role required/);
  process.env.LOOKE_SOCIAL_MODERATORS="0x2222222222222222222222222222222222222222";
  assert.throws(()=>assertModerator(wallet),/Moderator role required/);
  process.env.LOOKE_SOCIAL_MODERATORS=" "+wallet.toUpperCase()+" ";
  assert.doesNotThrow(()=>assertModerator(wallet));
 }finally{if(old===undefined)delete process.env.LOOKE_SOCIAL_MODERATORS;
   else process.env.LOOKE_SOCIAL_MODERATORS=old;}
});
test("Account settings are restricted to exact notification booleans and actual wallets",()=>{
 const expected={follows:true,comments:false,likes:false,reposts:true};
 assert.deepEqual(preferences.parse(expected),expected);
 assert.equal(controlWrite.parse({action:"mute",target:wallet}).action,"mute");
 assert.throws(()=>controlWrite.parse({action:"transfer",target:wallet}));
 assert.throws(()=>controlWrite.parse({action:"mute",target:"lookedup.example"}));
 assert.throws(()=>preferences.parse({...expected,trades:true}));
 assert.throws(()=>preferences.parse({...expected,likes:"false"}));
});
test("Report resolutions require real UUID, explicit choice and a meaningful reason",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 assert.equal(reportDecision.parse({action:"resolve_report",reportId:id,
  decision:"dismissed",explanation:"No policy violation."}).decision,"dismissed");
 for(const decision of ["auto_hide","approve_media","delete_profile"]){
  assert.throws(()=>reportDecision.parse({action:"resolve_report",reportId:id,decision,explanation:"Reason enough"}));
 }
 assert.throws(()=>reportDecision.parse({action:"resolve_report",reportId:id,
  decision:"actioned",explanation:"no"}));
 assert.throws(()=>reportDecision.parse({action:"resolve_report",reportId:"bad",
  decision:"actioned",explanation:"Reason enough"}));
});
test("Discovery sorting is bounded and never accepts user SQL",()=>{
 assert.deepEqual(discoverySort.options,["recent","engaged"]);
 assert.throws(()=>discoverySort.parse("top;drop table social_posts"));
 assert.throws(()=>discoverySort.parse("paid"));
});
test("Moderator, analytics and controls routes stay authenticated, scoped and audited",()=>{
 const mod=source("src/app/api/social/moderation/route.ts");
 const analytics=source("src/app/api/social/analytics/route.ts");
 const controls=source("src/app/api/social/controls/route.ts");
 const social=source("src/app/api/social/route.ts");
 const notifications=source("src/app/api/experience/notifications/route.ts");
 for(const component of [mod,analytics,controls])assert.match(component,/requireViewer\(req\)/);
 assert.match(mod,/assertModerator\(actor\)/);
 assert.match(mod,/verifyRequestOrigin\(req\)/);
 assert.match(mod,/FOR UPDATE/);
 assert.match(mod,/social_report_resolutions/);
 assert.match(mod,/social_moderation_audit/);
 assert.match(mod,/ROLLBACK/);
 assert.match(mod,/LIMIT 40/);
 assert.match(analytics,/ownerScoped:true/);
 assert.match(analytics,/p\.author=\$1/);
 assert.match(analytics,/media_status='approved'/);
 assert.match(controls,/WHERE m\.muter=\$1/);
 assert.match(controls,/verifyRequestOrigin\(req\)/);
 assert.match(social,/engagement_30d/);
 assert.match(social,/social_mutes/);
 assert.match(notifications,/social_notification_preferences/);
 assert.match(notifications,/social_mutes/);
 assert.ok(!mod.includes("eth_sendTransaction"));
 assert.ok(!analytics.includes("estimatedImpressions"));
});
