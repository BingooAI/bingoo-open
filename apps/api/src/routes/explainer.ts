// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * routes/explainer.ts — same-origin endpoints the explainer surfaces (player in
 * apps/web, studio in apps/admin) call to reach bingoo's capabilities through
 * the explainer's provider logic. All authed; child-facing search is
 * APPROVED-only, image generation is an author affordance (PENDING → moderated).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { parseBrief } from '@bingoo.ai/explainer'
import { requireAuth } from '../auth'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { explainerComplete, explainerResolveImage, localizeLesson } from '../services/explainer.service'
import { parseDoc } from '@bingoo.ai/explainer'
import { translateContent } from '../lib/translation'
import { runGenerate } from '../services/explainer-gen'
import { explainerSearchImages, explainerFindImages, explainerFindAudio } from '../services/explainer.service'
import { explainerVoice } from '../services/explainer-voice.service'
import { listLessons, getLesson, upsertLesson, deleteLesson } from '../repos/explainer-lesson.repo'

const ttsSchema = z.object({
  text: z.string().min(1),
  locale: z.string().optional(),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
})

const translateSchema = z.object({
  from: z.string().min(2),
  to: z.string().min(2),
  strings: z.record(z.string(), z.string()),
  scripts: z.record(z.string(), z.string()).optional(),
})

const localizeSchema = z.object({
  from: z.string().min(2),
  to: z.string().min(2),
  title: z.string().optional(),
  strings: z.record(z.string(), z.string()),
  scripts: z.record(z.string(), z.string()),
})

const lessonSchema = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  doc: z.unknown(),
  bundles: z.unknown(),
  imagesDone: z.number().int().min(0).optional(),
  imagesTotal: z.number().int().min(0).optional(),
  audioDone: z.number().int().min(0).optional(),
  audioTotal: z.number().int().min(0).optional(),
  status: z.enum(['DRAFT', 'READY', 'PUBLISHED']).optional(),
})

const findSchema = z.object({
  q: z.string().default(''),
  limit: z.number().int().min(1).max(60).optional(),
})

const imageSearchSchema = z.object({
  queries: z.array(z.string().min(1)).min(1).max(40),
})

const imageSchema = z.object({
  prompt: z.string().min(1),
  query: z.string().optional(),
  alt: z.string().optional(),
  tags: z.array(z.string()).optional(),
  /** bump to force a FRESH draw — "sinh cái khác" must not return the cache */
  variant: z.number().optional(),
  size: z.string().optional(),
  /** allow the PENDING-moderation generation fallback (author-time only). */
  allowGenerate: z.boolean().optional(),
})

const llmSchema = z.object({
  system: z.string(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
})

const genSchema = z.object({
  /** a brief/v1 LessonBrief (validated by the engine's parseBrief). */
  brief: z.unknown(),
  locale: z.string().optional(),
  wantImages: z.boolean().optional(),
})

export const explainer = new Hono<AppEnv>()
  /* ── lessons: a lesson has an OWNER and outlives the browser tab ─────────── */
  .get('/lessons', requireAuth, async (c) => ok(c, await listLessons(c.get('user')!.id)))
  .get('/lessons/:id', requireAuth, async (c) => {
    const lesson = await getLesson(c.get('user')!.id, c.req.param('id'))
    if (!lesson) throw AppError.notFound('lesson')
    return ok(c, lesson)
  })
  .put('/lessons', requireAuth, validate('json', lessonSchema), async (c) => {
    const b = c.req.valid('json')
    // The engine's gate is what protects the data, not the column types — the doc
    // is stored as JSON on purpose (see the schema comment).
    const parsed = parseDoc(b.doc)
    return ok(
      c,
      await upsertLesson(c.get('user')!.id, {
        slug: b.slug,
        title: parsed.meta.title || b.title,
        doc: b.doc as never,
        bundles: b.bundles as never,
        imagesDone: b.imagesDone,
        imagesTotal: b.imagesTotal,
        audioDone: b.audioDone,
        audioTotal: b.audioTotal,
        status: b.status,
      }),
    )
  })
  .delete('/lessons/:id', requireAuth, async (c) => {
    const gone = await deleteLesson(c.get('user')!.id, c.req.param('id'))
    if (!gone) throw AppError.notFound('lesson')
    return ok(c, { deleted: true })
  })
  .post('/tts', requireAuth, validate('json', ttsSchema), async (c) => {
    try {
      // goes through explainerVoice: the line is baked into the media library and
      // keyed by its INPUT, so asking for it again costs nothing and returns the
      // asset that already exists
      return ok(c, await explainerVoice(c.get('user'), c.req.valid('json')))
    } catch (e) {
      // Same swallow as the image route had: a TTS provider failure surfaced as a
      // bare 500 with no reason, so the caller could not tell a missing API key
      // from a rate limit from a bad voice id.
      throw AppError.serviceUnavailable(`tts: ${(e as Error).message}`)
    }
  })
  // search the media library only — free, fast, no generation
  .post('/images/find', requireAuth, validate('json', findSchema), async (c) => {
    const b = c.req.valid('json')
    return ok(c, await explainerFindImages(c.get('user'), b.q, b.limit))
  })
  .post('/audio/find', requireAuth, validate('json', findSchema), async (c) => {
    const b = c.req.valid('json')
    return ok(c, await explainerFindAudio(c.get('user'), b.q, b.limit))
  })
  .post('/images/search', requireAuth, validate('json', imageSearchSchema), async (c) => {
    const user = c.get('user')!
    return ok(c, await explainerSearchImages(user, c.req.valid('json').queries))
  })
  .post('/image/resolve', requireAuth, validate('json', imageSchema), async (c) => {
    const user = c.get('user')!
    const { allowGenerate, ...req } = c.req.valid('json')
    try {
      return ok(c, await explainerResolveImage(user, req, { allowGenerate: allowGenerate ?? false }))
    } catch (e) {
      // The provider threw a plain Error, which the global handler turned into a
      // bare 500 "Internal Server Error" — the caller was told nothing at all.
      // An image that cannot be made is a normal outcome; say WHY.
      throw AppError.serviceUnavailable(`image: ${(e as Error).message}`)
    }
  })
  // Translate a whole bundle at once (strings + narration scripts), keyed order
  // preserved. The cue markers [[cue:x]] MUST survive — they bind the visuals to
  // the voice — so they are stripped before translating and stitched back after.
  .post('/translate', requireAuth, validate('json', translateSchema), async (c) => {
    const { from, to, strings, scripts } = c.req.valid('json')
    const strEntries = Object.entries(strings)
    const scrEntries = Object.entries(scripts ?? {})

    // pull cue tokens out so the model can't mangle or drop them
    const cueMap: string[][] = []
    const strippedScripts = scrEntries.map(([, v]) => {
      const cues: string[] = []
      const clean = v.replace(/\[\[cue:[^\]]+\]\]/g, (m) => {
        cues.push(m)
        return `\u0000${cues.length - 1}\u0000`
      })
      cueMap.push(cues)
      return clean
    })

    const texts = [...strEntries.map(([, v]) => v), ...strippedScripts]
    if (!texts.length) return ok(c, { strings: {}, scripts: {} })
    const out = await translateContent({
      texts,
      from: from as never,
      to: to as never,
      context: 'lesson',
    })

    const outStrings: Record<string, string> = {}
    strEntries.forEach(([k], i) => {
      outStrings[k] = out[i] ?? strings[k]!
    })
    const outScripts: Record<string, string> = {}
    scrEntries.forEach(([k], i) => {
      const cues = cueMap[i] ?? []
      // stitch each cue token back where its placeholder landed
      // NUL sentinel (đặt ở trên) là CỐ Ý: ký tự này không thể có trong text soạn thảo nên máy dịch
      // không phá placeholder — đừng đổi sang ký tự thường.
      const t = (out[strEntries.length + i] ?? '').replace(
        // eslint-disable-next-line no-control-regex -- NUL là sentinel chủ đích, không phải lỗi gõ
        /\u0000(\d+)\u0000/g,
        (_m, n) => cues[Number(n)] ?? '',
      )
      outScripts[k] = t || (scripts?.[k] ?? '')
    })
    return ok(c, { strings: outStrings, scripts: outScripts })
  })
  // NATIVE localization (not machine translation): re-author the whole lesson in
  // the target language with full context. See localizeLesson.
  .post('/localize', requireAuth, validate('json', localizeSchema), async (c) => {
    const body = c.req.valid('json')
    return ok(c, await localizeLesson(body))
  })
  .post('/llm', requireAuth, validate('json', llmSchema), async (c) => {
    return ok(c, { text: await explainerComplete(c.req.valid('json')) })
  })
  .post('/generate', requireAuth, validate('json', genSchema), async (c) => {
    const { brief, locale, wantImages } = c.req.valid('json')
    const parsed = parseBrief(brief)
    if (!parsed.ok) {
      throw AppError.validation(
        parsed.issues.map((i) => ({ path: i.path, message: i.message, code: 'invalid_brief' })),
      )
    }
    return ok(c, await runGenerate(parsed.brief, { locale, wantImages }))
  })
