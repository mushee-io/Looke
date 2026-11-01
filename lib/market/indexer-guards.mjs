/**
 * M13 finality and canonical-history guards. A positive confirmation depth is
 * a risk reduction, never guaranteed finality or independent contract audit.
 */
const HASH=/^0x[0-9a-f]{64}$/i;
export const CONFIRMATIONS=12n;
export const MAX_BATCH_BLOCKS=250n;
export function checkedBlockHash(value) {
 if(typeof value!=="string"||!HASH.test(value))throw new RangeError("Invalid canonical block hash");
 return value.toLowerCase();
}
export function planConfirmedWindow({lastBlock=null,startBlock,head,confirmations=CONFIRMATIONS,batchSize=MAX_BATCH_BLOCKS}) {
 for(const value of [startBlock,head,confirmations,batchSize]) {
  if(typeof value!=="bigint"||value<0n)throw new RangeError("Invalid indexer block bound");
 }
 if(confirmations===0n || batchSize<1n || batchSize>MAX_BATCH_BLOCKS)
   throw new RangeError("Unsafe confirmation or batch size");
 if(lastBlock!==null && (typeof lastBlock!=="bigint"||lastBlock<0n))
   throw new RangeError("Invalid cursor");
 const safeHead=head>=confirmations?head-confirmations:null;
 const fromBlock=lastBlock===null?startBlock:lastBlock+1n;
 if(safeHead===null || fromBlock>safeHead)
   return {ready:false,fromBlock,toBlock:null,confirmedThrough:safeHead};
 const toBlock=fromBlock+batchSize-1n<=safeHead?fromBlock+batchSize-1n:safeHead;
 return {ready:true,fromBlock,toBlock,confirmedThrough:safeHead};
}
export function checkCursorContinuity(cursorHash,canonicalHash) {
 return checkedBlockHash(cursorHash)===checkedBlockHash(canonicalHash);
}
export function checkedSwapAmounts(value) {
 if(!value||typeof value!=="object"||Array.isArray(value))throw new RangeError("Invalid swap record");
 const amounts=["amount0In","amount1In","amount0Out","amount1Out"].map(k=>{
  const v=value[k]; if(typeof v!=="bigint"||v<0n||v>=2n**256n)
    throw new RangeError("Swap amounts must be unsigned uint256 values");
  return v;
 });
 if(amounts.every(v=>v===0n))throw new RangeError("Empty swap event");
 return amounts.map(v=>v.toString());
}
export function swapDirection({amount0In,amount1In,amount0Out,amount1Out}) {
 const [a,b,c,d]=[amount0In,amount1In,amount0Out,amount1Out].map(v=>{
  if(typeof v!=="string"||!/^(0|[1-9][0-9]*)$/.test(v))throw new RangeError("Invalid stored amount");
  return BigInt(v);
 });
 if(a>0n&&b===0n&&c===0n&&d>0n)return "token0_to_token1";
 if(b>0n&&a===0n&&d===0n&&c>0n)return "token1_to_token0";
 return "complex_swap";
}
