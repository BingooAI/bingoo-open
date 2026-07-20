// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import OpenAI from 'openai'
import { readEnv, requireEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import type { AudioFormat, SynthesizeInput, SynthesizeResult, TtsPort } from '../port'

const REQUIRED = ['OPENAI_API_KEY'] as const

const FORMAT: Record<AudioFormat, 'mp3' | 'wav' | 'pcm' | 'opus'> = {
  mp3: 'mp3',
  wav: 'wav',
  pcm: 'pcm',
  ogg: 'opus',
}
const CONTENT_TYPE: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pcm: 'audio/L16',
  opus: 'audio/ogg',
}

export const openaiTtsAdapter: ProviderAdapter<TtsPort> = {
  key: 'openai',
  requiredEnv: REQUIRED,
  create(): TtsPort {
    const env = requireEnv('tts', 'openai', REQUIRED)
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: readEnv('OPENAI_BASE_URL') })
    const defaultModel = readEnv('OPENAI_TTS_MODEL') ?? 'gpt-4o-mini-tts'
    const defaultVoice = readEnv('OPENAI_TTS_VOICE') ?? 'alloy'

    return {
      async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
        const format = FORMAT[input.format ?? 'mp3']
        const res = await client.audio.speech.create(
          {
            model: input.model ?? defaultModel,
            voice: (input.voice ?? defaultVoice) as OpenAI.Audio.SpeechCreateParams['voice'],
            input: input.text,
            response_format: format,
          },
          input.signal ? { signal: input.signal } : {},
        )
        const audio = new Uint8Array(await res.arrayBuffer())
        return { audio, contentType: CONTENT_TYPE[format] ?? 'audio/mpeg' }
      },
    }
  },
}
