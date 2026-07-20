import { providerFor } from '../core/profile'
import { createRegistry } from '../core/registry'
import { elevenlabsAdapter } from './adapters/elevenlabs'
import { openaiTtsAdapter } from './adapters/openai'
import type { TtsPort } from './port'

export const ttsRegistry = createRegistry<TtsPort>('tts', providerFor('tts'), [
  elevenlabsAdapter,
  openaiTtsAdapter,
])

export type * from './port'
