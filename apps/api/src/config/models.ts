// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { readEnv } from '../providers/core/config'
import { providerFor } from '../providers/core/profile'

/**
 * Which model to use for which job.
 *
 * Services used to answer this themselves:
 *
 *     const AUTHORING_MODEL = readEnv('AUTHORING_MODEL') ?? 'claude-haiku-4-5-20251001'
 *
 * The intent was right — extraction runs about fourteen times per document and does not need
 * the expensive model — but the fallback names a Claude model whatever the configured provider
 * is. Setting `AI_PROVIDER=openai` therefore sent `claude-sonnet-5` to OpenAI. Typecheck stayed
 * green; it failed at runtime, against a provider the operator had chosen deliberately.
 *
 * ## Tiers, not model names
 *
 * A service asks for the *job*, not the model:
 *
 *     modelFor('extraction')   // structured extraction, many calls, cheap is enough
 *     modelFor('content')      // learning material a child reads — quality matters
 *
 * Keeping the sharp end of the decision — which model is worth its cost for which job — in one
 * reviewable table is the point. It also lets an operator remap a tier without touching a
 * service, which is what self-hosting against a local model requires.
 *
 * ## Why `undefined` is a real answer
 *
 * An unrecognised provider gets `undefined`, and the adapter falls back to its own configured
 * default. That is deliberate: someone running Ollama behind `OPENAI_BASE_URL` has set
 * `OPENAI_MODEL` to whatever they pulled, and a guess from this table would override a choice
 * they made on purpose. Silence is the correct answer when we do not know the vendor.
 */

export const MODEL_TIERS = ['extraction', 'content'] as const
export type ModelTier = (typeof MODEL_TIERS)[number]

/** Per-tier override, so an operator can remap one job without touching the others. */
const TIER_ENV: Record<ModelTier, string> = {
  extraction: 'AUTHORING_MODEL',
  content: 'CONTENT_MODEL',
}

/**
 * Only providers whose model names we actually know appear here. Adding a vendor means adding
 * a row, which is a smaller and more obvious change than hunting literals through services.
 */
const ROUTING: Record<string, Record<ModelTier, string>> = {
  claude: {
    extraction: 'claude-haiku-4-5-20251001',
    content: 'claude-sonnet-5',
  },
  openai: {
    extraction: 'gpt-4o-mini',
    content: 'gpt-4o',
  },
}

/**
 * The model for a job, or `undefined` to let the adapter use its own default.
 *
 * Resolution: the tier's environment variable, then the table for the active AI provider, then
 * nothing.
 */
export function modelFor(tier: ModelTier): string | undefined {
  const override = readEnv(TIER_ENV[tier])
  if (override !== undefined) return override
  return ROUTING[providerFor('ai')]?.[tier]
}

/** Providers this table knows how to route. Powers diagnostics rather than logic. */
export function routableProviders(): string[] {
  return Object.keys(ROUTING)
}
