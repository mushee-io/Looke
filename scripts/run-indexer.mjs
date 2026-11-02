#!/usr/bin/env node
import {checkedIndexerEndpoint,checkedIndexerPoolList,scheduledIndexerStreams,
 DEFAULT_BATCHES_PER_STREAM} from "../lib/indexer-operations.mjs";

function requiredSecret(key){
 const value=process.env[key];
 if(!value||value.length<32)throw new Error(key+" is missing or too short");
 return value;
}
async function request(url,token,method="POST"){
 const response=await fetch(url,{
  method,headers:{"Authorization":"Bearer "+token,"Accept":"application/json"},
  redirect:"error",cache:"no-store",signal:AbortSignal.timeout(25000)
 });
 let json;
 try{json=await response.json();}catch{throw new Error("Indexer endpoint returned invalid JSON");}
 if(!response.ok)throw new Error(
  "Indexer endpoint returned HTTP "+response.status+" ("+
   (typeof json?.error==="string"?json.error:"unavailable")+")");
 return json;
}
async function run(){
 if(process.env.LOOKE_INDEXER_SCHEDULER_ENABLED!=="true")
  throw new Error("Explicit scheduler opt-in is required");
 const url=checkedIndexerEndpoint(process.env.LOOKE_SCHEDULER_BASE_URL);
 const token=requiredSecret("LOOKE_INDEXER_SECRET");
 const pools=checkedIndexerPoolList(process.env.LOOKE_SCHEDULER_POOLS??"");
 let processed=0;
 for(const stream of scheduledIndexerStreams(pools)){
  const query=new URLSearchParams({stream:stream.kind});
  if(stream.pool)query.set("pool",stream.pool);
  for(let i=0;i<DEFAULT_BATCHES_PER_STREAM;i++){
   const result=await request(url+"/api/indexer?"+query,token);
   if(result.network!=="Ultra EVM Testnet"||result.chainId!==18881||
      result.telemetryRecorded!==true)
    throw new Error("Indexer response missing expected Ultra testnet/heartbeat marker");
   console.log("Stream",stream.kind,stream.pool??"factory","status",
    result.status,"indexed",result.indexed??0,"through",result.toBlock??"none");
   processed++;
   if(["caught_up","awaiting_confirmations"].includes(result.status))break;
   if(result.status==="cursor_advanced_by_other_worker")break;
   if(result.status!=="indexed")throw new Error("Unexpected stream status");
  }
 }
 const monitor=process.env.LOOKE_INDEXER_MONITOR_SECRET;
 if(monitor){
  if(monitor.length<32)throw new Error("Invalid monitor credential");
  const response=await fetch(url+"/api/operator/indexer/status",{
   headers:{"Authorization":"Bearer "+monitor,"Accept":"application/json"},
   redirect:"error",cache:"no-store",signal:AbortSignal.timeout(25000)
  });
  const result=await response.json();
  if(!Array.isArray(result.streams))throw new Error("Operator monitor returned invalid health data");
  const hardFailure=result.streams.some(s=>[
   "last_attempt_failed","canonical_mismatch","cursor_out_of_range",
   "legacy_checkpoint","canonical_unavailable","rpc_unavailable",
   "worker_stale","missing_start_block"
  ].includes(s.status));
  console.log("Operator readiness",result.ready?"ready":"incomplete",
   "streams",result.streams.map(s=>({kind:s.kind,status:s.status,
    lagBlocks:s.lagBlocks})));
  if(hardFailure)throw new Error("Operator indexer health indicates a halted stream");
 }
 console.log("Completed bounded indexer batches:",processed);
}
run().catch(error=>{
 console.error("Protected indexer scheduler failed:",
  error instanceof Error?error.message:"Unavailable");
 process.exitCode=1;
});
