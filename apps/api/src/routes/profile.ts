// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { requireAuth } from '../auth'
import { writeAudit } from '../repos/audit.repo'
import { emitEvent } from '../repos/events.repo'
import { canAccessStudent } from '../repos/class.repo'
import { build360 } from '../repos/profile360.repo'
import {
  getAllFacets,
  isFacetName,
  upsertLearner,
  upsertParent,
  upsertProfessional,
  upsertTeacher,
} from '../repos/facet.repo'

const metadata = z.record(z.string(), z.unknown()).optional()

const LearnerSchema = z.object({
  level: z.string().max(40).optional(),
  gradeBand: z.string().max(40).optional(),
  goals: z.string().max(500).optional(),
  interests: z.array(z.string().max(60)).max(50).optional(),
  streak: z.number().int().min(0).optional(),
  xp: z.number().int().min(0).optional(),
  metadata,
})
const TeacherSchema = z.object({
  subjects: z.array(z.string().max(60)).max(50).optional(),
  bio: z.string().max(1000).optional(),
  certifications: z.array(z.record(z.string(), z.unknown())).optional(),
  rating: z.number().min(0).max(5).optional(),
  yearsExperience: z.number().int().min(0).max(80).optional(),
  metadata,
})
const ParentSchema = z.object({
  preferences: z.record(z.string(), z.unknown()).optional(),
  metadata,
})
const ProfessionalSchema = z.object({
  title: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  organizationId: z.string().optional(),
  metadata,
})

/**
 * Profile facets + the 360° projection (§3.8). Users self-manage their own facets
 * (`/me/facets/...`); the 360° read-model aggregates core + facets + relations +
 * activity. Viewing another user's 360° goes through the same union-of-relations
 * gate as student access (self / guardian / shared-class teacher / admin).
 */
export const profile = new Hono<AppEnv>()
  .get('/me/facets', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await getAllFacets(user.id))
  })
  .put('/me/facets/:facet', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const facet = c.req.param('facet')
    if (!isFacetName(facet)) throw AppError.notFound('Unknown facet')

    const body: unknown = await c.req.json().catch(() => ({}))
    let result
    switch (facet) {
      case 'learner':
        result = await upsertLearner(user.id, LearnerSchema.parse(body))
        break
      case 'teacher':
        result = await upsertTeacher(user.id, TeacherSchema.parse(body))
        break
      case 'parent':
        result = await upsertParent(user.id, ParentSchema.parse(body))
        break
      case 'professional':
        result = await upsertProfessional(user.id, ProfessionalSchema.parse(body))
        break
    }

    await emitEvent(user.id, 'facet.updated', { facet })
    await writeAudit({
      action: 'facet.updated',
      actorUserId: user.id,
      targetType: 'facet',
      targetId: facet,
    })
    return ok(c, result)
  })
  .get('/me/360', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await build360(user.id))
  })
  .get('/users/:id/360', requireAuth, async (c) => {
    const requester = c.get('user')
    if (!requester) throw AppError.unauthorized()
    const targetId = c.req.param('id')
    if (!(await canAccessStudent(requester, targetId))) throw AppError.forbidden()

    const view = await build360(targetId)
    if (!view) throw AppError.notFound()
    return ok(c, view)
  })
