import test from "node:test";
import assert from "node:assert/strict";
import {checkedSocialUuid,cleanComment,sharePostPath} from "../lib/social-interactions.mjs";

const id="abcdef00-1234-4567-abcd-0123456789ab";
test("social post IDs are strict UUID values",()=>{
 assert.equal(checkedSocialUuid(id.toUpperCase()),id);
 for(const invalid of ["abc","../posts",undefined,{},id+"'"])assert.throws(()=>checkedSocialUuid(invalid),RangeError);
 assert.equal(sharePostPath(id),"/?post="+id+"#feed");
});
test("comments preserve newlines and reject unsafe or excessive content",()=>{
 assert.equal(cleanComment("  Hello\r\nUltra!  "),"Hello\nUltra!");
 assert.equal(cleanComment("🖼️"),"🖼️");
 assert.equal(cleanComment("a".repeat(500)).length,500);
 for(const invalid of [null,42,"","    ","a".repeat(501),"abc\u0000def","hi\u001b"])assert.throws(()=>cleanComment(invalid),RangeError);
});
