import test from "node:test";
import assert from "node:assert/strict";
import {checkedNativeAccount,checkedUniqFactoryId,normalizeUniqCollection,normalizeUniqItem,
 buildUniqManifest,reviewNativeUniqFactory} from "../lib/uniq-creation.mjs";
const imageURI="ipfs://Qm"+"a".repeat(44)+"/art.png";
const collection={name:"Looke Art",description:"Original creator artwork",imageURI,
 nativeAccount:"makeracct111",factoryId:"42"};
const item={collectionId:"b5404284-c137-4dab-a376-0cb069f05c18",name:"First Uniq",
 description:"One original digital image",imageURI,editionLimit:"100"};
test("metadata manifests are stable and private drafts do not authorize minting",()=>{
 const c=normalizeUniqCollection(collection),i=normalizeUniqItem(item);
 assert.deepEqual(c,collection);
 assert.deepEqual(i,{...item,editionLimit:100});
 assert.equal(JSON.parse(buildUniqManifest("collection",c)).plannedFactoryId,"42");
 assert.equal(JSON.parse(buildUniqManifest("uniq",i)).editionLimit,100);
 assert.equal(buildUniqManifest("collection",c),buildUniqManifest("collection",c));
 assert.equal(buildUniqManifest("uniq",i),buildUniqManifest("uniq",i));
});
test("unsafe metadata, unknown fields, invalid and oversized editions fail closed",()=>{
 for(const input of [
  {...collection,name:"a"}, {...collection,description:"x".repeat(1001)},
  {...collection,imageURI:"https://unapproved/asset.png"},
  {...collection,nativeAccount:"bad..name"}, {...collection,factoryId:"0"},
  {...collection,allowMint:true},[],null
 ])assert.throws(()=>normalizeUniqCollection(input),RangeError);
 for(const input of [
  {...item,editionLimit:"0"},{...item,editionLimit:"100001"},
  {...item,editionLimit:1},{...item,collectionId:"../../foo"},
  {...item,name:"Unsafe\nline"},{...item,wallet:"test"},null
 ])assert.throws(()=>normalizeUniqItem(input),RangeError);
});
test("native account/factory parsing checks Eosio name and uint64",()=>{
 assert.equal(checkedNativeAccount("makeracct111"),"makeracct111");
 assert.equal(checkedUniqFactoryId("18446744073709551615"),"18446744073709551615");
 for(const value of ["0","01","18446744073709551616",-1,"1.2"])
  assert.throws(()=>checkedUniqFactoryId(value),RangeError);
 for(const value of ["","UPPERCASE","abc..abc","example6","a".repeat(13),".abc","abc."])
  assert.throws(()=>checkedNativeAccount(value),RangeError);
});
test("read-only factory guard checks manager, active stat, windows and max tokens",()=>{
 const now=1_800_000_000,account="makeracct111";
 const row={asset_manager:account,asset_creator:"originalacct",stat:0,
  mintable_window_start:now-100,mintable_window_end:now+100,
  minted_tokens_no:3,max_mintable_tokens:100};
 assert.equal(reviewNativeUniqFactory(row,account,now).eligible,true);
 assert.equal(reviewNativeUniqFactory({...row,stat:1},account,now).eligible,false);
 assert.equal(reviewNativeUniqFactory({...row,max_mintable_tokens:3},account,now).eligible,false);
 assert.equal(reviewNativeUniqFactory({...row,mintable_window_end:now-1},account,now).eligible,false);
 assert.equal(reviewNativeUniqFactory(row,"stranger",now).eligible,false);
 assert.equal(reviewNativeUniqFactory(null,account,now).eligible,false);
});
