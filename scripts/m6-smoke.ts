/**
 * Staging smoke: checks local Next.js build and every M6 default release gate is closed.
 * No external blockchain RPC or transaction broadcasting.
 */
import assert from "node:assert/strict";

const base=process.env.LOOKE_M6_SMOKE_ORIGIN || "http://127.0.0.1:3100";
if(!/^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/.test(base))throw new Error("Smoke target must be loopback only.");

async function request(path:string){
  let lastError:unknown;
  for(let attempt=0;attempt<30;attempt++){
    try{
      const response=await fetch(base+path,{signal:AbortSignal.timeout(5000),redirect:"manual"});
      return response;
    }catch(error){
      lastError=error;
      await new Promise(resolve=>setTimeout(resolve,700));
    }
  }
  throw lastError instanceof Error?lastError:new Error("Staging local server did not start.");
}
async function main(){
  const live=await request("/api/beta/health?mode=live");
  assert.equal(live.status,200,"M6 liveness route must return HTTP 200.");
  const health=await live.json() as {service:string;beta:string};
  assert.equal(health.service,"looke");
  assert.equal(health.beta,"closed-by-default");
  assert.equal(live.headers.get("cache-control"),"no-store");

  const readiness=await request("/api/beta/readiness?mode=config");
  assert.equal(readiness.status,200);
  const policy=await readiness.json() as {publicBetaOpen:boolean;stage:string;gates:unknown[]};
  assert.equal(policy.publicBetaOpen,false);
  assert.equal(policy.stage,"closed");
  assert.equal(policy.gates.length,11);
  assert.equal(readiness.headers.get("cache-control"),"no-store");

  for(const path of ["/beta","/uniqs","/trade","/social"]){
    const page=await request(path);
    assert.equal(page.status,200,`Integrated staging page ${path} must render.`);
  }
  const noProof=await request("/api/beta/evidence?kind=coin");
  assert.equal(noProof.status,403,"Public proof endpoint must be disabled by default.");
  const noPost=await fetch(base+"/api/beta/evidence",{method:"POST",redirect:"manual"});
  assert.equal(noPost.status,405,"Beta evidence endpoint must never accept writes.");
  console.log("M6 integrated staging smoke PASSED: all routes render; beta and evidence execution remain CLOSED.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
