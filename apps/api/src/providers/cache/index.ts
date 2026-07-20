import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { redisAdapter } from './adapters/redis';
import type { CachePort } from './port';

export const cacheRegistry = createRegistry<CachePort>(
  'cache',
  readEnv('CACHE_PROVIDER') ?? 'redis',
  [redisAdapter],
);

export type * from './port';
