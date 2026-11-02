import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import ganache from "ganache";
import { privateKeyToAccount } from "viem/accounts";
import { contentSnapshot } from "../lib/content-coin.mjs";
import { trendReference } from "../lib/trend-coin.mjs";
import {
  createPublicClient, createWalletClient, custom, defineChain,
  encodeAbiParameters, keccak256, parseEventLogs, toBytes, zeroHash, zeroAddress
} from "viem";

const pathToFactory="contracts/LookeCoinFactory.sol";
function compileFactory() {
  const input={
    language:"Solidity",
    sources:{[pathToFactory]:{content:fs.readFileSync(pathToFactory,"utf8")}},
    settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},
      outputSelection:{"*":{"*":["abi","evm.bytecode.object"]}}}
  };
  const imports=p=>{
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
const types={CoinAuthorization:[
  {name:"creator",type:"address"},
  {name:"kind",type:"uint8"},
  {name:"contentRef",type:"bytes32"},
  {name:"nameHash",type:"bytes32"},
  {name:"symbolHash",type:"bytes32"},
  {name:"initialSupplyTokens",type:"uint256"},
  {name:"metadataHash",type:"bytes32"},
  {name:"nonce",type:"uint256"},
  {name:"deadline",type:"uint256"}
]};

test("M21 factory restricts copied references with attestation, nonces, global uniqueness and creator-only legacy issuance",async()=>{
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
    const attestor=privateKeyToAccount("0x"+"42".repeat(32)); // local throwaway signing key ONLY
    assert.equal(await publicClient.getChainId(),18881);
    const deployHash=await wallet.deployContract({
      account:creator,abi:compiled.factory.abi,
      bytecode:"0x"+compiled.factory.evm.bytecode.object,
      args:[attestor.address],gas:9_000_000n
    });
    const deploy=await publicClient.waitForTransactionReceipt({hash:deployHash});
    assert.equal(deploy.status,"success");
    const factory=deploy.contractAddress;
    assert(factory,"Factory must be deployed in local simulated EVM");
    assert.equal(await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"attestor"
    }),attestor.address);

    const signAuthorization=async (sender,terms,options={})=>{
      const nonce=options.nonce??await publicClient.readContract({
        address:factory,abi:compiled.factory.abi,
        functionName:"authorizationNonces",args:[sender]
      });
      const deadline=options.deadline??BigInt(Math.floor(Date.now()/1000)+3600);
      const request={name:terms[0],symbol:terms[1],kind:terms[2],
        contentRef:terms[3],initialSupplyTokens:terms[4],
        metadataURI:terms[5],nonce,deadline};
      const signature=await attestor.signTypedData({
        domain:{name:"LookeCoinFactory",version:"1",
          chainId:options.chainId??18881,verifyingContract:options.factory??factory},
        primaryType:"CoinAuthorization",types,
        message:{creator:sender,kind:request.kind,contentRef:request.contentRef,
          nameHash:keccak256(toBytes(request.name)),
          symbolHash:keccak256(toBytes(request.symbol)),
          initialSupplyTokens:request.initialSupplyTokens,
          metadataHash:keccak256(toBytes(request.metadataURI)),nonce,deadline}
      });
      return [request,signature];
    };
    const write=async (from,fn,args)=> {
      const hash=await wallet.writeContract({
        address:factory,abi:compiled.factory.abi,functionName:fn,
        args,account:from,gas:7_000_000n
      });
      const receipt=await publicClient.waitForTransactionReceipt({hash});
      assert.equal(receipt.status,"success");
      return receipt;
    };
    const reject=async(from,fn,args)=>assert.rejects(
      publicClient.simulateContract({
        address:factory,abi:compiled.factory.abi,functionName:fn,
        args,account:from
      }),Error
    );

    // Creator coin issuance retains the six-argument interface and fixed supply.
    const creatorTerms=["Original Creator","ORIG",0,zeroHash,1_000_000n,uri];
    const creatorReceipt=await write(creator,"createCoin",creatorTerms);
    const creatorEvents=parseEventLogs({abi:compiled.factory.abi,
      logs:creatorReceipt.logs,eventName:"CoinCreated"});
    assert.equal(creatorEvents.length,1);
    const coin=creatorEvents[0].args.coin;
    assert.equal(creatorEvents[0].args.creator.toLowerCase(),creator.toLowerCase());
    assert.equal(creatorEvents[0].args.supply,1_000_000n*10n**18n);
    assert.equal(await publicClient.readContract({
      address:coin,abi:compiled.token.abi,functionName:"totalSupply"
    }),1_000_000n*10n**18n);
    assert.equal(await publicClient.readContract({
      address:coin,abi:compiled.token.abi,functionName:"balanceOf",args:[creator]
    }),1_000_000n*10n**18n);
    assert.equal(await publicClient.readContract({
      address:coin,abi:compiled.token.abi,functionName:"creator"
    }),creator);
    assert(!compiled.token.abi.some(x=>x.type==="function"&&
      ["mint","pause","blacklist"].includes(x.name)));
    const creatorKey=keccak256(encodeAbiParameters(
      [{type:"address"},{type:"uint8"},{type:"bytes32"}],[creator,0,zeroHash]
    ));
    assert.equal((await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"coinFor",args:[creatorKey]
    })).toLowerCase(),coin.toLowerCase());
    for(const args of [
      creatorTerms, ["X","A",0,zeroHash,100n,uri],
      ["Another","lower",0,zeroHash,100n,uri],
      ["Another","MORE",0,zeroHash,0n,uri],
      ["Another","MORE",0,zeroHash,1_000_000_001n,uri],
      ["Another","MORE",0,zeroHash,100n,"https://untrusted.example/meta"],
      ["Another","MORE",0,"0x"+"11".repeat(32),100n,uri]
    ])await reject(creator,"createCoin",args);
    await write(another,"createCoin",["Second Creator","SECOND",0,zeroHash,250n,uri]);

    const snap=contentSnapshot(
      "ed827d1a-a415-4b6a-8a5c-d47ec09dd931",creator,"My original Ultra post");
    const contentTerms=["My Post","POST",1,snap.contentRef,500n,uri];
    await reject(creator,"createCoin",contentTerms);
    await reject(another,"createCoin",["Copied Post","COPY",1,snap.contentRef,5n,uri]);
    await reject(creator,"createCoin",["Bad Content","BAD",1,zeroHash,1n,uri]);
    const signedContent=await signAuthorization(creator,contentTerms);
    const contentReceipt=await write(creator,"createCoinAuthorized",signedContent);
    const contentEvents=parseEventLogs({abi:compiled.factory.abi,
      logs:contentReceipt.logs,eventName:"CoinCreated"});
    assert.equal(contentEvents.length,1);
    assert.equal(contentEvents[0].args.kind,1);
    assert.equal(contentEvents[0].args.contentRef,snap.contentRef);
    assert.equal(contentEvents[0].args.supply,500n*10n**18n);
    assert.equal(await publicClient.readContract({
      address:contentEvents[0].args.coin,abi:compiled.token.abi,
      functionName:"balanceOf",args:[creator]
    }),500n*10n**18n);
    assert.equal((await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"referenceCoinFor",
      args:[1,snap.contentRef]
    })).toLowerCase(),contentEvents[0].args.coin.toLowerCase());
    assert.equal(await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"authorizationNonces",
      args:[creator]
    }),1n);
    // A used signature cannot be replayed, even by its intended creator.
    await reject(creator,"createCoinAuthorized",signedContent);
    // A stolen, valid signer approval for creator cannot be used by another wallet.
    await reject(another,"createCoinAuthorized",signedContent);
    // Even an attestor-signed second wallet cannot reuse the global post ref.
    await reject(another,"createCoinAuthorized",
      await signAuthorization(another,["Copied Post","COPY",1,snap.contentRef,5n,uri]));
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,contentTerms));

    const snap2=contentSnapshot(
      "ed827d1a-a415-4b6a-8a5c-d47ec09dd932",creator,"A different post");
    const terms2=["Other Post","POST2",1,snap2.contentRef,100n,uri];
    const signed2=await signAuthorization(creator,terms2);
    await reject(creator,"createCoinAuthorized",
      [{...signed2[0],initialSupplyTokens:101n},signed2[1]]);
    await reject(creator,"createCoinAuthorized",
      [{...signed2[0],metadataURI:uri+"/tampered"},signed2[1]]);
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,terms2,{deadline:1n}));
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,terms2,{chainId:18882}));
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,terms2,{factory:another}));
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,terms2,{deadline:BigInt(Math.floor(Date.now()/1000)+100000)}));
    await write(creator,"createCoinAuthorized",signed2);
    assert.equal(await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"authorizationNonces",
      args:[creator]
    }),2n);

    const trend=trendReference("Ultra Games");
    const trendTerms=["Ultra Gaming","GAMES",2,trend.trendRef,2000n,uri];
    await reject(creator,"createCoin",trendTerms);
    await reject(another,"createCoin",["Fake Trend","FAKE",2,trend.trendRef,10n,uri]);
    const trendReceipt=await write(creator,"createCoinAuthorized",
      await signAuthorization(creator,trendTerms));
    const trendEvents=parseEventLogs({abi:compiled.factory.abi,
      logs:trendReceipt.logs,eventName:"CoinCreated"});
    assert.equal(trendEvents.length,1);
    assert.equal(trendEvents[0].args.kind,2);
    assert.equal(trendEvents[0].args.contentRef,trend.trendRef);
    assert.equal(trendEvents[0].args.supply,2000n*10n**18n);
    assert.equal((await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"referenceCoinFor",
      args:[2,trend.trendRef]
    })).toLowerCase(),trendEvents[0].args.coin.toLowerCase());
    await reject(another,"createCoinAuthorized",
      await signAuthorization(another,["Fake Trend","FAKE",2,trend.trendRef,10n,uri]));
    await reject(creator,"createCoinAuthorized",
      await signAuthorization(creator,["Not Creator","NOPE",0,zeroHash,1n,uri]));
    assert.equal(await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"coinCount"
    }),5n);
    assert.notEqual(await publicClient.readContract({
      address:factory,abi:compiled.factory.abi,functionName:"coinAt",args:[4n]
    }),zeroAddress);
  } finally {
    await provider.disconnect();
  }
});
