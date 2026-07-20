import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { claudeAdapter } from './adapters/claude'
import { openaiAiAdapter } from './adapters/openai'
import type { AiPort } from './port'

export const aiRegistry = createRegistry<AiPort>('ai', providerFor('ai'), [claudeAdapter, openaiAiAdapter])

export type * from './port'
