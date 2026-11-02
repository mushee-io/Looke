// Offline M20 operator configuration preflight. No network or secret disclosure.
import { pathToFileURL } from 'node:url';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
export function inspectIndexerConfig(env) {
  const errors = [];
  const warnings = [];
  const enabled = env.LOOKE_INDEXER_SCHEDULER_ENABLED === 'true';
  if (env.LOOKE_INDEXER_SCHEDULER_ENABLED && !['true', 'false'].includes(env.LOOKE_INDEXER_SCHEDULER_ENABLED)) {
    errors.push('scheduler flag must be literal true or false');
  }
  if (enabled) errors.push('scheduler is enabled: this offline preflight cannot authorize activation');
  const secret = env.LOOKE_INDEXER_SECRET || '';
  const monitor = env.LOOKE_INDEXER_MONITOR_SECRET || '';
  if (secret && secret.length < 32) errors.push('indexer bearer must contain at least 32 characters');
  if (monitor && monitor.length < 32) errors.push('monitor bearer must contain at least 32 characters');
  if (secret && monitor && secret === monitor) errors.push('indexer and monitor bearers must differ');
  if (!secret || !monitor) warnings.push('one or more server-side bearer credentials are absent');
  for (const name of ['LOOKE_FACTORY_TESTNET_ADDRESS']) {
    if (env[name] && !ADDRESS.test(env[name])) errors.push(name + ' is not a canonical EVM address');
  }
  const deployBlock = env.LOOKE_FACTORY_TESTNET_DEPLOY_BLOCK;
  if (deployBlock !== undefined && !/^(0|[1-9][0-9]*)$/.test(deployBlock)) errors.push('factory deployment block must be a nonnegative decimal integer');
  const pools = (env.LOOKE_ALLOWED_TESTNET_POOLS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (pools.length > 8) errors.push('more than eight pool addresses configured');
  if (pools.some(x => !ADDRESS.test(x))) errors.push('invalid pool address');
  if (new Set(pools.map(x => x.toLowerCase())).size !== pools.length) errors.push('duplicate pool address');
  if (!env.LOOKE_FACTORY_TESTNET_ADDRESS) warnings.push('factory not configured; do not activate ingestion');
  return { ok: errors.length === 0, activationAuthorized: false, errors, warnings };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = inspectIndexerConfig(process.env);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.ok ? 0 : 1;
}
