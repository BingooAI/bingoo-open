import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { openaiEmbeddingAdapter } from './adapters/openai'
import type { EmbeddingPort } from './port'

export const embeddingRegistry = createRegistry<EmbeddingPort>('embedding', providerFor('embedding'), [
  openaiEmbeddingAdapter,
])

export type * from './port'
