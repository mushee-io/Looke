#!/usr/bin/env node
/**
 * Looke Ultra EVM Testnet operator receipt acceptance.
 * READ ONLY. Requires externally wallet-signed testnet transaction hashes.
 * No keys, deploy, broadcast, approvals, token value or launch toggle.
 */
import process from "node:process";
import {createPublicClient,decodeEventLog,getAddress,http,isAddress,keccak256,parseAbi,zeroAddress} from "viem";
import {checkedIndependentRpc} from "../lib/testnet-evidence.mjs";

const PRIMARY="https://evm.test.ultra.eosusa.io";
const CHAIN=18881,DEPTH=12n;
const factoryABI=parseAbi([
 "function attestor() view returns (address)",
 "function authorizationNonces(address) view returns (uint256)",
 "function referenceCoinFor(uint8,bytes32) view returns (address)",
 "event CoinCreated(address indexed coin,address indexed creator,uint8 indexed kind,bytes32 contentRef,uint256 supply,string metadataURI)",
 "event CoinAuthorizationUsed(address indexed creator,uint8 indexed kind,bytes32 indexed contentRef,uint256 nonce)"
]);
const tokenABI=parseAbi(["function totalSupply() view returns (uint256)",
 "function balanceOf(address) view returns (uint256)"]);
const hash=/^0x[0-9a-f]{64}$/i;
const nonzeroAddress=(v,label)=>{
 if(!isAddress(v,{strict:false})||v.toLowerCase()===zeroAddress)
  throw new RangeError("Invalid "+label);
 return getAddress(v);
};
const checkedHash=(v,label)=>{
 if(typeof v!=="string"||!hash.test(v)||/^0x0{64}$/i.test(v))
  throw new RangeError("Invalid "+label);
 return v;
};
function requireSame(a,b,label){
 if(a.toString().toLowerCase()!==b.toString().toLowerCase())
  throw new Error("Independent nodes disagree on "+label);
}
function client(url){
 return createPublicClient({transport:http(url,{timeout:8000,retryCount:0})});
}
async function observeReceipt(node,transactionHash){
 const [network,head,transaction,receipt]=await Promise.all([
  node.getChainId(),node.getBlockNumber(),
  node.getTransaction({hash:transactionHash}),
  node.getTransactionReceipt({hash:transactionHash})
 ]);
 if(network!==CHAIN||receipt.status!=="success"||
    head<receipt.blockNumber+DEPTH||
    transaction.blockNumber!==receipt.blockNumber||
    transaction.blockHash?.toLowerCase()!==receipt.blockHash.toLowerCase()||
    transaction.hash.toLowerCase()!==receipt.transactionHash.toLowerCase())
  throw new Error("Wrong chain, transaction, status or confirmation depth");
 const block=await node.getBlock({blockNumber:receipt.blockNumber});
 if(block.hash.toLowerCase()!==receipt.blockHash.toLowerCase())
  throw new Error("Receipt block is not canonical on this node");
 return {head,transaction,receipt,block};
}
function assertReceiptAgreement(a,b){
 for(const key of ["blockNumber","blockHash","transactionHash","status","contractAddress"]){
  requireSame(a.receipt[key]??"",b.receipt[key]??"",key);
 }
 requireSame(a.transaction.from,b.transaction.from,"sender");
 requireSame(a.transaction.to??"",b.transaction.to??"","recipient");
 requireSame(a.block.hash,b.block.hash,"canonical block");
 const fingerprint=receipt=>receipt.logs.map(l=>[
   l.address.toLowerCase(),l.logIndex.toString(),
   l.topics.map(t=>t.toLowerCase()),l.data.toLowerCase()
 ]);
 if(JSON.stringify(fingerprint(a.receipt))!==JSON.stringify(fingerprint(b.receipt)))
  throw new Error("Receipt logs differ across nodes");
}
async function verifyDeployment(nodes,config){
 const [primary,secondary]=await Promise.all(nodes.map(n=>observeReceipt(n,config.deploymentTx)));
 assertReceiptAgreement(primary,secondary);
 if(primary.transaction.to!==null ||
    primary.receipt.contractAddress?.toLowerCase()!==config.factory.toLowerCase())
  throw new Error("Factory was not created by claimed deployment transaction");
 const at=primary.receipt.blockNumber;
 const check=async node=>{
  const [code,issuer]=await Promise.all([
   node.getCode({address:config.factory,blockNumber:at}),
   node.readContract({address:config.factory,abi:factoryABI,functionName:"attestor",blockNumber:at})
  ]);
  if(!code||code==="0x"||keccak256(code).toLowerCase()!==config.codeHash.toLowerCase()||
     issuer.toLowerCase()!==config.attestor.toLowerCase())
   throw new Error("Deployed factory has unapproved runtime code or immutable attestor");
  return code;
 };
 const codes=await Promise.all(nodes.map(check));
 requireSame(codes[0],codes[1],"deployed bytecode");
 // Check current runtime too: unexpected selfdestruct/replacement or chain fork is NO-GO.
 const current=await Promise.all(nodes.map(n=>n.getCode({address:config.factory})));
 for(const code of current){
  if(!code||keccak256(code).toLowerCase()!==config.codeHash.toLowerCase())
   throw new Error("Factory current runtime code mismatches pinned deploy");
 }
 requireSame(current[0],current[1],"current code");
 return {transactionHash:config.deploymentTx,contractAddress:config.factory,
  transactionSigner:primary.transaction.from,
  confirmedBlock:at.toString(),blockHash:primary.block.hash,
  confirmationsAtLeast:Number(DEPTH),contractCodeHash:config.codeHash,
  attestor:config.attestor,acceptedAsReceiptEvidence:true,
  independentlyAudited:false,mainnetReady:false};
}

async function verifyContentIssuance(nodes,config){
 const [a,b]=await Promise.all(nodes.map(n=>observeReceipt(n,config.contentTx)));
 assertReceiptAgreement(a,b);
 if(a.transaction.to?.toLowerCase()!==config.factory.toLowerCase())
  throw new Error("Content issuance not sent to approved factory");
 const events=a.receipt.logs.filter(log=>log.address.toLowerCase()===config.factory.toLowerCase());
 const decoded=events.map(log=>{
  try{return decodeEventLog({abi:factoryABI,data:log.data,topics:log.topics,strict:true});}
  catch{return null;}
 }).filter(Boolean);
 const created=decoded.filter(x=>x.eventName==="CoinCreated");
 const authorized=decoded.filter(x=>x.eventName==="CoinAuthorizationUsed");
 if(created.length!==1||authorized.length!==1)
  throw new Error("Required factory coin issuance and authorization events missing");
 const coin=created[0].args;
 const auth=authorized[0].args;
 if(Number(coin.kind)!==1||Number(auth.kind)!==1||
    coin.creator.toLowerCase()!==a.transaction.from.toLowerCase()||
    auth.creator.toLowerCase()!==coin.creator.toLowerCase()||
    auth.contentRef.toLowerCase()!==coin.contentRef.toLowerCase())
  throw new Error("Creator, kind, or reference do not match wallet-signed transaction");
 const check=async node=>{
  const [mapped,nonce,supply,tokenCode]=await Promise.all([
   node.readContract({address:config.factory,abi:factoryABI,functionName:"referenceCoinFor",
     args:[1,coin.contentRef],blockNumber:a.receipt.blockNumber}),
   node.readContract({address:config.factory,abi:factoryABI,functionName:"authorizationNonces",
     args:[coin.creator],blockNumber:a.receipt.blockNumber}),
   node.readContract({address:coin.coin,abi:tokenABI,functionName:"totalSupply",
     blockNumber:a.receipt.blockNumber}),
   node.getCode({address:coin.coin,blockNumber:a.receipt.blockNumber})
  ]);
  if(mapped.toLowerCase()!==coin.coin.toLowerCase()||
     nonce<auth.nonce+1n||supply!==coin.supply||!tokenCode||tokenCode==="0x")
   throw new Error("Issued token provenance, global registry, nonce, or supply invalid");
  return {mapped,nonce,supply,tokenHash:keccak256(tokenCode)};
 };
 const evidence=await Promise.all(nodes.map(check));
 for(const key of ["mapped","nonce","supply","tokenHash"])
  requireSame(evidence[0][key],evidence[1][key],key);
 return {transactionHash:config.contentTx,signer:a.transaction.from,
  coin:coin.coin,reference:coin.contentRef,
  supply:coin.supply.toString(),nonceUsed:auth.nonce.toString(),
  receiptBlock:a.receipt.blockNumber.toString(),blockHash:a.block.hash,
  factoryCreatedAndAuthorizedEventsVerified:true,
  tokenCodeHash:evidence[0].tokenHash,independentlyAudited:false};
}

export async function acceptTestnetFactory(config){
 const factory=nonzeroAddress(config.factory,"factory");
 const attestor=nonzeroAddress(config.attestor,"attestor");
 const codeHash=checkedHash(config.codeHash,"code hash");
 const deploymentTx=checkedHash(config.deploymentTx,"deployment receipt");
 const secondary=checkedIndependentRpc(config.secondaryRpc,PRIMARY);
 if(config.chainId!==CHAIN)throw new RangeError("Only Ultra EVM Testnet 18881 is supported");
 const nodes=[client(PRIMARY),client(secondary)];
 // Both RPCs must be proper 18881 before reading any deployment evidence.
 const ids=await Promise.all(nodes.map(n=>n.getChainId()));
 if(ids.some(id=>id!==CHAIN))throw new Error("Expected Ultra EVM Testnet 18881");
 const options={factory,attestor,codeHash,deploymentTx,
  contentTx:config.contentTx?checkedHash(config.contentTx,"content receipt"):null};
 const deployment=await verifyDeployment(nodes,options);
 const content=options.contentTx?await verifyContentIssuance(nodes,options):null;
 return {status:"READ_ONLY_TESTNET_RECEIPT_REVIEW",network:"Ultra EVM Testnet",
  chainId:CHAIN,deployment,content,
  signedWalletTransactionsObserved:true,
  deploymentReceiptCorroborated:true,
  contentReceiptCorroborated:!!content,
  nativeUniqVerified:false,
  manualThirdSourceReviewRequired:true,independentSecurityAuditRequired:true,
  trustedAttestorGovernanceReviewRequired:true,
  tradingEnabled:false,issuanceEnabled:false,mainnetApproved:false,
  warning:"Two RPCs do not prove independent operators or source audit. External wallet/testnet deployment records need independent explorer confirmation and human security acceptance."};
}
if(process.argv[1]?.endsWith("testnet-factory-acceptance.mjs")){
 if(process.argv.length!==3||process.argv[2]!=="--read-only"||
    process.env.LOOKE_TESTNET_ACCEPTANCE_ACK!=="REVIEWED_TESTNET_ONLY"){
  process.stderr.write("Refusing testnet check. Supply --read-only and LOOKE_TESTNET_ACCEPTANCE_ACK=REVIEWED_TESTNET_ONLY. No transactions will be sent.\n");
  process.exitCode=2;
 }else{
  try{
   const result=await acceptTestnetFactory({
    chainId:CHAIN,
    factory:process.env.LOOKE_FACTORY_TESTNET_ADDRESS,
    attestor:process.env.LOOKE_EXPECTED_ATTESTOR_ADDRESS,
    codeHash:process.env.LOOKE_EXPECTED_FACTORY_CODE_HASH,
    deploymentTx:process.env.LOOKE_FACTORY_DEPLOY_TX_HASH,
    contentTx:process.env.LOOKE_CONTENT_ISSUANCE_TX_HASH,
    secondaryRpc:process.env.LOOKE_INDEPENDENT_EVM_TESTNET_RPC
   });
   process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }catch{
   process.stderr.write("NO-GO: no independently corroborated testnet acceptance. Inspect operator deployment, signing and node evidence without exposing secrets.\n");
   process.exitCode=1;
  }
 }
}
