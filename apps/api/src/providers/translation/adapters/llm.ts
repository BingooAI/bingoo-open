// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { localeMeta } from '@bingoo.ai/i18n'
import { readEnv } from '../../core/config'
import type { ProviderAdapter } from '../../core/registry'
import { ProviderError } from '../../core/errors'
import { aiRegistry } from '../../ai'
import type { TranslateInput, TranslationPort } from '../port'

/**
 * LLM-backed translation: delegates to an `ai` provider — the active one by
 * default, so it needs no env of its own (readiness is reported by the `ai`
 * capability). Because translation is a light, well-scoped task, `TRANSLATION_AI_PROVIDER`
 * + `TRANSLATION_MODEL` let it run on a cheaper engine/model (e.g. OpenAI
 * gpt-4o-mini or Claude Haiku 4.5) while the main `ai` capability stays on a
 * stronger model — a config change, not code (R6). Prompt integrity is defended
 * two ways: the model is told to keep placeholders verbatim, and any translation
 * that drops/duplicates a placeholder falls back to the source.
 */

/** Placeholder-ish tokens that must survive translation untouched. */
const PLACEHOLDER_RE = /\{\{[^}]+\}\}|\{[^}]+\}|%[sd]|https?:\/\/\S+/g

function placeholders(text: string): string[] {
  return (text.match(PLACEHOLDER_RE) ?? []).sort()
}

/** True when source and candidate carry the exact same multiset of placeholders. */
function placeholdersPreserved(source: string, candidate: string): boolean {
  const a = placeholders(source)
  const b = placeholders(candidate)
  return a.length === b.length && a.every((token, i) => token === b[i])
}

function buildSystem(input: TranslateInput): string {
  const target = localeMeta[input.to]
  const source = input.from ? localeMeta[input.from] : undefined
  const lines = [
    `You translate short UI/content strings for Bingoo, a learning app for children aged 6–15.`,
    source
      ? `Translate from ${source.native} (${input.from}) to ${target.native} (${input.to}).`
      : `Detect the source language and translate to ${target.native} (${input.to}).`,
    `Keep the tone warm, simple and friendly for children. Do not add explanations or notes.`,
    `Preserve every placeholder EXACTLY as written: {name}, {{count}}, %s, %d, URLs, emoji.`,
    // Language lessons TEACH a foreign word — translating it away destroys the
    // lesson (a "Chinese greetings" card must keep 你好, not turn it into "Hello").
    `Keep verbatim any text that is ALREADY in a different language or script from the source — e.g. Chinese/Japanese/Korean characters (你好, 谢谢), or a foreign example word being taught. Do NOT translate those; copy them exactly. Only translate the ${source ? source.native : 'source-language'} text around them.`,
    input.context ? `Domain context: ${input.context}.` : null,
    input.glossary && Object.keys(input.glossary).length > 0
      ? `Apply these term translations verbatim: ${JSON.stringify(input.glossary)}.`
      : null,
    `Input is a JSON object {"texts": string[]}. Reply with ONLY a JSON object`,
    `{"translations": string[]} of the same length and order. No prose, no code fences.`,
  ]
  return lines.filter(Boolean).join('\n')
}

/** Extract the translations array from the model reply, tolerating code fences. */
function parseTranslations(raw: string, expected: number): string[] {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new ProviderError('translation', 'llm', 'model returned non-JSON output')
  }
  const arr =
    parsed && typeof parsed === 'object' && 'translations' in parsed
      ? (parsed as { translations: unknown }).translations
      : parsed
  if (!Array.isArray(arr) || arr.length !== expected || !arr.every((t) => typeof t === 'string')) {
    throw new ProviderError('translation', 'llm', 'model output shape mismatch')
  }
  return arr as string[]
}

export const llmTranslationAdapter: ProviderAdapter<TranslationPort> = {
  key: 'llm',
  // Delegates to an `ai` provider (active, or TRANSLATION_AI_PROVIDER); its env
  // is reported under `ai`.
  requiredEnv: [],
  create(): TranslationPort {
    // Optional overrides so translation can run on a cheaper engine/model than
    // the active `ai` provider. Undefined → active provider / adapter default.
    const providerKey = readEnv('TRANSLATION_AI_PROVIDER')
    const model = readEnv('TRANSLATION_MODEL')
    return {
      async translate(input) {
        if (input.texts.length === 0) {
          return { translations: [], detectedFrom: input.from, provider: 'llm' }
        }
        const ai = aiRegistry.get(providerKey)
        // A whole-lesson translation can produce more output than the provider's
        // default max_tokens (e.g. OPENAI_MAX_TOKENS=4096) — the reply then gets
        // truncated mid-JSON and parsing fails. Ask for enough headroom: the
        // output is ~the size of the input, so scale by input length (+ JSON
        // overhead) and cap at a sane ceiling.
        const inChars = input.texts.reduce((n, t) => n + t.length, 0)
        const maxTokens = Math.min(16000, Math.max(4096, Math.ceil(inChars / 2) + 800))
        const res = await ai.generateText({
          system: buildSystem(input),
          model,
          maxTokens,
          messages: [{ role: 'user', content: JSON.stringify({ texts: input.texts }) }],
        })
        const candidates = parseTranslations(res.text, input.texts.length)
        const translations = input.texts.map((src, i) => {
          const candidate = candidates[i] ?? src
          return placeholdersPreserved(src, candidate) ? candidate : src
        })
        return { translations, detectedFrom: input.from, provider: 'llm' }
      },
    }
  },
}
