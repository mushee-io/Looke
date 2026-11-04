import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
 trustedMediaHosts,validatePublishedMedia,visibleApprovedMedia,
} from "../src/lib/social/media";
import {validateEnvelope,DM_SECURITY_GATES} from "../src/lib/experience/dm-envelope";
import {parseAssetLookup} from "../src/lib/experience/assets";
import {post} from "../src/lib/social/validation";

const src=(p:string)=>readFileSync(resolve(p),"utf8");
test("Media is fail-closed without operator-owned hosting; reject SSRF, scripts and unapproved formats",()=>{
 assert.deepEqual(trustedMediaHosts("cdn.looke.xyz,media.looke.xyz,localhost,127.0.0.1,cdn.looke.xyz.evil.test"),
  ["cdn.looke.xyz","media.looke.xyz"]);
 assert.equal(validatePublishedMedia(null,[]),null);
 assert.throws(()=>validatePublishedMedia({url:"https://cdn.looke.xyz/pic.png",kind:"image"},[]),/not configured/);
 const allow=["cdn.looke.xyz"];
 assert.deepEqual(validatePublishedMedia({url:"https://cdn.looke.xyz/pic.png",kind:"image"},allow),{
   url:"https://cdn.looke.xyz/pic.png",kind:"image",
 });
 for(const unsafe of [
   "http://cdn.looke.xyz/pic.png",
   "https://cdn.looke.xyz.evil.com/pic.png",
   "https://127.0.0.1/pic.png",
   "https://evil@cdn.looke.xyz/pic.png",
   "https://cdn.looke.xyz:443/pic.png?token=public",
   "https://cdn.looke.xyz/pic.svg",
 ]){
   assert.throws(()=>validatePublishedMedia({url:unsafe,kind:"image"},allow));
 }
 assert.throws(()=>validatePublishedMedia({url:"https://cdn.looke.xyz/vid.mp4",kind:"image"},allow));
 assert.equal(visibleApprovedMedia({media_url:"https://cdn.looke.xyz/pic.png",media_kind:"image",media_status:"pending"}),null);
 assert.equal(visibleApprovedMedia({media_url:"https://cdn.looke.xyz/pic.png",media_kind:"image",media_status:"rejected"}),null);
 assert.deepEqual(visibleApprovedMedia({media_url:"https://cdn.looke.xyz/pic.png",media_kind:"image",media_status:"approved"}),{
   url:"https://cdn.looke.xyz/pic.png",kind:"image",
 });
});
test("Public social post schema permits only typed media metadata",()=>{
 const data=post.parse({body:"Art on Ultra",asset:null,media:{
   url:"https://cdn.looke.xyz/art.webp",kind:"image",
 }});
 assert.equal(data.media?.kind,"image");
 assert.equal(post.parse({body:"Text only",asset:null}).media,null);
 assert.throws(()=>post.parse({body:"hello",asset:null,media:{url:"javascript:alert(1)",kind:"image"}}));
 assert.throws(()=>post.parse({body:"hello",asset:null,media:{url:"https://cdn.looke.xyz/a.mp4",kind:"executable"}}));
 assert.throws(()=>post.parse({body:"hello",asset:null,media:{url:"https://cdn.looke.xyz/a.png",kind:"image",secret:"x"}}));
});
test("DM envelope contract rejects plaintext, missing nonce and malformed crypto evidence",()=>{
 const valid={version:1,algorithm:"x25519-xsalsa20-poly1305",
  senderKeyVersion:1,recipientKeyVersion:1,
  nonce:Buffer.alloc(24,7).toString("base64"),
  ciphertext:Buffer.alloc(80,9).toString("base64")};
 assert.deepEqual(validateEnvelope(valid),valid);
 assert.throws(()=>validateEnvelope({...valid,plaintext:"hi"}),/No plaintext/);
 assert.throws(()=>validateEnvelope({...valid,nonce:"bad"}),/Invalid encryption/);
 assert.throws(()=>validateEnvelope({...valid,ciphertext:"hi"}),/Invalid encryption/);
 assert.throws(()=>validateEnvelope({...valid,recipientKeyVersion:0}),/Invalid encryption/);
 assert.equal(DM_SECURITY_GATES.liveMessagingEnabled,false);
 assert.equal(DM_SECURITY_GATES.encryptionAudited,false);
 assert.equal(DM_SECURITY_GATES.deviceRecoveryAudited,false);
});
test("Asset lookups cannot confuse EVM creator token and native Uniq owner identity",()=>{
 const token="0x"+"1".repeat(40);
 assert.deepEqual(parseAssetLookup(new URLSearchParams({kind:"token",id:token})),{
   kind:"token",id:token,account:null,
 });
 assert.deepEqual(parseAssetLookup(new URLSearchParams({kind:"uniq",id:"123",account:"ultraacct1"})),{
   kind:"uniq",id:"123",account:"ultraacct1",
 });
 assert.throws(()=>parseAssetLookup(new URLSearchParams({kind:"uniq",id:"123"})));
 assert.throws(()=>parseAssetLookup(new URLSearchParams({kind:"uniq",id:"123",account:"BAD@NAME"})));
 assert.throws(()=>parseAssetLookup(new URLSearchParams({kind:"token",id:"0x"+"0".repeat(40)})));
 assert.throws(()=>parseAssetLookup(new URLSearchParams({kind:"token",id:"hello"})));
});
test("Server-side creator feed search remains bound SQL, moderation-first and no synthetic feeds",()=>{
 const api=src("src/app/api/social/route.ts");
 assert.match(api,/position\(\$4::text in lower\(p\.body\)\)/);
 assert.match(api,/position\(\$4::text in lower\(pr\.handle\)\)/);
 assert.match(api,/media_status='approved'/);
 assert.match(api,/validatePublishedMedia/);
 assert.match(api,/hosted\?"pending":"none"/);
 assert.match(api,/approve_media/);
 assert.match(api,/social_moderation_audit/);
 const profile=src("src/app/api/experience/profile-posts/route.ts");
 assert.match(profile,/LIMIT 13/);
 assert.match(profile,/nextCursor/);
 assert.match(profile,/p\.media_status='approved'/);
});
test("M15 creator interface cannot send DM, mint, fake verified ownership or publish raw selected files",()=>{
 const social=src("src/app/social/page.tsx");
 const views=src("src/components/experience/LookeViews.tsx");
 const assets=src("src/app/api/experience/assets/route.ts");
 const ready=src("src/app/api/experience/messaging/readiness/route.ts");
 assert.match(social,/URL\.createObjectURL\(file\)/);
 assert.match(social,/URL\.revokeObjectURL/);
 assert.match(social,/only a preview/);
 assert.match(social,/AssetEvidence/);
 assert.match(views,/loadMoreProfilePosts/);
 assert.match(views,/loadNotifications/);
 assert.match(views,/search:serverSearch/);
 assert.match(assets,/indexCreatorLaunches/);
 assert.match(assets,/ownedUniqs/);
 assert.match(assets,/not found within this account/);
 assert.match(ready,/liveMessagingEnabled|DM_SECURITY_GATES/);
 assert.ok(!assets.includes("eth_sendTransaction"));
 assert.ok(!ready.includes("sendMessage("));
});
