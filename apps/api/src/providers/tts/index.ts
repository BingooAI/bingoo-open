import { readEnv } from '../core/config'
import { createRegistry } from '../core/registry'
import { elevenlabsAdapter } from './adapters/elevenlabs'
import { openaiTtsAdapter } from './adapters/openai'
import type { TtsPort } from './port'

export const ttsRegistry = createRegistry<TtsPort>('tts', readEnv('TTS_PROVIDER') ?? 'elevenlabs', [
  elevenlabsAdapter,
  openaiTtsAdapter,
])

export type * from './port'
