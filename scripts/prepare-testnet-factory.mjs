#!/usr/bin/env node
/** Offline compiler/unsigned deployment preparation. NEVER signs, broadcasts,
 * funds, approves, or activates a token. Review compiler/output independently.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import solc from "solc";
import {encodeDeployData,getAddress,isAddress,keccak256,zeroAddress} from "viem";

const pathname="contracts/LookeCoinFactory.sol";
export function unsignedFactoryManifest(issuer){
 if(!isAddress(issuer,{strict:false})||issuer.toLowerCase()===zeroAddress)
  throw new RangeError("An explicitly reviewed nonzero attestor is required");
 const attestor=getAddress(issuer);
 const sources={[pathname]:{content:fs.readFileSync(pathname,"utf8")}};
 const input={language:"Solidity",sources,
  settings:{evmVersion:"shanghai",optimizer:{enabled:true,runs:200},
   outputSelection:{"*":{"*":["abi","evm.bytecode.object","evm.deployedBytecode.object"]}}}};
 function importer(p){
  const root=path.resolve("node_modules");
  const target=path.resolve(root,p);
  if(!target.startsWith(root+path.sep))return {error:"Import path outside node_modules"};
  try{return {contents:fs.readFileSync(target,"utf8")};}
  catch{return {error:"Missing explicit dependency "+p};}
 }
 const built=JSON.parse(solc.compile(JSON.stringify(input),{import:importer}));
 const errors=(built.errors??[]).filter(e=>e.severity==="error");
 if(errors.length)throw new Error("Solidity compile failed: "+
  errors.map(e=>e.formattedMessage).join("\n"));
 const factory=built.contracts?.[pathname]?.LookeCoinFactory;
 if(!factory?.evm?.bytecode?.object||!factory.abi)
  throw new Error("Factory artifact missing");
 const bytecode="0x"+factory.evm.bytecode.object;
 const data=encodeDeployData({abi:factory.abi,bytecode,args:[attestor]});
 return {
  status:"UNSIGNED_TESTNET_DEPLOYMENT_DRAFT",chainId:18881,
  contract:"LookeCoinFactory",attestor,constructorArgs:[attestor],
  solidityVersion:solc.version(),evmVersion:"shanghai",
  optimizer:{enabled:true,runs:200},
  abi:factory.abi,creationBytecodeHash:keccak256(bytecode),
  tx:{chainId:18881,to:null,value:"0",data},
  signed:false,submitted:false,securityAudited:false,tradingEnabled:false,
  next:"Independent audit and human wallet approval required. Verify deployed runtime bytecode and immutable attestor, pin measured runtime code hash; do not automatically trust compilation or this manifest."
 };
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname);
if(direct){
 if(process.argv.length!==3||process.argv[2]!=="--unsigned-18881"||
    process.env.LOOKE_UNSIGNED_DEPLOY_ACK!=="REVIEWED_TESTNET_ONLY"){
  process.stderr.write("Refusing deployment preparation: set LOOKE_UNSIGNED_DEPLOY_ACK=REVIEWED_TESTNET_ONLY and pass --unsigned-18881. No transaction will be sent.\n");
  process.exitCode=2;
 }else{
  try{
   const manifest=unsignedFactoryManifest(process.env.LOOKE_EXPECTED_ATTESTOR_ADDRESS);
   process.stdout.write(JSON.stringify(manifest,null,2)+"\n");
  }catch{
   process.stderr.write("Refused: attestor config or locally compiled artifact invalid.\n");
   process.exitCode=1;
  }
 }
}
