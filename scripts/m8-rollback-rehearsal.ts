/**
 * DRY RUN ONLY; never calls Vercel APIs, never changes env or alias.
 * Requires an operator to enact any real rollback with provider access.
 */
import {rehearseRollback} from "../src/lib/ops/m8-rollback";
const rehearsal=rehearseRollback();
console.log(JSON.stringify(rehearsal,null,2));
console.log("Manual action required to restore Vercel settings and verify signed-out access protection.");
