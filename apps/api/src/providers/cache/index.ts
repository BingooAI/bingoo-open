import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { redisAdapter } from './adapters/redis'
import type { CachePort } from './port'

export const cacheRegistry = createRegistry<CachePort>('cache', providerFor('cache'), [redisAdapter])

export type * from './port'
