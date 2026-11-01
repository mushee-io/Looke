import test from "node:test";
import assert from "node:assert/strict";
import {checkedIpfsMetadataUri,normalizeCreatorCoinDraft,creatorCoinPreview,MAX_CREATOR_SUPPLY} from "../lib/creator-coin.mjs";

const CID="Qm"+"a".repeat(44);
const URI="ipfs://"+CID+"/metadata.json";
const sample={name:"My Ultra Creator",symbol:"ULTRAC",supplyTokens:"5000000",metadataURI:URI};
test("normalize drafts for bounded, non-custodial fixed-supply testnet mint proposals",()=>{
 const draft=normalizeCreatorCoinDraft({...sample,name:"  My Ultra Creator  "});
 assert.deepEqual(draft,{name:"My Ultra Creator",symbol:"ULTRAC",supplyTokens:5_000_000,metadataURI:URI});
 const preview=creatorCoinPreview(draft,"0xAABBccDDeeFf0011223344556677889900112233");
 assert.equal(preview.supplyRaw,"5000000000000000000000000");
 assert.equal(preview.creatorAddress,"0xaabbccddeeff0011223344556677889900112233");
 assert.equal(preview.kind,0);
 assert.equal(preview.contentRef,"0x"+"00".repeat(32));
 assert.equal(preview.chainId,18881);
 assert.equal(preview.executionEnabled,false);
 assert.equal(preview.liquidityCreated,false);
 assert.equal(MAX_CREATOR_SUPPLY,1_000_000_000);
});
test("name, supply and symbol checks reject harmful or inconsistent inputs",()=>{
 const bad=[
 {...sample,name:"X"}, {...sample,name:"x".repeat(81)}, {...sample,name:"hello\u0000world"},
 {...sample,symbol:"mixed"}, {...sample,symbol:"$BAD"}, {...sample,symbol:"A"},
 {...sample,supplyTokens:"0"}, {...sample,supplyTokens:"1000000001"},
 {...sample,supplyTokens:"2.5"}, {...sample,supplyTokens:"01"},
 {...sample,supplyTokens:1000},{...sample,creatorAddress:"0x"+"1".repeat(40)},
 {},[],null,
 ];
 for(const input of bad)assert.throws(()=>normalizeCreatorCoinDraft(input),RangeError);
 assert.throws(()=>creatorCoinPreview(normalizeCreatorCoinDraft(sample),"0x123"),RangeError);
});
test("IPFS URI accepts a plausible CID and safe metadata path only",()=>{
 assert.equal(checkedIpfsMetadataUri(URI),URI);
 const v1="bafy"+"a".repeat(55);
 assert.equal(checkedIpfsMetadataUri("ipfs://"+v1),"ipfs://"+v1);
 for(const bad of ["https://example.com/metadata.json","ipfs://hello",
   "ipfs://"+CID+"/../private","ipfs://"+CID+"/%2e%2e/data",
   "ipfs://"+CID+"/a//b","ipfs://"+CID+"/","ipfs://"+CID+"/?token=abc",
   "ipfs://"+CID+"#fragment","ipfs://"+CID+"/a".repeat(150)]){
   assert.throws(()=>checkedIpfsMetadataUri(bad),RangeError);
 }
});
