/**
 * Generates a safe operator rollback plan, without calling Vercel
 * or modifying any deployment. Changing live env or redeploying needs
 * explicit administrator review in hosting.
 */
import {rollbackEnvironment} from "../src/lib/ops/policy";
const plan={
  action:"manual-rollback-required",
  target:"protected-ultra-testnet-staging",
  safeEnvironment:rollbackEnvironment(),
  steps:[
    "Keep or re-enable Vercel Authentication for all preview AND production deployment URLs.",
    "Set the four release/write flags to false in the correct team and environment.",
    "Review last approved Git SHA and redeploy it only after checking scope and protection.",
    "Revoke any compromised database credentials or bypass tokens in their own providers.",
    "Run /api/ops/monitor and /api/beta/readiness before inviting testers again.",
    "Do not grant public preview access until a new security review and revision-bound operator signature exist.",
  ],
  warning:"This command makes NO remote changes and cannot confirm a Vercel rollback.",
};
process.stdout.write(JSON.stringify(plan,null,2)+"\n");
