import assert from "node:assert/strict";
import { test } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { bytesToHex, verifyMessage } from "viem";
import { address, assetReference, handle, post, profile, report, signInMessage } from "../src/lib/social/validation";

const addr="0x1111111111111111111111111111111111111111";
test("wallet IDs are checksum-safe, nonzero and normalized",()=>{
  assert.equal(address.parse(addr),addr);
  assert.throws(()=>address.parse("0x0"),/Invalid|Valid/);
  assert.throws(()=>address.parse("0x"+"0".repeat(40)),/nonzero/);
});
test("profiles enforce public-name, handle and HTTPS avatar bounds",()=>{
  const result=profile.parse({handle:" CreAtor_01 ",displayName:"Looke Maker",bio:"Hello",avatarUrl:"https://cdn.example.test/avatar.png"});
  assert.equal(result.handle,"creator_01");
  assert.throws(()=>handle.parse("..bad"),/Handle/);
  assert.throws(()=>profile.parse({handle:"creator",displayName:"x",bio:"",avatarUrl:"http://unsafe.test"}),/Avatar/);
  assert.throws(()=>profile.parse({handle:"creator",displayName:"x",bio:"a".repeat(241),avatarUrl:""}),/too_big|240/);
});
test("token and native Uniq references cannot pretend to be on the wrong chain",()=>{
  const token=assetReference.parse({assetType:"token",assetChain:"ultra-evm",assetId:addr});
  const uniq=assetReference.parse({assetType:"uniq",assetChain:"ultra-native",assetId:"1234"});
  assert.equal(token.assetId,addr);
  assert.equal(uniq.assetId,"1234");
  assert.throws(()=>assetReference.parse({assetType:"token",assetChain:"ultra-native",assetId:addr}),/Invalid|literal/);
  assert.throws(()=>assetReference.parse({assetType:"uniq",assetChain:"ultra-native",assetId:"0"}),/Invalid|format/);
});
test("posts and reports are bounded and moderation reason restricted",()=>{
  assert.equal(post.parse({body:"   Hi!   ",asset:null}).body,"Hi!");
  assert.throws(()=>post.parse({body:" ",asset:null}),/too_small|1/);
  assert.throws(()=>post.parse({body:"x".repeat(1001),asset:null}),/too_big|1000/);
  assert.throws(()=>report.parse({targetType:"post",targetId:"00000000-0000-4000-8000-000000000000",reason:"other",details:"x".repeat(501)}),/too_big|500/);
  assert.throws(()=>report.parse({targetType:"post",targetId:"00000000-0000-4000-8000-000000000000",reason:"praise",details:""}),/Invalid|enum/);
});
test("wallet authentication signs only a nonce/domain-bound message, not an approval",async()=>{
  const wallet=privateKeyToAccount(bytesToHex(randomBytes(32)));
  const issued=new Date().toISOString();
  const message=signInMessage({
    origin:"https://looke.example",
    address:wallet.address.toLowerCase(),
    nonce:"abcd1234",
    issued,expires:issued,
  });
  assert.match(message,/Origin: https:\/\/looke.example/);
  assert.match(message,/Nonce: abcd1234/);
  assert.match(message,/cannot move funds/);
  const sig=await wallet.signMessage({message});
  assert.equal(await verifyMessage({address:wallet.address,message,signature:sig}),true);
  assert.equal(await verifyMessage({address:wallet.address,message:message+"tamper",signature:sig}),false);
});
