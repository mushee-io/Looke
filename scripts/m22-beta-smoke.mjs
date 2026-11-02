#!/usr/bin/env node
/**
 * M22 controlled staging smoke check. Requests public status endpoint only;
 * no wallet access, session cookies, signatures, deployment or transactions.
 */
import process from "node:process";
import path from "node:path";
import {fileURLToPath} from "node:url";

export function checkedBetaOrigin(value){
 if(typeof value!=="string"||value.length>256)throw new RangeError("Invalid staging origin");
 let url;
 try{url=new URL(value);}catch{throw new RangeError("Invalid staging origin");}
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.search||url.hash||
    url.pathname!=="/"||!url.hostname||url.hostname.endsWith(".")||
    url.hostname==="localhost"||url.hostname.endsWith(".localhost")||
    url.hostname.endsWith(".local")||url.hostname.endsWith(".internal")||
    url.hostname.includes(":")||/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||
    !/^[a-z0-9.-]+$/i.test(url.hostname)||!url.hostname.includes("."))
  throw new RangeError("Only an approved public HTTPS staging origin is allowed");
 return url.origin;
}
export function checkedBetaResponse(json){
 if(!json||typeof json!=="object"||Array.isArray(json)||
    json.chainId!==18881||json.milestone!=="M22"||
    json.mode!=="preview_only"||
    !Array.isArray(json.requiredGates)||json.requiredGates.length<6||
    !Array.isArray(json.sourceModules)||
    !json.requiredGates.every(g=>g.state==="external_evidence_required")||
    !json.sourceModules.some(m=>m.id==="trading"&&m.state==="disabled"))
  throw new RangeError("Invalid or incomplete beta status");
 for(const name of [
  "publicBetaOpen","publicIssuanceEnabled","publicTradingEnabled",
  "mainnetReady","approvalEligible","externalSecurityAuditAccepted",
  "protectedStagingAccepted","realUserWalletAcceptanceVerified",
  "issuerOperational","nativeUniqAccepted"
 ]){
  if(json[name]!==false)throw new RangeError("Financial or security beta gate unexpectedly active");
 }
 return {
  network:json.network,
  chainId:json.chainId,
  mode:json.mode,
  rpcObservation:json.observation?.state==="rpc_reachable"?"rpc_reachable":"unverified",
  publicBetaOpen:false,issuanceEnabled:false,tradingEnabled:false,
  mainnetReady:false,externallyApproved:false
 };
}
export async function smokeBetaStaging(base,{request=fetch}={}){
 const origin=checkedBetaOrigin(base);
 const response=await request(origin+"/api/beta/status",{
  method:"GET",cache:"no-store",redirect:"error",credentials:"omit",
  signal:AbortSignal.timeout(10000)
 });
 if(response.status!==200)throw new Error("Staging beta status endpoint unavailable");
 const type=response.headers.get("content-type")??"";
 if(!type.toLowerCase().includes("application/json"))
  throw new Error("Staging response must be JSON");
 const size=response.headers.get("content-length");
 if(size && (!/^\d+$/.test(size)||Number(size)>16384))
  throw new Error("Oversized beta readiness response");
 const body=await response.text();
 if(body.length>16384)throw new Error("Oversized beta readiness response");
 return checkedBetaResponse(JSON.parse(body));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||process.argv[2]!=="--read-only"||
    process.env.LOOKE_BETA_SMOKE_ACK!=="READ_ONLY"){
  process.stderr.write("NO-GO: only --read-only with LOOKE_BETA_SMOKE_ACK=READ_ONLY can inspect a configured HTTPS staging origin.\n");
  process.exitCode=2;
 }else{
  try{
   const status=await smokeBetaStaging(process.env.LOOKE_BETA_STAGING_ORIGIN);
   process.stdout.write(JSON.stringify(status,null,2)+"\n");
  }catch{
   process.stderr.write("NO-GO: staging status or safe beta policy could not be independently observed.\n");
   process.exitCode=1;
  }
 }
}
