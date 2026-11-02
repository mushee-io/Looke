export const INDEXER_STATUS_STALE_MS:number;
export const MAX_SCHEDULE_POOLS:number;
export const DEFAULT_BATCHES_PER_STREAM:number;
export function checkedIndexerEndpoint(value:unknown):string;
export function checkedIndexerPoolList(value:unknown):string[];
export function scheduledIndexerStreams(pools?:string[]):Array<{kind:"coins"|"swaps";pool:string|null}>;
export function sanitizedIndexerFailure(error:unknown):string;
export function inspectIndexerStream(args:{
 configured:boolean;startBlock:string|number|bigint|null;head:string|number|bigint|null;
 cursor:{lastBlock:string|number|bigint;lastBlockHash:string|null}|null;
 heartbeat:{lastStatus:string;lastErrorCode?:string|null;lastAttemptAt:string|Date|null}|null;
 canonicalMatch:boolean|null;now?:string|Date;
}):{status:string;ready:boolean;lagBlocks:string|null;errorCode?:string};
