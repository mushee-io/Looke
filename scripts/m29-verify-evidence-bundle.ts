/** Verify eight REAL evidence files by exact bytes and two externally signed
 * role-scoped references; never claims audit contents or human signoff is approved.
 */
import {createHash} from "node:crypto";
import {constants} from "node:fs";
import {open,mkdir,writeFile} from "node:fs/promises";
import {verifyM29Packet} from "../src/lib/beta/m29-evidence-packet";
async function main(){
 const arg=(key:string)=>{const i=process.argv.indexOf("--"+key);return i<0?undefined:process.argv[i+1];};
 const file=arg("manifest"),dir=arg("directory");
 if(!file||!dir)throw Error("Explicit --manifest real.json and --directory with actual external report files are required.");
 const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 let bytes:Buffer;
 try{
  const st=await h.stat();if(!st.isFile()||st.size<1||st.size>150000)throw Error("Small real regular manifest JSON required.");
  bytes=await h.readFile();if(bytes.length!==st.size)throw Error("Manifest changed while reading.");
 }finally{await h.close();}
 const result=await verifyM29Packet(JSON.parse(bytes.toString("utf8")),dir);
 await mkdir("artifacts/m29",{recursive:true});
 const report={...result,rawManifestSha256:createHash("sha256").update(bytes).digest("hex"),
  verifiedAt:new Date().toISOString(),humanSecurityApprovalAccepted:false};
 await writeFile("artifacts/m29/checked-operator-evidence.json",JSON.stringify(report,null,2)+"\n",{mode:0o600});
 console.log(JSON.stringify({fileDigestsChecked:result.bytesConfirmed.length,
  twoSeparatePublicSignatures:true,independentlyAuditedContents:false,release:"NO_GO"}));
}
main().catch(e=>{console.error("M29 original-file security evidence BLOCKED:",e instanceof Error?e.message:"unknown");process.exitCode=2;});
