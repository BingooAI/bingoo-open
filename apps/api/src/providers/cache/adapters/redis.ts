import Redis from 'ioredis';
import { requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import type { CachePort } from '../port';

const REQUIRED = ['REDIS_URL'] as const;

export const redisAdapter: ProviderAdapter<CachePort> = {
  key: 'redis',
  requiredEnv: REQUIRED,
  create(): CachePort {
    const env = requireEnv('cache', 'redis', REQUIRED);
    // lazyConnect: no socket is opened until the first command, so importing the
    // provider (or a readiness check) never forces a connection. maxRetries keeps
    // a down Redis from hanging requests — it surfaces as a 502 instead.
    const client = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });

    return {
      async get(key) {
        return client.get(key);
      },
      async set(key, value, ttlSeconds) {
        if (ttlSeconds) await client.set(key, value, 'EX', ttlSeconds);
        else await client.set(key, value);
      },
      async getJson<T>(key: string): Promise<T | null> {
        const raw = await client.get(key);
        return raw === null ? null : (JSON.parse(raw) as T);
      },
      async setJson<T>(key: string, value: T, ttlSeconds?: number) {
        const raw = JSON.stringify(value);
        if (ttlSeconds) await client.set(key, raw, 'EX', ttlSeconds);
        else await client.set(key, raw);
      },
      async delete(key) {
        await client.del(key);
      },
      async has(key) {
        return (await client.exists(key)) === 1;
      },
      async increment(key, by = 1) {
        return client.incrby(key, by);
      },
      async expire(key, ttlSeconds) {
        await client.expire(key, ttlSeconds);
      },
    };
  },
};
