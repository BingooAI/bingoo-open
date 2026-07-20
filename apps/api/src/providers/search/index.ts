import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { postgresSearchAdapter } from './adapters/postgres'
import type { SearchPort } from './port'

export const searchRegistry = createRegistry<SearchPort>('search', providerFor('search'), [
  postgresSearchAdapter,
])

export type * from './port'
