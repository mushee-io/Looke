import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {randomBytes,createHash} from "node:crypto";
import {privateKeyToAccount} from "viem/accounts";
import {bytesToHex} from "viem";
import {uploadDraft,signatureFor,createUploadAuthorization,verifyProviderAsset,uploadId} from "../src/lib/social/upload-provider";
import {keyRegistrationStatement,verifyKeyRegistrationSignature,KEY_REGISTRATION_ACCEPTANCE} from "../src/lib/experience/key-registration";
import {findNativeUniq} from "../src/lib/experience/uniq-lookup";

const config={cloudName:"lookecloud",apiKey:"12345678901234",apiSecret:"ci-secret-not-a-live-credential-123456789"};
const actor="0x"+"1".repeat(40);
const image={kind:"image" as const,mime:"image/png" as const,bytes:2048};
const doc=(p:string)=>readFileSync(resolve(p),"utf8");

test("Upload specs reject cross-kind files, oversized images and unapproved media",()=>{
  assert.deepEqual(uploadDraft.parse(image),image);
  assert.throws(()=>uploadDraft.parse({...image,bytes:5000001}),/kind|maximum/i);
  assert.throws(()=>uploadDraft.parse({kind:"image",mime:"video/mp4",bytes:12}));
  assert.throws(()=>uploadDraft.parse({kind:"video",mime:"image/png",bytes:12}));
  assert.throws(()=>uploadDraft.parse({kind:"video",mime:"video/mp4",bytes:20000001}));
  assert.throws(()=>uploadDraft.parse({kind:"image",mime:"image/svg+xml",bytes:99}));
  assert.throws(()=>uploadId.parse("not-a-uuid"));
});

test("Cloudinary signature is deterministic with canonical ordered fields and no secret in returned authorization",()=>{
 const signed=createUploadAuthorization(config,actor,image,1793820000);
 assert.match(signed.uploadUrl,/^https:\/\/api\.cloudinary\.com\/v1_1\/lookecloud\/image\/upload$/);
 assert.match(signed.publicId,new RegExp("^looke/social/"+actor+"/[0-9a-f-]{36}$"));
 assert.equal(signed.parameters.folder,"looke/social/"+actor);
 assert.equal(signed.parameters.overwrite,"false");
 assert.equal(signed.parameters.allowed_formats,"png,jpg,jpeg,webp,gif");
 assert.equal(signed.signature,signatureFor(signed.parameters,config.apiSecret));
 assert.match(signed.signature,/^[a-f0-9]{40}$/);
 assert.equal(signed.apiKey,config.apiKey);
 assert.ok(!JSON.stringify(signed).includes(config.apiSecret));
 const manual=Object.entries(signed.parameters).sort(([a],[b])=>a.localeCompare(b))
   .map(([k,v])=>k+"="+v).join("&");
 assert.equal(signed.signature,createHash("sha1").update(manual+config.apiSecret).digest("hex"));
});

test("Uploaded asset must match signed owner/path, provider, bytes, format and HTTPS resource URL",()=>{
 const signed=createUploadAuthorization(config,actor,image,1793820000);
 const asset={
   public_id:signed.publicId,asset_id:"ciassetid123456789012345678901234",
   resource_type:"image",type:"upload",format:"png",
   bytes:image.bytes,
   secure_url:"https://res.cloudinary.com/lookecloud/image/upload/v123/"+signed.publicId+".png",
 };
 assert.deepEqual(verifyProviderAsset({
   config,asset,publicId:signed.publicId,draft:image,expectedOwner:actor,
 }),{url:asset.secure_url,kind:"image"});
 for(const tampered of [
  {...asset,resource_type:"video"},
  {...asset,bytes:image.bytes+1},
  {...asset,public_id:"looke/social/"+("0x"+"2".repeat(40))+"/other"},
  {...asset,type:"authenticated"},
  {...asset,format:"jpg"},
  {...asset,secure_url:"https://malicious.example/"+signed.publicId+".png"},
  {...asset,secure_url:"http://res.cloudinary.com/lookecloud/image/upload/v123/"+signed.publicId+".png"},
 ]){
  assert.throws(()=>verifyProviderAsset({
   config,asset:tampered,publicId:signed.publicId,draft:image,expectedOwner:actor,
  }));
 }
 assert.throws(()=>verifyProviderAsset({
   config,asset,publicId:signed.publicId,draft:image,expectedOwner:"0x"+"2".repeat(40),
 }));
});

test("Only verified one-time intents can be attached to a post; no client-provided media URL",()=>{
 const route=doc("src/app/api/social/route.ts");
 assert.match(route,/Raw media URLs cannot be posted/);
 assert.match(route,/uploadId\.parse/);
 assert.match(route,/FOR UPDATE/);
 assert.match(route,/state='verified'/);
 assert.match(route,/state='attached'/);
 assert.match(route,/await conn\.query\("ROLLBACK"\)/);
 assert.match(route,/mediaUrl\?"pending":"none"/);
 const upload=doc("src/app/api/experience/media/route.ts");
 assert.match(upload,/verifyRequestOrigin/);
 assert.match(upload,/requireViewer/);
 assert.match(upload,/uploadEnabled\(\)/);
 assert.match(upload,/fetchProviderAsset/);
 assert.match(upload,/verifyProviderAsset/);
 assert.match(upload,/id=\$1 AND owner=\$2/);
 assert.match(upload,/expires_at>now\(\)/);
 const composer=doc("src/app/social/page.tsx");
 assert.match(composer,/authorizeAndUpload/);
 assert.match(composer,/FormData\(\)/);
 assert.match(composer,/Upload file for moderator review/);
 assert.match(composer,/mediaUploadId/);
 assert.ok(!composer.includes('id="looke-hosted-media"'));
});

test("M16 wallet-bound X25519 key statement rejects mismatched signatures, origin and expired nonce",async()=>{
 const user=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const other=privateKeyToAccount(bytesToHex(randomBytes(32)));
 const issued=new Date("2026-11-04T22:00:00.000Z").toISOString();
 const expires=new Date("2026-11-04T22:10:00.000Z").toISOString();
 const value={
   address:user.address,
   origin:"https://looke.example.com",
   publicKey:Buffer.alloc(32,7).toString("base64"),
   version:1,nonce:randomBytes(16).toString("hex"),issuedAt:issued,expiresAt:expires,
 };
 const message=keyRegistrationStatement(value);
 assert.match(message,/NOT a transaction/);
 assert.match(message,/No token transfer or wallet spending/);
 const signed=await user.signMessage({message});
 const now=Date.parse("2026-11-04T22:05:00Z");
 assert.equal(await verifyKeyRegistrationSignature(value,signed,now,value.origin),true);
 assert.equal(await verifyKeyRegistrationSignature(value,signed,now,"https://evil.example"),false);
 assert.equal(await verifyKeyRegistrationSignature(value,signed,Date.parse(expires),value.origin),false);
 const wrong=await other.signMessage({message});
 assert.equal(await verifyKeyRegistrationSignature(value,wrong,now,value.origin),false);
 assert.throws(()=>keyRegistrationStatement({...value,origin:"http://looke.example.com"}),/HTTPS/);
 assert.throws(()=>keyRegistrationStatement({...value,publicKey:"abc"}));
 assert.equal(KEY_REGISTRATION_ACCEPTANCE.registrationApiEnabled,false);
 assert.equal(KEY_REGISTRATION_ACCEPTANCE.messageTransportEnabled,false);
 assert.equal(KEY_REGISTRATION_ACCEPTANCE.securityAuditPassed,false);
});

test("Notification read-state can mutate only current signed-in account; public beta unaffected",()=>{
 const src=doc("src/app/api/experience/notifications/route.ts");
 assert.match(src,/requireViewer\(request\)/);
 assert.match(src,/verifyRequestOrigin\(request\)/);
 assert.match(src,/owner=\$1/);
 assert.match(src,/social_notification_reads/);
 assert.match(src,/GREATEST/);
 const view=doc("src/components/experience/LookeViews.tsx");
 assert.match(view,/markAllRead/);
 assert.match(view,/unreadCount/);
 const readiness=doc("src/app/api/experience/messaging/readiness/route.ts");
 assert.match(readiness,/DM_SECURITY_GATES/);
 assert.ok(!readiness.includes("POST("));
});

test("Bounded native Uniq proof search respects account, finality, safe cursors and non-ownership uncertainty",async()=>{
 const scopes:string[]=[];
 const pages=[
   {rows:[{id:"4",token_factory_id:"1"}],more:true,next_key:"5",irreversibleBlock:123},
   {rows:[{id:"7",token_factory_id:"2"}],more:true,next_key:"8",irreversibleBlock:124},
   {rows:[{id:"9",token_factory_id:"3"}],more:false,next_key:"",irreversibleBlock:125},
 ];
 const reader=async(scope:string,limit:number,cursor?:string)=>{
   assert.equal(limit,50);scopes.push(scope);
   if(cursor===undefined)return pages[0];
   if(cursor==="5")return pages[1];
   return pages[2];
 };
 const found=await findNativeUniq("ultraacct1","7",reader,3);
 assert.equal(found.found?.id,"7");
 assert.equal(found.pages,2);
 assert.equal(found.truncated,false);
 assert.deepEqual(scopes,["ultraacct1","ultraacct1"]);
 const missed=await findNativeUniq("ultraacct1","99",reader,2);
 assert.equal(missed.found,null);
 assert.equal(missed.truncated,true);
 assert.equal(missed.pages,2);
 await assert.rejects(()=>findNativeUniq("INVALID","7",reader,3));
 await assert.rejects(()=>findNativeUniq("ultraacct1","7",reader,100));
});
