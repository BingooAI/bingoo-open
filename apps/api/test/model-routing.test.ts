// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest'
import { MODEL_TIERS, modelFor, routableProviders } from '../src/config/models'

/**
 * The bug this replaced was invisible to every gate: `AI_PROVIDER=openai` sent
 * `claude-sonnet-5` to OpenAI. Types were fine, lint was fine, the build was fine, and it
 * failed at the first request against a provider the operator had configured on purpose.
 *
 * These tests are the gate that would have caught it.
 */

const KEYS = ['AI_PROVIDER', 'AUTHORING_MODEL', 'CONTENT_MODEL', 'DEPLOYMENT_PROFILE']
afterEach(() => {
  for (const k of KEYS) delete process.env[k]
})

describe('a model name never crosses vendors', () => {
  it('routes Claude names only when Claude is the provider', () => {
    process.env.AI_PROVIDER = 'claude'
    expect(modelFor('extraction')).toMatch(/^claude-/)
    expect(modelFor('content')).toMatch(/^claude-/)
  })

  it('routes OpenAI names when OpenAI is the provider — the actual bug', () => {
    process.env.AI_PROVIDER = 'openai'
    expect(modelFor('extraction')).not.toMatch(/^claude-/)
    expect(modelFor('content')).not.toMatch(/^claude-/)
    expect(modelFor('content')).toMatch(/^gpt-/)
  })

  it('follows the deployment profile when no provider is named', () => {
    process.env.DEPLOYMENT_PROFILE = 'local'
    expect(modelFor('content')).toMatch(/^gpt-/)
  })
})

describe('an unknown provider gets silence, not a guess', () => {
  /**
   * Someone running Ollama behind `OPENAI_BASE_URL` has set `OPENAI_MODEL` to whatever they
   * pulled. Returning a name from this table would override a choice they made deliberately.
   */
  it('returns undefined so the adapter uses its own configured default', () => {
    process.env.AI_PROVIDER = 'some-local-runtime'
    for (const tier of MODEL_TIERS) expect(modelFor(tier)).toBeUndefined()
  })
})

describe('the operator can always overrule', () => {
  it('honours a per-tier override regardless of provider', () => {
    process.env.AI_PROVIDER = 'claude'
    process.env.CONTENT_MODEL = 'llama3.1:70b'
    expect(modelFor('content')).toBe('llama3.1:70b')
    // and only that tier
    expect(modelFor('extraction')).toMatch(/^claude-/)
  })

  it('overrides an unknown provider too, which is how a local model gets named', () => {
    process.env.AI_PROVIDER = 'ollama'
    process.env.AUTHORING_MODEL = 'qwen2.5:7b'
    expect(modelFor('extraction')).toBe('qwen2.5:7b')
  })
})

describe('the table stays honest', () => {
  it('covers every tier for every provider it claims to route', () => {
    for (const provider of routableProviders()) {
      process.env.AI_PROVIDER = provider
      for (const tier of MODEL_TIERS) {
        expect(modelFor(tier), `${provider}/${tier}`).toBeTypeOf('string')
      }
    }
  })

  it('routes exactly the providers that have an adapter', () => {
    expect(routableProviders().sort()).toEqual(['claude', 'openai'])
  })
})
