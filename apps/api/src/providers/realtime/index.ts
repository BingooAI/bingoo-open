import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { livekitAdapter } from './adapters/livekit'
import type { RealtimePort } from './port'

export const realtimeRegistry = createRegistry<RealtimePort>(
  'realtime',
  readEnv('REALTIME_PROVIDER') ?? 'livekit',
  [livekitAdapter],
)

export type * from './port'
