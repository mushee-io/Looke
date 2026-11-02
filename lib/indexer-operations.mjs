/** Pure M20 operational rules. No source configuration means NOT READY. */
const ADDRESS=/^0x[0-9a-f]{40}$/i;
export const INDEXER_STATUS_STALE_MS=30*60*1000;
export const MAX_SCHEDULE_POOLS=8;
export const DEFAULT_BATCHES_PER_STREAM=4;
export function checkedIndexerEndpoint(value){
 if(typeof value!=="string")throw new RangeError("Missing scheduler base URL");
 let url;
 try{url=new URL(value);}catch{throw new RangeError("Invalid scheduler base URL");}
 if(url.protocol!=="https:"||!url.hostname||url.username||url.password||
    url.search||url.hash||url.pathname!=="/"||
    url.hostname==="localhost"||url.hostname.endsWith(".local")||
    url.hostname.endsWith(".internal")||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||
    url.hostname.includes(":"))
  throw new RangeError("Scheduler requires an HTTPS host URL without credentials or path");
 return url.origin;
}
export function checkedIndexerPoolList(value){
 if(value===undefined||value===null||value==="")return [];
 if(typeof value!=="string")throw new RangeError("Invalid pool allowlist");
 const values=value.split(",").map(x=>x.trim().toLowerCase());
 if(values.length>MAX_SCHEDULE_POOLS||values.some(x=>!ADDRESS.test(x)||/^0x0{40}$/.test(x)))
  throw new RangeError("Scheduler only accepts up to eight valid pool addresses");
 if(new Set(values).size!==values.length)throw new RangeError("Duplicate scheduled pool");
 return values;
}
export function scheduledIndexerStreams(pools=[]){
 if(!Array.isArray(pools)||pools.length>MAX_SCHEDULE_POOLS||
   pools.some(x=>typeof x!=="string"||!ADDRESS.test(x)))
  throw new RangeError("Invalid scheduled source pool");
 return [{kind:"coins",pool:null},
  ...pools.map(pool=>({kind:"swaps",pool:pool.toLowerCase()}))];
}
export function sanitizedIndexerFailure(error){
 const message=error instanceof Error?error.message:String(error??"");
 if(/reorg|canonical|block changed|checkpoint/i.test(message))return "chain_continuity";
 if(/cursor|legacy/i.test(message))return "cursor_reconciliation";
 if(/allowlist|configure|start block|pool/i.test(message))return "source_configuration";
 if(/network|chain/i.test(message))return "wrong_chain";
 return "ingestion_unavailable";
}
export function inspectIndexerStream({configured,startBlock,head,cursor,heartbeat,canonicalMatch,now=new Date()}){
 const stamp=new Date(now).getTime();
 if(!Number.isFinite(stamp))throw new RangeError("Invalid health timestamp");
 if(!configured)return {status:"unconfigured",ready:false,lagBlocks:null};
 const start=startBlock===null||startBlock===undefined?null:BigInt(startBlock);
 if(start===null||start<BigInt(0))return {status:"missing_start_block",ready:false,lagBlocks:null};
 if(head===null||head===undefined)return {status:"rpc_unavailable",ready:false,lagBlocks:null};
 const current=BigInt(head);
 const confirmed=current>=BigInt(12)?current-BigInt(12):null;
 if(confirmed===null||confirmed<start)return {status:"awaiting_confirmations",ready:false,lagBlocks:null};
 if(!cursor){
  return {status:"awaiting_first_checkpoint",ready:false,lagBlocks:(confirmed-start+BigInt(1)).toString()};
 }
 const height=BigInt(cursor.lastBlock);
 const lag=(confirmed-height);
 if(!cursor.lastBlockHash)return {status:"legacy_checkpoint",ready:false,lagBlocks:lag.toString()};
 if(lag<BigInt(0)||height<start)return {status:"cursor_out_of_range",ready:false,lagBlocks:lag.toString()};
 if(canonicalMatch===null)return {status:"canonical_unavailable",ready:false,lagBlocks:lag.toString()};
 if(canonicalMatch!==true)return {status:"canonical_mismatch",ready:false,lagBlocks:lag.toString()};
 if(heartbeat?.lastStatus==="failed")
  return {status:"last_attempt_failed",ready:false,lagBlocks:lag.toString(),
    errorCode:heartbeat.lastErrorCode??"ingestion_unavailable"};
 const latest=heartbeat?.lastAttemptAt?new Date(heartbeat.lastAttemptAt).getTime():NaN;
 if(!Number.isFinite(latest)||stamp-latest>INDEXER_STATUS_STALE_MS||stamp<latest-60_000)
  return {status:"worker_stale",ready:false,lagBlocks:lag.toString()};
 if(lag>BigInt(250))return {status:"behind_confirmed_frontier",ready:false,lagBlocks:lag.toString()};
 return {status:lag===BigInt(0)?"caught_up":"within_one_batch",ready:true,lagBlocks:lag.toString()};
}
