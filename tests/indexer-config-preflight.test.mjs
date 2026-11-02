import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectIndexerConfig } from '../scripts/check-indexer-config.mjs';

const addr = '0x' + 'a'.repeat(40);
test('safe default does not authorize activation', () => {
  const result = inspectIndexerConfig({});
  assert.equal(result.ok, true);
  assert.equal(result.activationAuthorized, false);
});
test('enabled scheduler fails closed', () => {
  const result = inspectIndexerConfig({ LOOKE_INDEXER_SCHEDULER_ENABLED: 'true' });
  assert.equal(result.ok, false);
  assert.equal(result.activationAuthorized, false);
});
test('weak or reused credentials fail without leaking their values', () => {
  const result = inspectIndexerConfig({ LOOKE_INDEXER_SECRET: 'short', LOOKE_INDEXER_MONITOR_SECRET: 'short' });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('short'), false);
});
test('invalid factory block, pool duplication and excessive pools fail', () => {
  const result = inspectIndexerConfig({
    LOOKE_FACTORY_TESTNET_ADDRESS: addr,
    LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK: '-1',
    LOOKE_ALLOWED_TESTNET_POOLS: [addr, addr].join(',')
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length >= 2, true);
});
test('valid source shape is still not deployment approval', () => {
  const result = inspectIndexerConfig({
    LOOKE_FACTORY_TESTNET_ADDRESS: addr,
    LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK: '0',
    LOOKE_INDEXER_SECRET: 'a'.repeat(32),
    LOOKE_INDEXER_MONITOR_SECRET: 'b'.repeat(32),
    LOOKE_INDEXER_SCHEDULER_ENABLED: 'false'
  });
  assert.equal(result.ok, true);
  assert.equal(result.activationAuthorized, false);
});
