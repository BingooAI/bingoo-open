import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { claudeAdapter } from './adapters/claude'
import { openaiAiAdapter } from './adapters/openai'
import type { AiPort } from './port'

export const aiRegistry = createRegistry<AiPort>('ai', readEnv('AI_PROVIDER') ?? 'claude', [
  claudeAdapter,
  openaiAiAdapter,
])

export type * from './port'
