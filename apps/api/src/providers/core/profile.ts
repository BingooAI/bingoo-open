// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { readEnv } from './config'

/**
 * Deployment profile — one switch that picks a sensible provider for every capability,
 * instead of fifteen environment variables.
 *
 * ## Why this exists
 *
 * Each capability used to carry its own default, spelled out in its own `index.ts`. That
 * worked, but it meant nobody could see the whole picture: answering "what does it take to
 * run this without a cloud account?" required opening fifteen files, and actually doing it
 * required setting fifteen variables by hand.
 *
 * Gathering the defaults here makes the answer readable, and — more usefully — makes the
 * *gaps* impossible to forget. A capability with no local adapter is `local: null` right
 * here, next to the one that has one, rather than being knowledge that lives in an issue
 * and slowly goes stale.
 *
 * ## Resolution order
 *
 * ```
 *   X_PROVIDER            explicit, per capability — always wins
 *        ↓ absent
 *   DEPLOYMENT_PROFILE    cloud (default) | local
 *        ↓ profile has no adapter for this capability
 *   throw, naming the capability and where the work is tracked
 * ```
 *
 * The first rule is what makes a mixed deployment ordinary rather than special: running
 * Postgres and Redis on your own machine while calling a hosted model is a normal setup,
 * expressed as `DEPLOYMENT_PROFILE=local` plus `AI_PROVIDER=claude`.
 *
 * ## What this file may and may not hold
 *
 * It chooses *which adapter*, never *how to configure it*. No endpoints, no keys, no
 * tuning. Each adapter's `requiredEnv` stays the single source of truth for what it needs,
 * so a missing key is still reported by the adapter that missed it.
 */

export const DEPLOYMENT_PROFILES = ['cloud', 'local'] as const
export type DeploymentProfile = (typeof DEPLOYMENT_PROFILES)[number]

export interface CapabilitySpec {
  /** Per-capability override. Set this and the profile is ignored for this capability. */
  readonly env: string
  /** Adapter used under the `cloud` profile. */
  readonly cloud: string
  /** Adapter under `local`, or `null` when nothing can run off a laptop yet. */
  readonly local: string | null
  /** Where the missing local adapter is being tracked, for the error message. */
  readonly localTracking?: string
  /**
   * The system works without it — a missing configuration is a smaller installation, not a
   * broken one, and must not be reported as degraded. Only for capabilities whose every call
   * site already degrades on its own.
   */
  readonly optional?: boolean
}

/**
 * The table.
 *
 * `local` is deliberately conservative: it names an adapter only where the whole capability
 * genuinely works with no third-party account. "Partly works" is recorded as `null`, because a
 * profile that half-works is worse than one that says it does not — the first fails in front of
 * a learner, the second fails at startup in front of an operator, who can act.
 *
 * Nine capabilities, down from fifteen. Notification, payment, video, workflow, realtime and
 * email were removed rather than given local adapters: they belonged to a paid tier that is not
 * part of this project, and three of them had no caller at all.
 *
 * `image` is the last gap. Everything else runs with no third-party account.
 */
export const CAPABILITY_SPECS = {
  ai: { env: 'AI_PROVIDER', cloud: 'claude', local: 'openai' },
  cache: { env: 'CACHE_PROVIDER', cloud: 'redis', local: 'redis', optional: true },
  embedding: { env: 'EMBEDDING_PROVIDER', cloud: 'openai', local: 'openai' },
  image: { env: 'IMAGE_PROVIDER', cloud: 'openai', local: null, localTracking: 'issue #14' },
  search: { env: 'SEARCH_PROVIDER', cloud: 'postgres', local: 'postgres' },
  storage: { env: 'STORAGE_PROVIDER', cloud: 'r2', local: 's3' },
  translation: { env: 'TRANSLATION_PROVIDER', cloud: 'llm', local: 'llm' },
  tts: { env: 'TTS_PROVIDER', cloud: 'elevenlabs', local: 'openai' },
  vision: { env: 'VISION_PROVIDER', cloud: 'claude', local: 'claude' },
} as const satisfies Record<string, CapabilitySpec>

export type Capability = keyof typeof CAPABILITY_SPECS

/**
 * The profile in force.
 *
 * An unrecognised value throws rather than falling back to `cloud`. `DEPLOYMENT_PROFILE=locl`
 * silently running against paid vendors is exactly the failure this switch exists to prevent.
 */
export function activeProfile(): DeploymentProfile {
  const raw = readEnv('DEPLOYMENT_PROFILE')
  if (raw === undefined) return 'cloud'
  const value = raw.trim().toLowerCase()
  if ((DEPLOYMENT_PROFILES as readonly string[]).includes(value)) return value as DeploymentProfile
  throw new Error(
    `[providers] DEPLOYMENT_PROFILE="${raw}" is not a profile. Use one of: ${DEPLOYMENT_PROFILES.join(', ')}.`,
  )
}

/** Which adapter this capability should use, given the environment. */
export function providerFor(capability: Capability): string {
  const spec = CAPABILITY_SPECS[capability]

  const explicit = readEnv(spec.env)
  if (explicit !== undefined) return explicit

  const profile = activeProfile()
  if (profile === 'cloud') return spec.cloud

  if (spec.local === null) {
    const tracking = spec.localTracking ? ` (${spec.localTracking})` : ''
    throw new Error(
      `[providers] ${capability}: the "local" profile has no adapter yet${tracking}. ` +
        `Either set ${spec.env} to one of the available providers, or switch DEPLOYMENT_PROFILE=cloud. ` +
        `Contributions welcome — the port is defined, only an implementation is missing.`,
    )
  }
  return spec.local
}

/** Capabilities with no local adapter — what a self-hosted deployment still needs an account for. */
export function capabilitiesWithoutLocalAdapter(): Capability[] {
  return (Object.keys(CAPABILITY_SPECS) as Capability[]).filter((c) => CAPABILITY_SPECS[c].local === null)
}

/** True when the installation works without this capability configured. */
export function isOptional(capability: string): boolean {
  const spec = (CAPABILITY_SPECS as Record<string, CapabilitySpec>)[capability]
  return spec?.optional === true
}
