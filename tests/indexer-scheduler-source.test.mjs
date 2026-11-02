import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const workflow=readFileSync(new URL("../.github/workflows/indexer-staging.yml",import.meta.url),"utf8");
const runner=readFileSync(new URL("../scripts/run-indexer.mjs",import.meta.url),"utf8");
test("operational scheduler is deliberately opt-in and prevents parallel jobs",()=>{
 assert.match(workflow,/vars\.LOOKE_INDEXER_SCHEDULER_ENABLED == 'true'/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/timeout-minutes: 12/);
 assert.match(workflow,/permissions:\s*\n\s+contents: read/);
 assert.match(workflow,/secrets\.LOOKE_INDEXER_SECRET/);
 assert.match(workflow,/secrets\.LOOKE_SCHEDULER_BASE_URL/);
});
test("runner never stores credentials, follows redirects or constructs wallet actions",()=>{
 assert.match(runner,/redirect:"error"/);
 assert.match(runner,/AbortSignal\.timeout\(25000\)/);
 assert.match(runner,/telemetryRecorded!==true/);
 assert.doesNotMatch(runner,/signTransaction|sendTransaction|privateKey|approve\(/);
});
