import { afterEach, describe, expect, it } from 'vitest'
import {
  CAPABILITY_SPECS,
  type Capability,
  type CapabilitySpec,
  activeProfile,
  capabilitiesWithoutLocalAdapter,
  providerFor,
} from '../src/providers/core/profile'

/**
 * `CAPABILITY_SPECS` is declared `as const satisfies …`, which is what gives production code
 * literal types. Tests want the widened shape instead — they iterate the table generically,
 * and every branch having a different literal type is noise here rather than safety.
 */
const SPECS: Record<Capability, CapabilitySpec> = CAPABILITY_SPECS

/**
 * The profile table replaced fifteen defaults that used to live in fifteen files. These tests
 * exist so that replacement stays a refactor.
 *
 * The first block is the important one: it repeats the historical defaults as literals rather
 * than reading them from the table. A test that asks the table what the table says would pass
 * no matter what the table said.
 */

const ENV_KEYS = ['DEPLOYMENT_PROFILE', ...Object.values(SPECS).map((s) => s.env)]

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key]
}

afterEach(clearEnv)

/** What every capability resolved to before the profile table existed. Do not "fix" to match. */
const DEFAULTS_BEFORE_THE_REFACTOR: Record<Capability, string> = {
  ai: 'claude',
  cache: 'redis',
  email: 'resend',
  embedding: 'openai',
  image: 'openai',
  notification: 'fcm',
  payment: 'vietqr',
  realtime: 'livekit',
  search: 'postgres',
  storage: 'r2',
  translation: 'llm',
  tts: 'elevenlabs',
  video: 'bunny',
  vision: 'claude',
  workflow: 'upstash',
}

describe('cloud is exactly what shipped before', () => {
  it.each(Object.entries(DEFAULTS_BEFORE_THE_REFACTOR))(
    '%s resolves to %s with no environment set',
    (capability, expected) => {
      clearEnv()
      expect(providerFor(capability as Capability)).toBe(expected)
    },
  )

  it('defaults to the cloud profile when DEPLOYMENT_PROFILE is unset', () => {
    clearEnv()
    expect(activeProfile()).toBe('cloud')
  })

  it('covers every capability — a new one cannot be added without a decision here', () => {
    expect(Object.keys(SPECS).sort()).toEqual(Object.keys(DEFAULTS_BEFORE_THE_REFACTOR).sort())
  })
})

describe('an explicit provider always wins', () => {
  it('overrides the cloud default', () => {
    process.env.STORAGE_PROVIDER = 'some-other-store'
    expect(providerFor('storage')).toBe('some-other-store')
  })

  it('overrides the local profile, which is what makes a mixed deployment ordinary', () => {
    process.env.DEPLOYMENT_PROFILE = 'local'
    process.env.AI_PROVIDER = 'claude'
    expect(providerFor('ai')).toBe('claude')
    expect(providerFor('search')).toBe('postgres')
  })

  it('rescues a capability the local profile cannot serve', () => {
    process.env.DEPLOYMENT_PROFILE = 'local'
    expect(() => providerFor('storage')).toThrow()
    process.env.STORAGE_PROVIDER = 'r2'
    expect(providerFor('storage')).toBe('r2')
  })

  it('treats an empty value as absent rather than as a provider named ""', () => {
    process.env.STORAGE_PROVIDER = '   '
    expect(providerFor('storage')).toBe('r2')
  })
})

describe('a misconfiguration fails at startup, not in front of a learner', () => {
  it('refuses an unrecognised profile instead of falling back to cloud', () => {
    process.env.DEPLOYMENT_PROFILE = 'locl'
    expect(() => activeProfile()).toThrow(/not a profile/)
  })

  it('names the capability and where the work is tracked', () => {
    process.env.DEPLOYMENT_PROFILE = 'local'
    expect(() => providerFor('storage')).toThrow(/storage/)
    expect(() => providerFor('storage')).toThrow(/issue #11/)
    expect(() => providerFor('storage')).toThrow(/STORAGE_PROVIDER/)
  })

  it('accepts a profile regardless of case and surrounding space', () => {
    process.env.DEPLOYMENT_PROFILE = '  LOCAL '
    expect(activeProfile()).toBe('local')
  })
})

describe('the table describes the deployment honestly', () => {
  it('reports which capabilities still need an account', () => {
    expect(capabilitiesWithoutLocalAdapter().sort()).toEqual(
      ['email', 'image', 'notification', 'payment', 'storage', 'video', 'workflow'].sort(),
    )
  })

  it('points every gap at somewhere the reader can go', () => {
    for (const capability of capabilitiesWithoutLocalAdapter()) {
      expect(SPECS[capability].localTracking, capability).toBeTruthy()
    }
  })

  it('names environment variables consistently, so the convention is guessable', () => {
    for (const [capability, spec] of Object.entries(SPECS)) {
      expect(spec.env).toBe(`${capability.toUpperCase()}_PROVIDER`)
    }
  })

  it('carries no configuration — only the choice of adapter', () => {
    for (const spec of Object.values(SPECS)) {
      const values = [spec.cloud, spec.local].filter((v) => v !== null)
      for (const value of values) {
        expect(value).toMatch(/^[a-z0-9-]+$/)
        expect(value).not.toMatch(/https?:|@|\/|\./)
      }
    }
  })
})
