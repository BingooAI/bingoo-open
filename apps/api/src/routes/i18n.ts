import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { defaultLocale, isValidLocale, locales, localeMeta, messages } from '@bingoo/i18n'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { requireRole } from '../auth'
import { translateContent } from '../lib/translation'

/**
 * i18n surface. GETs are the *delivery* channel for the shared static catalog
 * (`@bingoo/i18n`, R3) — web bundles it today, mobile/remote-config can fetch it
 * here (R6). `POST /translate` is the *dynamic* content path (ADMIN-only so the
 * LLM can't be driven from clients); feature code should call `translateContent`
 * directly rather than hop through HTTP.
 */

const localeSchema = z.enum(locales)

const TranslateSchema = z.object({
  texts: z.array(z.string().min(1).max(5000)).min(1).max(50),
  to: localeSchema,
  from: localeSchema.optional(),
  context: z.string().max(200).optional(),
  glossary: z.record(z.string(), z.string()).optional(),
  glossaryVersion: z.string().max(80).optional(),
})

export const i18n = new Hono<AppEnv>()
  .get('/locales', (c) => ok(c, { locales, defaultLocale, meta: localeMeta }))
  .get('/messages/:locale', (c) => {
    const locale = c.req.param('locale')
    if (!isValidLocale(locale)) throw AppError.notFound(`unknown locale: ${locale}`)

    const catalog = messages[locale]
    const etag = `"${createHash('sha1').update(JSON.stringify(catalog)).digest('hex')}"`
    if (c.req.header('if-none-match') === etag) return c.body(null, 304)

    c.header('ETag', etag)
    c.header('Cache-Control', 'public, max-age=300')
    return ok(c, { locale, messages: catalog })
  })
  .post('/translate', requireRole('ADMIN'), validate('json', TranslateSchema), async (c) => {
    const body = c.req.valid('json')
    const translations = await translateContent(body)
    return ok(c, { translations })
  })
