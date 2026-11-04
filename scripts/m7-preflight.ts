/**
 * No-network, no-signature staging release preflight.
 * Exits nonzero if a public/write-capable capability has been enabled by accident.
 */
import {releaseControlsFromEnv} from "../src/lib/ops/policy";
const state=releaseControlsFromEnv(process.env);
if(!state.safe){
  console.error("M7 staging preflight BLOCKED: unsafe release flags:",state.violations.join(", "));
  process.exitCode=2;
}else{
  console.log("M7 staging preflight passed: public beta, trading, social writes and evidence endpoints are all disabled.");
  console.log("This is configuration-only; Testnet proof, hosting access protection and security review remain unverified.");
}
