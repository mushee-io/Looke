/** M28 operator-only proof of four public EIP-191 signatures.
 * Must use actual signed data; does not invent observer attendance or human identity.
 */
import {createHash} from "node:crypto";
import {lstat,readFile,mkdir,writeFile} from "node:fs/promises";
import {verifyDualSessionPacket} from "../src/lib/beta/m28-real-evidence";
async function main(){
 const index=process.argv.indexOf("--file"),file=index>=0?process.argv[index+1]:undefined;
 if(!file)throw Error("An actual --file PATH with four signed public wallet/observer signatures is required.");
 const stat=await lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>100000)
  throw Error("A regular non-symlink bounded JSON file is required.");
 const raw=await readFile(file);
 const packet=JSON.parse(raw.toString("utf8")) as unknown;
 const result=await verifyDualSessionPacket(packet);
 const audit={checkedAt:new Date().toISOString(),milestone:"M28",
  packetSha256:createHash("sha256").update(raw).digest("hex"),
  ...result,independentlyConfirmedInPerson:false,identityVerified:false,
  actualProtectedSessionAccepted:false,publicBetaAuthorized:false,transactionsSent:0};
 await mkdir("artifacts/m28",{recursive:true});
 await writeFile("artifacts/m28/wallet-evidence.json",JSON.stringify(audit,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({sha256:audit.packetSha256,
  wallets:audit.cryptographicWalletProofs,observers:audit.observerKeys,
  independentHumansVerified:false,launchDecision:"NO_GO"}));
}
main().catch(e=>{console.error("M28 genuine wallet evidence BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
