import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { bunnyAdapter } from './adapters/bunny'
import type { VideoPort } from './port'

export const videoRegistry = createRegistry<VideoPort>('video', providerFor('video'), [bunnyAdapter])

export type * from './port'
