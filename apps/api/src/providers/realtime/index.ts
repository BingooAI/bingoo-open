import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { livekitAdapter } from './adapters/livekit'
import type { RealtimePort } from './port'

export const realtimeRegistry = createRegistry<RealtimePort>('realtime', providerFor('realtime'), [
  livekitAdapter,
])

export type * from './port'
