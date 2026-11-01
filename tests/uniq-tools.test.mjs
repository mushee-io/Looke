import test from "node:test";
import assert from "node:assert/strict";
import {checkedDraftRevision,normalizeCollectionEdit,normalizeUniqItemEdit,
 buildCreatorExport,checksumBytes} from "../lib/uniq-tools.mjs";
const cid="e1e01da6-4c8d-4425-a6ea-51df6b82908f";
const id1="186f9af3-1270-4e8e-aaf4-f85ca9565a21";
const id2="186f9af3-1270-4e8e-aaf4-f85ca9565a22";
const uri="ipfs://Qm"+"a".repeat(44)+"/image.png";
const c={id:cid,revision:3,name:"Art 2026",description:"Original art",
 imageURI:uri,nativeAccount:null,factoryId:null};
const one={id:id1,collectionId:cid,revision:1,name:"Uniq one",
 description:"First edition",imageURI:uri,editionLimit:100};
const two={...one,id:id2,revision:2,name:"Uniq two",editionLimit:500};
test("strict revision prevents missing expectedRevision and unsafe races",()=>{
 assert.equal(checkedDraftRevision(1),1);
 assert.equal(checkedDraftRevision(2147483646),2147483646);
 for(const x of [0,-1,1.5,"1",null,undefined,2147483647,NaN])
  assert.throws(()=>checkedDraftRevision(x),RangeError);
});
test("editing uses all M14 validation rules and rejects invented/unknown fields",()=>{
 const edited=normalizeCollectionEdit({name:c.name,description:c.description,imageURI:c.imageURI,nativeAccount:c.nativeAccount,factoryId:c.factoryId,expectedRevision:2});
 assert.equal(edited.name,c.name);
 assert.equal(edited.expectedRevision,2);
 const item=normalizeUniqItemEdit({collectionId:one.collectionId,name:one.name,description:one.description,imageURI:one.imageURI,editionLimit:"100",expectedRevision:1});
 assert.equal(item.editionLimit,100);
 for(const x of [{name:c.name,description:c.description,imageURI:c.imageURI,nativeAccount:c.nativeAccount,factoryId:c.factoryId,expectedRevision:0},{name:c.name,description:c.description,imageURI:c.imageURI,nativeAccount:c.nativeAccount,factoryId:c.factoryId,expectedRevision:1,allowMint:true},
   {name:c.name,description:c.description,imageURI:"https://malicious.example/img",nativeAccount:null,factoryId:null,expectedRevision:1}])
  assert.throws(()=>normalizeCollectionEdit(x),RangeError);
 for(const x of [{collectionId:one.collectionId,name:one.name,description:one.description,imageURI:one.imageURI,editionLimit:"0",expectedRevision:1},
   {collectionId:one.collectionId,name:one.name,description:one.description,imageURI:one.imageURI,editionLimit:"100",expectedRevision:1,gasKey:"bad"}])
  assert.throws(()=>normalizeUniqItemEdit(x),RangeError);
});
test("export is deterministic and hashes exact canonical metadata bytes",()=>{
 const a=buildCreatorExport(c,[one,two]);
 const b=buildCreatorExport(c,[two,one]);
 assert.deepEqual(a,b);
 assert.equal(checksumBytes(a.json),a.sha256);
 const parsed=JSON.parse(a.json);
 assert.equal(parsed.itemCount,2);
 assert.equal(parsed.totalPlannedEditions,"600");
 assert.equal(parsed.status,"offchain_drafts_unverified");
 assert.equal(parsed.issuedTokens,0);
 assert.match(parsed.collection.sha256,/^[0-9a-f]{64}$/);
 assert.equal(parsed.pinningVerified,false);
 assert.notEqual(buildCreatorExport({...c,name:"Revised art"},[one,two]).sha256,a.sha256);
 assert.notEqual(buildCreatorExport(c,[{...one,editionLimit:101},two]).sha256,a.sha256);
});
test("export rejects cross-collection, duplicate and oversize items",()=>{
 assert.throws(()=>buildCreatorExport(c,[one,one]),RangeError);
 assert.throws(()=>buildCreatorExport(c,[{...one,collectionId:id1}]),RangeError);
 assert.throws(()=>buildCreatorExport(c,Array.from({length:51},(_,i)=>({...one,id:i===0?id1:id2}))),RangeError);
 assert.throws(()=>buildCreatorExport({...c,revision:0},[one]),RangeError);
});
