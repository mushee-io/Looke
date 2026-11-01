export const CONFIRMATIONS:bigint;
export const MAX_BATCH_BLOCKS:bigint;
export function checkedBlockHash(value:unknown):string;
export function planConfirmedWindow(args:{lastBlock?:bigint|null;startBlock:bigint;head:bigint;confirmations?:bigint;batchSize?:bigint}):{
 ready:boolean;fromBlock:bigint;toBlock:bigint|null;confirmedThrough:bigint|null;
};
export function checkCursorContinuity(cursorHash:unknown,canonicalHash:unknown):boolean;
export function checkedSwapAmounts(value:unknown):string[];
export function swapDirection(input:{amount0In:string;amount1In:string;amount0Out:string;amount1Out:string}):string;
