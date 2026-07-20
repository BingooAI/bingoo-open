// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { clearPromptOverride, isPromptId, listPromptViews, setPromptOverride } from '../prompts'

/**
 * Prompt management (docs/media-library-design.md §6.3). ADMIN-only view + runtime
 * override of every LLM prompt in the catalog. Overrides live in RemoteConfig, so
 * a prompt can be tuned/hotfixed WITHOUT a release (R6); clearing reverts to the
 * in-code default. All prompt text is centralised — services never hardcode it.
 */
export const prompts = new Hono<AppEnv>()
  .get('/', requireRole('ADMIN'), async (c) => ok(c, await listPromptViews()))

  .put(
    '/:id',
    requireRole('ADMIN'),
    validate('json', z.object({ template: z.string().min(1).max(20000) })),
    async (c) => {
      const id = c.req.param('id')
      if (!isPromptId(id)) throw AppError.notFound('Unknown prompt id')
      const actor = c.get('user')
      await setPromptOverride(id, c.req.valid('json').template, actor?.id ?? null)
      return ok(c, { id, overridden: true })
    },
  )

  .delete('/:id', requireRole('ADMIN'), async (c) => {
    const id = c.req.param('id')
    if (!isPromptId(id)) throw AppError.notFound('Unknown prompt id')
    await clearPromptOverride(id)
    return ok(c, { id, overridden: false })
  })
