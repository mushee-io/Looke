/** M21 one-shot, independent, READ-ONLY Testnet acceptance probe.
 * No private keys, wallet signing, transactions, fabrication or release activation.
 */
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {z} from "zod";
import {collectLiveRpcEvidence} from "../src/lib/ops/m8-probe";
import {indexCreatorLaunches} from "../src/lib/ops/m13-index";
import {inspectSocialOperations} from "../src/lib/ops/m11-social";
import {probeProtectedStaging} from "../src/lib/ops/m10-protection";
import {inspectEvmFactory,inspectEvmCoin,inspectNativeUniq} from "../src/lib/beta/acceptance";
import {assembleM21Report,defaultM21Gates,gate,replaceM21Gate} from "../src/lib/ops/m21-acceptance";

const hexAddress=z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hexHash=z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const manifest=z.object({
 factory:z.object({address:hexAddress,deploymentTx:hexHash}).strict().optional(),
 creatorCoin:z.object({factory:hexAddress,creationTx:hexHash}).strict().optional(),
 nativeUniq:z.object({factoryId:z.string().regex(/^[1-9][0-9]{0,15}$/),
  owner:z.string().min(1).max(30),tokenId:z.string().regex(/^[1-9][0-9]{0,15}$/)}).strict().optional(),
}).strict();
type Manifest=z.infer<typeof manifest>;
async function main(){
 const input=process.argv.find(x=>x.endsWith(".json"));
 const provided:Manifest=input?manifest.parse(JSON.parse(await readFile(input,"utf8"))):{};
 let checks=defaultM21Gates();
 const [rpc,index,db,stage]=await Promise.allSettled([
  collectLiveRpcEvidence(),indexCreatorLaunches(),inspectSocialOperations(),
  probeProtectedStaging({vercelToken:process.env.VERCEL_TOKEN,
   deploymentUrl:process.env.LOOKE_M21_PREVIEW_URL,
   expectedRevision:process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA}),
 ]);
 const observation={
  rpc:rpc.status==="fulfilled"?rpc.value:null,
  factoryIndex:index.status==="fulfilled"?{
   status:index.value.status,from:index.value.fromBlock,through:index.value.throughBlock,
   complete:index.value.complete,transactionHashes:index.value.launches.map(x=>x.txHash),
   errors:index.value.errors,
  }:null,
  database:db.status==="fulfilled"?{status:db.value.status,
   leastPrivilege:db.value.leastPrivilege,note:db.value.note}:null,
  protectedPreview:stage.status==="fulfilled"?stage.value:null,
 };
 if(rpc.status==="fulfilled"){
  const r=rpc.value;
  if(r.evm.status==="verified"&&r.evm.headHash)
   checks=replaceM21Gate(checks,gate("ultraEvmReadOnlyHead","verified",
    "Actual Testnet chain 18881 finalized head information observed.",r.evm.headHash));
  if(r.native.status==="verified")
   checks=replaceM21Gate(checks,gate("ultraNativeReadOnlyHead","verified",
    "Actual native Ultra chain head and irreversible marker observed.",
    "Native RPC irreversible "+String(r.native.irreversibleBlock)));
 }
 if(db.status==="fulfilled"&&db.value.status==="verified")
  checks=replaceM21Gate(checks,gate("databaseTLSLeastPrivilege","verified",
   "Real TLS database schema and least-privileged role independently inspected.",
   "PostgreSQL live metadata and role inspection"));
 if(stage.status==="fulfilled"&&stage.value.status==="verified"&&stage.value.signedOutChallengeVerified){
  for(const id of ["previewDeploymentIdentity","signedOutProtection"] as const)
   checks=replaceM21Gate(checks,gate(id,"verified",
    "Exact immutable commit and actual signed-out Vercel challenge observed.",
    stage.value.deploymentOrigin??"Verified Vercel protected staging"));
 }
 const references:{factory:string|null;coin:string|null;uniq:string|null}={
  factory:null,coin:null,uniq:null,
 };
 if(provided.factory){
  try{
   const proof=await inspectEvmFactory(provided.factory.address,provided.factory.deploymentTx);
   if(proof.chainId===18881 && proof.confirmations>=2 &&
    proof.transactionHash.toLowerCase()===provided.factory.deploymentTx.toLowerCase())
    references.factory=proof.transactionHash;
  }catch{/* Do not accept unverified contract deployment evidence. */}
 }
 if(provided.creatorCoin){
  try{
   const proof=await inspectEvmCoin(provided.creatorCoin.factory,provided.creatorCoin.creationTx);
   if(proof.chainId===18881&&proof.confirmations>=2&&
      BigInt(proof.totalSupply)>0n&&proof.txHash.toLowerCase()===provided.creatorCoin.creationTx.toLowerCase()){
     references.coin=proof.txHash;
     checks=replaceM21Gate(checks,gate("creatorCoinReceiptProof","verified",
      "Independent Ultra EVM creator coin receipt and token state revalidated.",
      proof.txHash));
   }
  }catch{/* Not real on-chain proof. */}
 }
 if(provided.nativeUniq){
  try{
   const proof=await inspectNativeUniq(provided.nativeUniq.factoryId,
    provided.nativeUniq.owner,provided.nativeUniq.tokenId);
   if(proof.irreversibleBlock>0&&proof.owner===provided.nativeUniq.owner &&
     proof.factoryId===provided.nativeUniq.factoryId &&
     proof.tokenId===provided.nativeUniq.tokenId){
     references.uniq=String(proof.irreversibleBlock);
     checks=replaceM21Gate(checks,gate("nativeUniqOwnershipProof","verified",
      "Independent native Ultra current factory and owner-scoped Uniq row verified.",
      "Ultra native irrevocable ledger "+String(proof.irreversibleBlock)));
   }
  }catch{/* Missing, invalid, or wrong account; do not assert ownership. */}
 }
 const report=assembleM21Report(checks);
 const output={report,observation,references,
  manifestProvided:!!input,generatedBy:"read-only operator CLI",
  noTransactionsSent:true,publicBetaActivated:false,
  note:"No real wallet witness, provider scanning signoff, external audit, restore proof or release authorization can be inferred from RPC heads or CI."};
 await mkdir(resolve("artifacts/m21"),{recursive:true});
 await writeFile(resolve("artifacts/m21/acceptance.json"),
  JSON.stringify(output,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({milestone:"M21",status:report.status,
  verified:report.verified,required:report.required,blocked:report.blocked,
  artifact:"artifacts/m21/acceptance.json",walletTransactions:0,publicBetaOpen:false},null,2));
 if(process.argv.includes("--strict")&&report.status!=="awaiting-independent-security-review")
  process.exitCode=2;
}
main().catch(e=>{console.error("M21 evidence failed closed:",e instanceof Error?e.message:"unknown");process.exitCode=2;});
