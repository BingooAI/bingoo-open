import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '@bingoo/db'
import { RELATIONSHIP_TYPES } from '@bingoo/core'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { requireAuth } from '../auth'
import { writeAudit } from '../repos/audit.repo'
import {
  approveRelationship,
  blockRelationship,
  listRelationships,
  requestRelationship,
  respondToRelationship,
} from '../repos/relationship.repo'

const RequestSchema = z
  .object({
    toPublicId: z.string().optional(),
    toUserId: z.string().optional(),
    type: z.enum(RELATIONSHIP_TYPES),
  })
  .refine((b) => Boolean(b.toPublicId) || Boolean(b.toUserId), 'provide toPublicId or toUserId')

/**
 * Family + social relationships (§6). Display/connection only — NOT account
 * management. Adults connect freely; minors are gated by known-contact + guardian
 * approval (relationship.repo). Directional types are inferred per viewer.
 */
export const relationships = new Hono<AppEnv>()
  .get('/', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listRelationships(user.id))
  })
  .post('/', requireAuth, validate('json', RequestSchema), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const body = c.req.valid('json')

    const target = await db.user.findFirst({
      where: body.toPublicId ? { publicId: body.toPublicId } : { id: body.toUserId },
      select: { id: true },
    })
    if (!target) throw AppError.notFound('User not found')

    const rel = await requestRelationship({
      requester: { id: user.id, accountType: user.accountType },
      toUserId: target.id,
      type: body.type,
    })
    await writeAudit({
      action: 'relationship.requested',
      actorUserId: user.id,
      targetType: 'user',
      targetId: target.id,
      metadata: { type: body.type },
    })
    return ok(c, rel, 201)
  })
  .post('/:id/accept', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const rel = await respondToRelationship(user.id, c.req.param('id'), 'accept')
    await writeAudit({
      action: 'relationship.accepted',
      actorUserId: user.id,
      targetType: 'relationship',
      targetId: c.req.param('id'),
    })
    return ok(c, rel)
  })
  .post('/:id/decline', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const rel = await respondToRelationship(user.id, c.req.param('id'), 'decline')
    await writeAudit({
      action: 'relationship.declined',
      actorUserId: user.id,
      targetType: 'relationship',
      targetId: c.req.param('id'),
    })
    return ok(c, rel)
  })
  .post('/:id/approve', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const rel = await approveRelationship(user.id, c.req.param('id'))
    await writeAudit({
      action: 'relationship.guardian_approved',
      actorUserId: user.id,
      targetType: 'relationship',
      targetId: c.req.param('id'),
    })
    return ok(c, rel)
  })
  .post('/:id/block', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const rel = await blockRelationship(user.id, c.req.param('id'))
    await writeAudit({
      action: 'relationship.blocked',
      actorUserId: user.id,
      targetType: 'relationship',
      targetId: c.req.param('id'),
    })
    return ok(c, rel)
  })
