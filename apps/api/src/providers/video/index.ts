import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { bunnyAdapter } from './adapters/bunny'
import type { VideoPort } from './port'

export const videoRegistry = createRegistry<VideoPort>('video', readEnv('VIDEO_PROVIDER') ?? 'bunny', [
  bunnyAdapter,
])

export type * from './port'
