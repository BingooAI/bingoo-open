// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * explainer.service.ts — connect the explainer engine's provider ports to
 * bingoo's existing capability ports, IN-PROCESS (no HTTP). The explainer's
 * vendor-neutral logic lives in `@bingoo.ai/explainer/providers` (illustration-first
 * `resolveImage`, narration↔cue re-timing); here we supply the concrete
 * capabilities backed by bingoo's SearchPort / ImagePort / TtsPort / AiPort +
 * storage + media hydration. Child-facing search is APPROVED-only (R5).
 */
import { createHash } from 'node:crypto'
import { db } from '@bingoo.ai/db'
import { upsertTag, addAssetTags } from '../repos/media-tag.repo'
import type { LocalizedText, MediaSearchQuery } from '@bingoo.ai/core'
import {
  resolveImage,
  cueMarksFrom,
  cleanScript,
  evenWords,
  type MediaSearchProvider,
  type ImageProvider,
  type ImageRequest,
  type VoiceRequest,
  type VoiceResult,
  type Word,
  type LlmRequest,
  type MediaHit,
  type ResolvedImage,
} from '@bingoo.ai/explainer/providers'
import type { TtsPort } from '../providers/tts/port'
import type { SessionUser } from '../auth/auth'
import { getAi, getStorage, getTts } from '../providers'
import { ttsRegistry } from '../providers/tts'
import { getSearch } from '../providers'
import { serializeAsset } from '../lib/media-serialize'
import { buildMediaSubject, toSearchFilter } from '../repos/media-access.repo'
import { getAssetsByIds } from '../repos/media-asset.repo'
import { generateImageAssets } from './media-generate.service'

/* ---------------------------------------------------- library search (adapter) */
/**
 * illustration-first search over the APPROVED media library, hydrated to URLs.
 * Backs the explainer's `MediaSearchProvider` port; scores come straight from
 * SearchPort so `resolveImage`'s threshold logic is unchanged.
 */
function librarySearch(user: SessionUser | null): MediaSearchProvider {
  return {
    id: 'bingoo',
    available: () => true,
    async search(req) {
      const subject = await buildMediaSubject(user)
      const filter = toSearchFilter(subject)
      filter.moderation = ['APPROVED'] // child-safe (R5), regardless of role
      const query: MediaSearchQuery = {
        text: req.query,
        limit: req.limit ?? 8,
        moderation: ['APPROVED'],
        ...(req.tags?.length ? { anyTags: req.tags } : {}),
        ...(req.kind && req.kind !== 'any' ? { kind: ['IMAGE'] } : {}),
      }
      const result = await getSearch().query(query, filter)
      const scoreById = new Map(result.hits.map((h) => [h.assetId, h.score]))
      const assets = await getAssetsByIds(result.hits.map((h) => h.assetId))
      const byId = new Map(assets.map((a) => [a.id, a]))
      const items: MediaHit[] = []
      for (const h of result.hits) {
        const asset = byId.get(h.assetId)
        if (!asset) continue
        const s = await serializeAsset(asset, false)
        const url = s.renditions[0]?.url
        if (!url) continue
        const isSvg = /svg/i.test(s.mimeType ?? '') || /\.svg($|\?)/i.test(url)
        const title = (s.title ?? null) as LocalizedText | null
        items.push({
          url,
          label: title?.vi ?? title?.en,
          kind: isSvg ? 'svg' : 'image',
          tags: s.tags?.map((t) => t.slug),
          score: scoreById.get(h.assetId) ?? 0.5,
        })
      }
      return { items, provider: 'bingoo' }
    },
  }
}

/* -------------------------------------------------- image generation (adapter) */
/**
 * Generation fallback (authoring-time). Produces an asset via the shared
 * media-generate service — moderated before it can reach children (R5), and born
 * PENDING unless the author may already approve — and returns its rendition URL
 * for author preview.
 */
/** The same prompt must not be paid for twice. Keyed by the INPUT (prompt+size),
 *  because the OUTPUT of an image model differs every run — hashing the bytes
 *  deduplicates storage and never deduplicates COST. */
function imagePromptKey(prompt: string, size?: string): string {
  return `img:${createHash('sha256')
    .update(`${prompt.trim()}|${size ?? ''}`)
    .digest('hex')}`
}

/** Content words of an English prompt, as tag slugs. A fallback, not a substitute
 *  for tags the author actually chose. */
const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'for',
  'with',
  'and',
  'or',
  'on',
  'in',
  'at',
  'to',
  'by',
  'flat',
  'vector',
  'illustration',
  'style',
  'background',
  'white',
  'simple',
  'image',
  'picture',
])
function keywordsFrom(prompt: string): string[] {
  return [
    ...new Set(
      prompt
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  ].slice(0, 6)
}

function imageGenerator(user: SessionUser | null): ImageProvider {
  return {
    id: 'bingoo-gen',
    available: () => true,
    async generate(req) {
      // already generated for this exact prompt? then it is already in the
      // library — hand it back instead of paying the model again.
      const key = imagePromptKey(req.prompt, req.size)
      // "Sinh cái khác" must actually draw again — returning the cached picture
      // would make the button do nothing at all.
      const hit = req.variant
        ? null
        : await db.mediaAsset.findFirst({
            where: { kind: 'IMAGE', metadata: { path: ['promptKey'], equals: key } },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          })
      if (hit) {
        const [cached] = await getAssetsByIds([hit.id])
        const cachedUrl = cached ? (await serializeAsset(cached, false)).renditions[0]?.url : undefined
        if (cachedUrl)
          return {
            url: cachedUrl,
            provider: 'bingoo-gen',
            meta: { assetId: hit.id, cached: true },
          }
      }

      // Give the asset everything we know.
      //
      // It used to be created with ONLY a title, and no description, no alt text
      // and no tags — so a reviewer had nothing to judge, a screen reader had
      // nothing to read, and the library had nothing to filter on. That is why a
      // library steadily filling with generated pictures still returned nothing:
      // the only thing to match against was a title.
      //
      // The metadata is ENGLISH. The library is ONE shared vocabulary across the
      // whole product; a Vietnamese title next to an English one forks the
      // namespace and the same picture ends up stored twice under two names.
      // (The Vietnamese the learner sees lives in the lesson's own `alt`, not on
      // the asset.)
      const en = req.prompt.trim()
      const [asset] = await generateImageAssets({
        prompt: req.prompt,
        size: req.size,
        createdById: user?.id ?? null,
        createdByRole: user?.role ?? null,
        title: { en: en.slice(0, 120), vi: en.slice(0, 120) },
        description: { en, vi: en },
        altText: { en, vi: en },
      })
      if (!asset) throw new Error('image generation produced no asset')

      // stamp the prompt key so the next identical request is free
      await db.mediaAsset.update({
        where: { id: asset.id },
        data: {
          metadata: { ...((asset.metadata as object) ?? {}), aiGenerated: true, promptKey: key },
        },
      })

      // TAGS. Without them the asset is unfilterable — it can only ever be found
      // by a free-text match on its title, which is why a library steadily filling
      // with generated pictures still returned nothing. Tag slugs are ENGLISH and
      // canonical (the vocabulary is one shared namespace across the whole library;
      // a Vietnamese slug would fork it).
      //
      // If the lesson didn't supply any — an older doc, written before the contract
      // required them — derive them from the English prompt rather than storing yet
      // another untagged asset. A weak tag is worth more than none.
      const slugs = (req.tags?.length ? req.tags : keywordsFrom(en))
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      if (slugs.length) {
        const tags = await Promise.all(
          slugs.map((slug) => upsertTag({ slug, kind: 'KEYWORD', label: { en: slug, vi: slug } })),
        )
        await addAssetTags({
          assetId: asset.id,
          tagIds: tags.map((t) => t.id),
          source: 'AI',
          addedById: user?.id ?? null,
        })
      }
      const [full] = await getAssetsByIds([asset.id])
      const url = full ? (await serializeAsset(full, false)).renditions[0]?.url : undefined
      if (!url) throw new Error('generated asset has no rendition url')
      return { url, provider: 'bingoo-gen', meta: { assetId: asset.id, moderation: 'PENDING' } }
    },
  }
}

/** Illustration-first image resolution (library APPROVED → generate fallback). */
export function explainerResolveImage(
  user: SessionUser | null,
  req: ImageRequest,
  opts: { allowGenerate?: boolean } = {},
): Promise<ResolvedImage> {
  return resolveImage(req, {
    search: librarySearch(user),
    ...(opts.allowGenerate ? { image: imageGenerator(user) } : {}),
  })
}

/**
 * SEARCH ONLY — never generates, so it costs nothing and returns in milliseconds.
 *
 * The import page used to call `resolve` per picture, which searches and then
 * GENERATES on a miss: six images meant six generations, 40–50 seconds and real
 * money each, before anyone had even agreed the lesson was worth illustrating.
 * Now the page searches first (this), shows what the library already has, and
 * generates only what a human explicitly asks for.
 *
 * Identical queries are collapsed — a lesson that asks for "ngôi sao vàng" four
 * times must not search four times.
 */
/**
 * Flat image search / browse for the editor's media picker. `q` empty → browse
 * (recent approved images); `q` set → search. Returns a flat MediaHit list.
 */
export async function explainerFindImages(
  user: SessionUser | null,
  q: string,
  limit = 24,
): Promise<MediaHit[]> {
  const lib = librarySearch(user)
  try {
    const { items } = await lib.search({ query: q.trim(), kind: 'image', limit })
    return items
  } catch {
    return []
  }
}

/**
 * The narration audio already BAKED into the library (kind AUDIO, produced by
 * explainerVoice). Each carries its word timings + cue marks in metadata, so
 * picking one restores full audio↔visual sync — no regeneration, no new cost.
 * `q` empty → recent; `q` set → title contains.
 */
export async function explainerFindAudio(
  user: SessionUser | null,
  q: string,
  limit = 30,
): Promise<
  {
    id: string
    url: string
    label?: string
    durationMs?: number
    words?: unknown
    cueMarks?: unknown
  }[]
> {
  const rows = await db.mediaAsset.findMany({
    where: {
      kind: 'AUDIO',
      metadata: { path: ['kind'], equals: 'explainer-narration' },
      ...(q.trim() ? { title: { path: ['vi'], string_contains: q.trim() } } : {}),
      ...(user?.id ? { createdById: user.id } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, title: true, durationMs: true, metadata: true },
  })
  const out: {
    id: string
    url: string
    label?: string
    durationMs?: number
    words?: unknown
    cueMarks?: unknown
  }[] = []
  for (const r of rows) {
    const [full] = await getAssetsByIds([r.id])
    const url = full ? (await serializeAsset(full, false)).renditions[0]?.url : undefined
    if (!url) continue
    const t = (r.title ?? {}) as { vi?: string; en?: string }
    const m = (r.metadata ?? {}) as { words?: unknown; cueMarks?: unknown }
    out.push({
      id: r.id,
      url,
      label: t.vi ?? t.en,
      durationMs: r.durationMs ?? undefined,
      words: m.words,
      cueMarks: m.cueMarks,
    })
  }
  return out
}

export async function explainerSearchImages(
  user: SessionUser | null,
  queries: string[],
): Promise<Record<string, MediaHit[]>> {
  const lib = librarySearch(user)
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))]
  const out: Record<string, MediaHit[]> = {}
  await Promise.all(
    unique.map(async (query) => {
      try {
        const { items } = await lib.search({ query, kind: 'any', limit: 6 })
        out[query] = items
      } catch {
        out[query] = [] // a failed search is "nothing found", not a broken import
      }
    }),
  )
  return out
}

/* ----------------------------------------------------------- narration voice */
/**
 * Speak a narration line and re-time its `[[cue:cN]]` markers onto the audio.
 * Uses the TTS port's per-word timings when present (ElevenLabs with-timestamps),
 * else falls back to even word-spacing — the cue-mapping logic is identical.
 */
export async function explainerSpeak(req: VoiceRequest): Promise<VoiceResult> {
  const clean = cleanScript(req.text)
  if (!clean) {
    return {
      audioUrl: null,
      words: [],
      duration: 0,
      cueMarks: [],
      provider: 'bingoo-tts',
      mock: true,
    }
  }
  // Synthesize with the active TTS provider; if it fails (e.g. ElevenLabs returns
  // 401 payment_issue), fall back to any OTHER configured provider (OpenAI TTS)
  // rather than failing the whole lesson. A broken vendor subscription should
  // degrade to a working one, not to "no audio at all".
  const input = {
    text: clean,
    ...(req.voiceId ? { voice: req.voiceId } : {}),
    ...(req.modelId ? { model: req.modelId } : {}),
    ...(req.locale ? { languageCode: req.locale } : {}),
  }
  const order = [
    ttsRegistry.activeKey,
    ...ttsRegistry
      .health()
      .filter((h) => h.configured && h.provider !== ttsRegistry.activeKey)
      .map((h) => h.provider),
  ]
  let r: Awaited<ReturnType<TtsPort['synthesize']>> | null = null
  let lastErr: unknown
  for (const key of order) {
    try {
      // OpenAI ignores an ElevenLabs voice id — only pass a voice the provider owns
      const scoped = key === ttsRegistry.activeKey ? input : { ...input, voice: undefined, model: undefined }
      r = await getTts(key).synthesize(scoped)
      break
    } catch (e) {
      lastErr = e
    }
  }
  if (!r) throw lastErr ?? new Error('no TTS provider available')
  const words: Word[] = r.timings?.length ? r.timings : evenWords(clean)
  const duration = words.length ? words[words.length - 1]!.end : 0

  // Persist the audio bytes and reference by URL (never inline for children).
  const ext = r.contentType.includes('wav') ? 'wav' : 'mp3'
  const checksum = createHash('sha256').update(r.audio).digest('hex').slice(0, 32)
  const key = `explainer/tts/${checksum}.${ext}`
  await getStorage().putObject({ key, body: r.audio, contentType: r.contentType })
  const url =
    getStorage().getPublicUrl(key) ??
    (await getStorage().createSignedDownloadUrl({ key, expiresInSeconds: 60 * 60 * 24 })).url

  return {
    audioUrl: url,
    words,
    duration,
    cueMarks: cueMarksFrom(req.text, words),
    provider: 'bingoo-tts',
    mock: false,
  }
}

/* ------------------------------------------------------------------ llm text */
/** Thin bridge to the AiPort for the explainer's generation pipeline. */
export async function explainerComplete(req: LlmRequest): Promise<string> {
  const r = await getAi().generateText({
    messages: req.messages,
    ...(req.system ? { system: req.system } : {}),
    ...(req.model ? { model: req.model } : {}),
    ...(req.maxTokens ? { maxTokens: req.maxTokens } : {}),
  })
  return r.text
}

const LANG_NAME: Record<string, string> = { vi: 'Vietnamese', en: 'English', zh: 'Chinese' }
const cueSet = (s: string) =>
  [...s.matchAll(/\[\[cue:([^\]]+)\]\]/g)]
    .map((m) => m[1])
    .sort()
    .join(',')

/**
 * NATIVE LOCALIZATION — not machine translation. A word-for-word translate reads
 * the strings blind and produces stilted lines that miss the lesson's intent. Here
 * the model gets the WHOLE lesson's text at once and re-AUTHORS it as a native
 * teacher of the target language, keeping the shared doc's cue rhythm and the
 * actual content being TAUGHT (foreign words, numbers) unchanged. Output is keyed
 * exactly like the input, so the studio writes it straight back into the bundle.
 */
export async function localizeLesson(input: {
  strings: Record<string, string>
  scripts: Record<string, string>
  from: string
  to: string
  title?: string
}): Promise<{ strings: Record<string, string>; scripts: Record<string, string> }> {
  const from = LANG_NAME[input.from] ?? input.from
  const to = LANG_NAME[input.to] ?? input.to
  const nStr = Object.keys(input.strings).length
  const nScr = Object.keys(input.scripts).length
  if (nStr + nScr === 0) return { strings: {}, scripts: {} }
  const system = [
    `You are a NATIVE ${to} teacher writing an interactive lesson for young children (ages 6–11).`,
    `You are given the ENTIRE text of ONE lesson${input.title ? ` ("${input.title}")` : ''}, currently in ${from}, as JSON {"strings":{key:text}, "scripts":{ref:script}}. The \`strings\` are on-screen labels/titles/list-items/etc.; the \`scripts\` are the teacher's spoken narration.`,
    `RE-AUTHOR every value in natural, native ${to} — the way a ${to} teacher would actually say it to a child. This is NOT a word-for-word translation: keep each item's MEANING and teaching purpose, but write it fresh, warm and simple in ${to}. Word-for-word translation reads stilted and loses the lesson — do not do that.`,
    `HARD RULES:`,
    `1. Output ONLY a JSON object {"strings":{…}, "scripts":{…}} with the EXACT SAME keys/refs as the input. No prose, no code fences.`,
    `2. Every script MUST keep its \`[[cue:cN]]\` markers — the SAME set, SAME order — because the animation is timed to them. Re-author the words around each cue; never add, drop, or reorder cues.`,
    `3. Keep the content being TAUGHT identical: foreign example words (你好, 谢谢, 再见), pinyin (nǐ hǎo), numbers, and math — copy them verbatim; only re-author the ${to} instruction around them.`,
    `4. Preserve placeholders exactly: {n}, {name}, {{count}}, %s, %d, URLs, emoji.`,
  ].join('\n')
  const user = JSON.stringify({ strings: input.strings, scripts: input.scripts })
  // output ≈ input size; give generous headroom so a big lesson isn't truncated.
  const maxTokens = Math.min(16000, Math.max(2048, Math.ceil(user.length / 2) + 1000))
  const raw = await explainerComplete({
    system,
    messages: [{ role: 'user', content: user }],
    maxTokens,
  })
  const jsonText = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  let parsed: { strings?: Record<string, string>; scripts?: Record<string, string> }
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('máy sinh bản ngữ trả về không phải JSON')
  }
  // Per-item safety: keep the source when a value is missing, or (for scripts)
  // when the re-authored line lost/changed its cue markers.
  const strings: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.strings))
    strings[k] = typeof parsed.strings?.[k] === 'string' ? parsed.strings[k]! : v
  const scripts: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.scripts)) {
    const cand = parsed.scripts?.[k]
    scripts[k] = typeof cand === 'string' && cueSet(cand) === cueSet(v) ? cand : v
  }
  return { strings, scripts }
}
