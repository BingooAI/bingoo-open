import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { postgresSearchAdapter } from './adapters/postgres'
import type { SearchPort } from './port'

export const searchRegistry = createRegistry<SearchPort>('search', readEnv('SEARCH_PROVIDER') ?? 'postgres', [
  postgresSearchAdapter,
])

export type * from './port'
