import "server-only";
import {createHash,timingSafeEqual} from "node:crypto";
import {database} from "@/lib/server/database";
import {sanitizedIndexerFailure} from "@/lib/indexer-operations.mjs";

const SUCCESS=new Set(["indexed","caught_up","awaiting_confirmations",
 "cursor_advanced_by_other_worker"]);
export function operatorAuthorized(request:Request,envName:"LOOKE_INDEXER_SECRET"|"LOOKE_INDEXER_MONITOR_SECRET"){
 const required=process.env[envName];
 if(!required||required.length<32)return false;
 const bearer=request.headers.get("authorization");
 if(!bearer?.startsWith("Bearer "))return false;
 const presented=bearer.slice(7);
 if(presented.length<32||presented.length>1024)return false;
 const hash=(x:string)=>createHash("sha256").update(x).digest();
 return timingSafeEqual(hash(presented),hash(required));
}
type Heartbeat={key:string;status:string;indexed?:number;confirmedThrough?:string|null;error?:unknown};
/**
 * Stores only sanitized operational metadata. Does not modify indexer cursor,
 * events, proof, wallet state, trading or previous confirmed chain history.
 */
export async function recordIndexerHeartbeat({key,status,indexed=0,
 confirmedThrough=null,error}:Heartbeat){
 if(!/^ultra-evm-testnet(?::pool:0x[0-9a-f]{40})?$/.test(key))
  throw new Error("Invalid monitored indexer stream");
 const outcome=SUCCESS.has(status)?status:"failed";
 const errorCode=outcome==="failed"?sanitizedIndexerFailure(error):null;
 const confirmed=confirmedThrough && /^\d{1,18}$/.test(confirmedThrough)?
  confirmedThrough:null;
 const sql=database();
 await sql`
  INSERT INTO looke_indexer_operations(
   stream_key,last_attempt_at,last_success_at,last_status,
   consecutive_failures,last_error_code,last_indexed_count,last_confirmed_block
  ) VALUES(
   ${key},now(),CASE WHEN ${outcome}='failed' THEN NULL ELSE now() END,
   ${outcome},CASE WHEN ${outcome}='failed' THEN 1 ELSE 0 END,
   ${errorCode},${Number.isInteger(indexed)&&indexed>=0?indexed:0},
   ${confirmed}::bigint
  )
  ON CONFLICT(stream_key) DO UPDATE SET
   last_attempt_at=now(),
   last_success_at=CASE WHEN excluded.last_status='failed'
     THEN looke_indexer_operations.last_success_at ELSE now() END,
   last_status=excluded.last_status,
   consecutive_failures=CASE WHEN excluded.last_status='failed'
     THEN least(looke_indexer_operations.consecutive_failures+1,2147483647)
     ELSE 0 END,
   last_error_code=excluded.last_error_code,
   last_indexed_count=excluded.last_indexed_count,
   last_confirmed_block=excluded.last_confirmed_block
 `;
}
