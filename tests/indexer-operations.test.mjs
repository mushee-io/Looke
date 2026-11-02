import test from "node:test";
import assert from "node:assert/strict";
import {checkedIndexerEndpoint,checkedIndexerPoolList,scheduledIndexerStreams,
 sanitizedIndexerFailure,inspectIndexerStream} from "../lib/indexer-operations.mjs";
const pool="0x"+"a".repeat(40),another="0x"+"b".repeat(40);
test("scheduler URL never sends an indexer bearer to insecure/internal or credential-bearing hosts",()=>{
 assert.equal(checkedIndexerEndpoint("https://looke.example/"),"https://looke.example");
 for(const url of ["http://looke.example/","https://user:pass@looke.example/",
  "https://looke.example/anything","https://looke.example/?x=1",
  "https://localhost/","https://127.0.0.1/","https://test.internal/",
  "https://[::1]/","https://localhost./","https://test.internal./",
  "https://looke.example./","foo",null])
  assert.throws(()=>checkedIndexerEndpoint(url),RangeError);
});
test("configured scheduler streams are bounded, unique and contain no inferred source",()=>{
 assert.deepEqual(scheduledIndexerStreams(checkedIndexerPoolList("")),[{kind:"coins",pool:null}]);
 assert.deepEqual(scheduledIndexerStreams(checkedIndexerPoolList(pool+","+another)),[
  {kind:"coins",pool:null},{kind:"swaps",pool},{kind:"swaps",pool:another}]);
 for(const value of [pool+","+pool,pool+",malformed",Array(9).fill(pool).join(","),
  "0x"+"0".repeat(40),123])
  assert.throws(()=>checkedIndexerPoolList(value),RangeError);
});
test("canonical mismatch, stale status, failed worker and lag are not healthy",()=>{
 const input={configured:true,startBlock:"100",head:"400",
  cursor:{lastBlock:"388",lastBlockHash:"0x"+"a".repeat(64)},
  heartbeat:{lastStatus:"caught_up",lastAttemptAt:"2026-11-02T00:40:00Z"},
  canonicalMatch:true,now:"2026-11-02T00:50:00Z"};
 assert.equal(inspectIndexerStream(input).status,"caught_up");
 for(const [override,status] of [
  [{configured:false},"unconfigured"],
  [{startBlock:null},"missing_start_block"],
  [{head:null},"rpc_unavailable"],
  [{cursor:null},"awaiting_first_checkpoint"],
  [{cursor:{lastBlock:"388",lastBlockHash:null}},"legacy_checkpoint"],
  [{canonicalMatch:false},"canonical_mismatch"],
  [{heartbeat:{lastStatus:"failed",lastErrorCode:"chain_continuity",lastAttemptAt:"2026-11-02T00:49:00Z"}},"last_attempt_failed"],
  [{heartbeat:{lastStatus:"caught_up",lastAttemptAt:"2026-11-01T23:00:00Z"}},"worker_stale"],
  [{head:"700"},"behind_confirmed_frontier"],
  [{heartbeat:{lastStatus:"unexpected",lastAttemptAt:"2026-11-02T00:49:00Z"}},"worker_status_unknown"],
  [{cursor:{lastBlock:"399",lastBlockHash:"0x"+"a".repeat(64)}},"cursor_out_of_range"]
 ])assert.equal(inspectIndexerStream({...input,...override}).status,status);
});
test("categorizes sensitive service failures without exposing an RPC stack",()=>{
 assert.equal(sanitizedIndexerFailure(new Error("Chain reorganization detected")),"chain_continuity");
 assert.equal(sanitizedIndexerFailure(new Error("Legacy cursor")),"cursor_reconciliation");
 assert.equal(sanitizedIndexerFailure(new Error("Bad allowlist")),"source_configuration");
 assert.equal(sanitizedIndexerFailure(new Error("RPC timed out")),"ingestion_unavailable");
});

test("known ingestion heartbeat statuses do not silently bypass freshness checks",()=>{
 const base={configured:true,startBlock:"100",head:"400",
  cursor:{lastBlock:"388",lastBlockHash:"0x"+"a".repeat(64)},
  canonicalMatch:true,now:"2026-11-02T00:50:00Z"};
 for(const lastStatus of ["caught_up","indexed","awaiting_confirmations","cursor_advanced_by_other_worker"]){
  assert.equal(inspectIndexerStream({...base,heartbeat:{lastStatus,
   lastAttemptAt:"2026-11-02T00:49:00Z"}}).ready,true);
 }
});
