import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import ganache from "ganache";
import {contentSnapshot} from "../lib/content-coin.mjs";
import {
  createPublicClient,createWalletClient,custom,defineChain,
  encodeAbiParameters,keccak256,parseEventLogs,zeroHash,zeroAddress
} from "viem";

const pathToFactory="contracts/LookeCoinFactory.sol";
function compileFactory() {
 const input={
   language:"Solidity",
   sources:{[pathToFactory]:{content:fs.readFileSync(pathToFactory,"utf8")}},
   settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},
     outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}
 };
 const imports=(p)=>{
   const safe=path.resolve("node_modules",p);
   if(!safe.startsWith(path.resolve("node_modules")+path.sep))return {error:"Invalid import"};
   try{return {contents:fs.readFileSync(safe,"utf8")};}
   catch{return {error:"Missing import: "+p};}
 };
 const result=JSON.parse(solc.compile(JSON.stringify(input),{import:imports}));
 const errors=(result.errors??[]).filter(e=>e.severity==="error");
 assert.deepEqual(errors,[],errors.map(e=>e.formattedMessage).join("\n"));
 return {
   factory:result.contracts[pathToFactory].LookeCoinFactory,
   token:result.contracts[pathToFactory].LookeCoin
 };
}

const CID="Qm"+"a".repeat(44);
const uri="ipfs://"+CID+"/metadata.json";
const chain=defineChain({
 id:18881,name:"Isolated Ultra EVM Testnet Simulation",
 nativeCurrency:{name:"Local test UOS",symbol:"UOS",decimals:18},
 rpcUrls:{default:{http:["http://localhost"]}},testnet:true
});
test("M9 factory enforces creator-only uniqueness, fixed supply and valid inputs in an isolated EVM",async()=>{
 const compiled=compileFactory();
 const provider=ganache.provider({
   chain:{chainId:18881,hardfork:"shanghai"},
   wallet:{totalAccounts:3},logging:{quiet:true},
   miner:{blockGasLimit:30_000_000}
 });
 try {
   const transport=custom(provider);
   const publicClient=createPublicClient({chain,transport});
   const wallet=createWalletClient({chain,transport});
   const [creator,another]=await wallet.getAddresses();
   assert.equal(await publicClient.getChainId(),18881);
   const deployHash=await wallet.deployContract({
     account:creator,abi:compiled.factory.abi,
     bytecode:"0x"+compiled.factory.evm.bytecode.object,
     gas:8_000_000n
   });
   const receipt=await publicClient.waitForTransactionReceipt({hash:deployHash});
   assert.equal(receipt.status,"success");
   const factory=receipt.contractAddress;
   assert(factory,"Factory must be deployed in local EVM");

   const launchArgs=["Original Creator","ORIG",0,zeroHash,1_000_000n,uri];
   const hash=await wallet.writeContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:launchArgs,account:creator,gas:6_000_000n
   });
   const launch=await publicClient.waitForTransactionReceipt({hash});
   assert.equal(launch.status,"success");
   const events=parseEventLogs({abi:compiled.factory.abi,logs:launch.logs,eventName:"CoinCreated"});
   assert.equal(events.length,1);
   const event=events[0].args;
   assert.equal(event.creator.toLowerCase(),creator.toLowerCase());
   assert.equal(event.kind,0);
   assert.equal(event.contentRef,zeroHash);
   assert.equal(event.supply,1_000_000n*10n**18n);
   const token=event.coin;
   const key=keccak256(encodeAbiParameters(
     [{type:"address"},{type:"uint8"},{type:"bytes32"}],[creator,0,zeroHash]
   ));
   const mapped=await publicClient.readContract({
     address:factory,abi:compiled.factory.abi,functionName:"coinFor",args:[key]
   });
   assert.equal(mapped.toLowerCase(),token.toLowerCase());
   assert.notEqual(mapped,zeroAddress);
   assert.equal(await publicClient.readContract({address:factory,abi:compiled.factory.abi,functionName:"coinCount"}),1n);
   assert.equal(await publicClient.readContract({address:token,abi:compiled.token.abi,functionName:"totalSupply"}),1_000_000n*10n**18n);
   assert.equal(await publicClient.readContract({address:token,abi:compiled.token.abi,functionName:"balanceOf",args:[creator]}),1_000_000n*10n**18n);
   assert.equal(await publicClient.readContract({address:token,abi:compiled.token.abi,functionName:"creator"}),creator);
   assert(!compiled.token.abi.some(x=>x.type==="function" && ["mint","pause","blacklist"].includes(x.name)));

   // Simulation must revert. These do not broadcast or spend any funds.
   const invalid=[
     ["Another", "MORE",0,zeroHash,100n,uri], // same wallet creator coin
     ["X", "A",0,zeroHash,100n,uri], // invalid name and symbol
     ["Another", "lower",0,zeroHash,100n,uri],
     ["Another", "MORE",0,zeroHash,0n,uri],
     ["Another", "MORE",0,zeroHash,1_000_000_001n,uri],
     ["Another", "MORE",0,zeroHash,100n,"https://untrusted.example/meta"],
     ["Another", "MORE",0,"0x"+"11".repeat(32),100n,uri],
   ];
   for(const args of invalid){
     await assert.rejects(
       publicClient.simulateContract({
         address:factory,abi:compiled.factory.abi,functionName:"createCoin",
         args,account:creator
       }),Error
     );
   }
   // Another distinct EVM creator can register their own independent creator coin.
   const anotherHash=await wallet.writeContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:["Second Creator","SECOND",0,zeroHash,250n,uri],
     account:another,gas:6_000_000n
   });
   assert.equal((await publicClient.waitForTransactionReceipt({hash:anotherHash})).status,"success");
   assert.equal(await publicClient.readContract({
     address:factory,abi:compiled.factory.abi,functionName:"coinCount"
   }),2n);

   // M10: nonzero post contentRef and kind=1 are required for content coins.
   // This local Ganache test proves keying and fixed supply only; the current
   // permissionless factory does not check offchain post ownership.
   const contentPost="ed827d1a-a415-4b6a-8a5c-d47ec09dd931";
   const snap=contentSnapshot(contentPost,creator,"My original Ultra post");
   await assert.rejects(publicClient.simulateContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:["Invalid Content","BAD",1,zeroHash,100n,uri],account:creator
   }),Error);
   const contentArgs=["My Post","POST",1,snap.contentRef,500n,uri];
   const contentHash=await wallet.writeContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:contentArgs,account:creator,gas:6_000_000n
   });
   const contentReceipt=await publicClient.waitForTransactionReceipt({hash:contentHash});
   assert.equal(contentReceipt.status,"success");
   const contentEvents=parseEventLogs({abi:compiled.factory.abi,
     logs:contentReceipt.logs,eventName:"CoinCreated"});
   assert.equal(contentEvents.length,1);
   assert.equal(contentEvents[0].args.kind,1);
   assert.equal(contentEvents[0].args.contentRef,snap.contentRef);
   assert.equal(contentEvents[0].args.creator.toLowerCase(),creator.toLowerCase());
   assert.equal(contentEvents[0].args.supply,500n*10n**18n);
   assert.equal(await publicClient.readContract({
     address:contentEvents[0].args.coin,abi:compiled.token.abi,
     functionName:"balanceOf",args:[creator]
   }),500n*10n**18n);
   const contentKey=keccak256(encodeAbiParameters(
     [{type:"address"},{type:"uint8"},{type:"bytes32"}],[creator,1,snap.contentRef]
   ));
   assert.equal((await publicClient.readContract({
     address:factory,abi:compiled.factory.abi,functionName:"coinFor",args:[contentKey]
   })).toLowerCase(),contentEvents[0].args.coin.toLowerCase());
   await assert.rejects(publicClient.simulateContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:contentArgs,account:creator
   }),Error);
   const newSnap=contentSnapshot("ed827d1a-a415-4b6a-8a5c-d47ec09dd932",
     creator,"A different post");
   const secondContentHash=await wallet.writeContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:["Other Post","POST2",1,newSnap.contentRef,100n,uri],
     account:creator,gas:6_000_000n
   });
   assert.equal((await publicClient.waitForTransactionReceipt({
     hash:secondContentHash
   })).status,"success");

   // Current unaudited factory cannot bind the ref to a Looke post author:
   // another wallet can copy the reference and deploy a different token.
   // This is a security gate, NOT a successful ownership-attestation test.
   const copiedHash=await wallet.writeContract({
     address:factory,abi:compiled.factory.abi,functionName:"createCoin",
     args:["Copied Ref","COPY",1,snap.contentRef,5n,uri],
     account:another,gas:6_000_000n
   });
   assert.equal((await publicClient.waitForTransactionReceipt({
     hash:copiedHash
   })).status,"success");
   assert.equal(await publicClient.readContract({
     address:factory,abi:compiled.factory.abi,functionName:"coinCount"
   }),5n);
 } finally {
   await provider.disconnect();
 }
});
