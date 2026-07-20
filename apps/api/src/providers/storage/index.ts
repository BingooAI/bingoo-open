import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { r2Adapter } from './adapters/r2'
import type { StoragePort } from './port'

export const storageRegistry = createRegistry<StoragePort>('storage', readEnv('STORAGE_PROVIDER') ?? 'r2', [
  r2Adapter,
])

export type * from './port'
