/** Bind actual local external artifact bytes to a previously signed M23 evidence hash.
 * Read-only database lookup and local file hash; does NOT certify audit quality.
 */
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {lstat,mkdir,writeFile} from "node:fs/promises";
import {Pool} from "pg";
import {z} from "zod";
const uuid=z.string().uuid();
async function hashFile(path:string){
 const stat=await lstat(path);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>50_000_000)
  throw Error("Artifact must be a regular file at most 50 MB, not a symlink.");
 const sha=createHash("sha256");
 for await (const chunk of createReadStream(path))sha.update(chunk);
 return {sha256:sha.digest("hex"),bytes:stat.size};
}
async function main(){
 const pos=(key:string)=>process.argv.indexOf("--"+key);
 const opt=(key:string)=>{const i=pos(key);return i>=0?process.argv[i+1]:undefined;};
 const file=opt("file"),id=uuid.parse(opt("evidence-id")),sha=opt("commit");
 if(!file||!sha||!/^[a-f0-9]{40}$/.test(sha)||!process.env.DATABASE_URL)
  throw Error("Explicit --file, --evidence-id, --commit and DATABASE_URL are required.");
 const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,
  connectionTimeoutMillis:7000});
 try{
  const r=await pool.query<{kind:string;evidence_sha256:string;preview_sha:string;
   evidence_url:string;auditor:string}>(`SELECT kind,evidence_sha256,preview_sha,evidence_url,auditor
   FROM social_beta_evidence_signatures WHERE id=$1 AND preview_sha=$2`,[id,sha]);
  if(r.rowCount!==1)throw Error("No verified M23 signed evidence reference for this commit.");
  const bytes=await hashFile(file);
  const match=bytes.sha256===r.rows[0].evidence_sha256;
  const output={milestone:"M24",source:"local-file-bytes-and-real-M23-signed-record",
   evidenceId:id,previewSha:sha,kind:r.rows[0].kind,
   externalReference:r.rows[0].evidence_url,actualBytes:bytes.bytes,
   calculatedSha256:bytes.sha256,expectedSha256:r.rows[0].evidence_sha256,
   digestMatched:match,independentAuditQualityVerified:false,
   actualRestoreWitnessVerified:false,operatorBetaPermission:false,transactionsSent:0};
  await mkdir("artifacts/m24",{recursive:true});
  await writeFile("artifacts/m24/evidence-digest.json",JSON.stringify(output,null,2)+"\n",
   {mode:0o600});
  console.log(JSON.stringify({digestMatched:match,bytes:bytes.bytes,
   evidenceId:id,releaseDecision:"NO_GO"},null,2));
  if(!match)process.exitCode=2;
 }finally{await pool.end();}
}
main().catch(e=>{console.error("M24 independent artifact digest BLOCKED:",
 e instanceof Error?e.message:"unknown");process.exitCode=2;});
