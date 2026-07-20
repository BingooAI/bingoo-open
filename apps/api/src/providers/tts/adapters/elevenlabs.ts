// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { readEnv, requireEnv } from '../../core/config'
import { ProviderError } from '../../core/errors'
import type { ProviderAdapter } from '../../core/registry'
import type { SynthesizeInput, SynthesizeResult, TtsPort, WordTiming } from '../port'

const REQUIRED = ['ELEVENLABS_API_KEY'] as const

// Map our neutral format to ElevenLabs `output_format` query values.
const OUTPUT_FORMAT: Record<string, string> = {
  mp3: 'mp3_44100_128',
  wav: 'pcm_44100',
  pcm: 'pcm_44100',
  ogg: 'mp3_44100_128',
}

/** Char-level alignment → per-word timings (whitespace splits words). */
function charsToTimings(a: {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}): WordTiming[] {
  const words: WordTiming[] = []
  let cur = '',
    start = 0,
    end = 0,
    open = false
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i]!
    if (/\s/.test(ch)) {
      if (open) {
        words.push({ word: cur, start, end })
        cur = ''
        open = false
      }
    } else {
      if (!open) {
        start = a.character_start_times_seconds[i]!
        open = true
      }
      cur += ch
      end = a.character_end_times_seconds[i]!
    }
  }
  if (open && cur) words.push({ word: cur, start, end })
  return words
}

export const elevenlabsAdapter: ProviderAdapter<TtsPort> = {
  key: 'elevenlabs',
  requiredEnv: REQUIRED,
  create(): TtsPort {
    const env = requireEnv('tts', 'elevenlabs', REQUIRED)
    const apiKey = env.ELEVENLABS_API_KEY
    const defaultVoice = readEnv('ELEVENLABS_VOICE_ID')
    const defaultModel = readEnv('ELEVENLABS_MODEL_ID') ?? 'eleven_v3'

    return {
      async synthesize(input: SynthesizeInput): Promise<SynthesizeResult> {
        const voice = input.voice ?? defaultVoice
        if (!voice) {
          throw new ProviderError('tts', 'elevenlabs', 'no voice (set ELEVENLABS_VOICE_ID or pass `voice`)')
        }
        const outputFormat = OUTPUT_FORMAT[input.format ?? 'mp3'] ?? 'mp3_44100_128'
        // `/with-timestamps` returns the audio (base64) PLUS character-level
        // alignment, so we can hand back per-word timings for speech↔visual sync.
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=${outputFormat}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({ text: input.text, model_id: input.model ?? defaultModel }),
            ...(input.signal ? { signal: input.signal } : {}),
          },
        )
        if (!res.ok) {
          throw new ProviderError('tts', 'elevenlabs', `${res.status} ${await res.text()}`)
        }
        const data = (await res.json()) as {
          audio_base64: string
          alignment?: {
            characters: string[]
            character_start_times_seconds: number[]
            character_end_times_seconds: number[]
          }
        }
        const audio = new Uint8Array(Buffer.from(data.audio_base64, 'base64'))
        const wav = input.format === 'wav' || input.format === 'pcm'
        const timings = data.alignment ? charsToTimings(data.alignment) : undefined
        return {
          audio,
          contentType: wav ? 'audio/wav' : 'audio/mpeg',
          ...(timings ? { timings } : {}),
        }
      },
    }
  },
}
