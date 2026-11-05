/** One-shot public EIP-191 acceptance witness instructions and verification.
 * NEVER asks for private keys, signs on behalf of a user or creates sessions.
 */
import {readFile} from "node:fs/promises";
import {createWitnessChallenge,witnessMessage,verifyWitness} from "../src/lib/beta/m22-witness";
function option(name:string){
 const index=process.argv.indexOf("--"+name);
 return index<0?undefined:process.argv[index+1];
}
async function main(){
 const action=process.argv[2];
 const expectedOrigin=option("origin"),expectedRevision=option("commit");
 if(!expectedOrigin||!expectedRevision)throw Error("--origin and --commit of exact protected Preview are required.");
 if(action==="create"){
  const wallet=option("wallet");
  if(!wallet)throw Error("--wallet is required to create a public challenge.");
  const challenge=createWitnessChallenge({
   address:wallet,origin:expectedOrigin,previewCommit:expectedRevision,
  });
  console.log(JSON.stringify({challenge,message:witnessMessage(challenge),
   next:"Have this wallet personally sign the exact text with personal_sign (message-only). Do NOT sign any transaction or send a private key. Save {challenge,signature} to a local JSON file; verify within five minutes.",
   betaApproved:false,transactionsSent:0},null,2));
  return;
 }
 if(action==="verify"){
  const file=option("file");
  if(!file)throw Error("--file with the public {challenge,signature} object is required.");
  const data=JSON.parse(await readFile(file,"utf8"));
  const result=await verifyWitness(data,{
   expectedOrigin,expectedRevision,
  });
  console.log(JSON.stringify(result,null,2));
  if(result.status!=="cryptographic-proof-only")process.exitCode=2;
  return;
 }
 throw Error("Use: m22:witness -- create|verify --origin https://... --commit 40charsha [--wallet 0x...] [--file signed.json]");
}
main().catch(e=>{console.error("M22 wallet witness BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
