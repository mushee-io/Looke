/**
 * Read-only Vercel configuration inspection. Requires operator-provided
 * VERCEL_TOKEN in the operator's own environment, never in source or CI.
 * Does NOT create, deploy, change environment vars or bypass protection.
 */
import {assessVercelProtection,EXPECTED_VERCEL_TEAM,EXPECTED_PROJECT,
  type VercelProject,type VercelEnvironmentVariable} from "../src/lib/ops/m9-vercel";

async function readVercel<T>(url:string,token:string):Promise<T>{
  const response=await fetch(url,{method:"GET",headers:{
    Authorization:`Bearer ${token}`,Accept:"application/json",
  },cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`Vercel read-only API returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}
async function main(){
  const token=process.env.VERCEL_TOKEN;
  if(!token)throw new Error("BLOCKED: VERCEL_TOKEN unavailable. An authorized team member must inspect staging.");
  const team=encodeURIComponent(EXPECTED_VERCEL_TEAM),project=encodeURIComponent(EXPECTED_PROJECT);
  const base="https://api.vercel.com";
  const p=await readVercel<VercelProject>(`${base}/v10/projects/${project}?teamId=${team}`,token);
  const e=await readVercel<{envs?:VercelEnvironmentVariable[]}>(`${base}/v10/projects/${project}/env?teamId=${team}`,token);
  const audit=assessVercelProtection(p,e.envs??[]);
  console.log(JSON.stringify(audit,null,2));
  console.log("No project/env/deployment writes, wallet signatures or public release were performed.");
  console.log("A metadata pass NEVER verifies signed-out browser access; a separate human must test that.");
  if(audit.status!=="verified-metadata")process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Vercel inspection blocked.");process.exitCode=2;});
