import test from "node:test";
import assert from "node:assert/strict";
import { canonicalCreatorHandle, normalizeCreatorProfile, creatorProfilePath } from "../lib/creator-profile.mjs";

test("canonical creator handles are stable, lowercase, and safe for URLs",()=>{
  assert.equal(canonicalCreatorHandle("  My_Creator77 "), "my_creator77");
  assert.equal(canonicalCreatorHandle("AAa"), "aaa");
  for(const value of ["ad","1bad","bob!", "has space", "looke","ADMIN","support","api","a".repeat(31),null,{}]){
    assert.equal(canonicalCreatorHandle(value),null);
  }
  assert.equal(creatorProfilePath("Hello_7"),"/creators/hello_7");
  assert.throws(()=>creatorProfilePath(".."),/Invalid/);
});

test("profile edits trim values, permit multiline bios and do not mutate input",()=>{
  const input={handle:"  AlIce_9 ",displayName:"  Alice Wonderland  ",bio:"  Building on Ultra\r\nCreator community  "};
  assert.deepEqual(normalizeCreatorProfile(input),{handle:"alice_9",displayName:"Alice Wonderland",bio:"Building on Ultra\nCreator community"});
  assert.equal(input.handle,"  AlIce_9 ");
});

test("reject unsafe profile payloads and oversize text",()=>{
  const base={handle:"alice_9",displayName:"Alice",bio:"Hi"};
  for(const value of [null,[],undefined,{...base,handle:"admin"},{...base,bio:"x".repeat(281)},
    {...base,displayName:"x".repeat(81)}, {...base,bio:"text\u0000file"},
    {...base,displayName:"bad\u001b[0m"}, {...base,displayName:5}]){
    assert.throws(()=>normalizeCreatorProfile(value),/profile/);
  }
  assert.deepEqual(normalizeCreatorProfile({...base,displayName:"",bio:""}),{handle:"alice_9",displayName:"",bio:""});
});
