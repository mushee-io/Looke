/** Probe configured Ultra EVM Testnet V2 pools read-only. No market maker and no trades. */
import {probeUltraLiquidity} from "../src/lib/ops/m9-liquidity";
async function main(){
  const report=await probeUltraLiquidity();
  console.log(JSON.stringify(report,null,2));
  if(!report.allVerified)console.log("M9 liquidity BLOCKED: no reviewed on-chain two-sided liquidity proven.");
  console.log("No swap, approval, liquidity supply, token transfer or wallet operation was performed.");
  if(process.argv.includes("--strict")&&!report.allVerified)process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Liquidity unavailable.");process.exitCode=2;});
