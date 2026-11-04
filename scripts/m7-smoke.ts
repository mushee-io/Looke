import assert from "node:assert/strict";
const base="http://127.0.0.1:3100";
async function request(path:string){
  const r=await fetch(base+path,{cache:"no-store",signal:AbortSignal.timeout(30000),redirect:"manual"});
  return {r,body:await r.json() as Record<string,unknown>};
}
async function main(){
  const monitor=await request("/api/ops/monitor");
  assert.equal(monitor.r.headers.get("cache-control"),"no-store, max-age=0");
  assert.equal(monitor.body.service,"looke-m7");
  assert.equal(monitor.body.beta,"closed");
  assert.ok(monitor.r.status===200||monitor.r.status===503);
  assert.equal(typeof monitor.body.checkedAt,"string");
  const checks=monitor.body.checks as Array<{id:string;status:string}>|undefined;
  assert.ok(Array.isArray(checks));
  assert.equal(checks?.length,4);
  // Without a staging database, a degraded/503 result is a CORRECT monitoring alert.
  if(!process.env.DATABASE_URL){
    assert.equal(monitor.r.status,503);
    assert.equal(monitor.body.status,"degraded");
  }
  const policy=await request("/api/beta/readiness?mode=config");
  assert.equal(policy.body.publicBetaOpen,false);
  const proof=await request("/api/beta/evidence?kind=coin");
  assert.equal(proof.r.status,403);
  assert.equal(proof.body.verified,false);
  console.log("M7 loopback monitoring smoke passed; default closed beta and proof controls confirmed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
