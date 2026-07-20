import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '@bingoo/db'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { requireAuth, requireClassRole, requireRole } from '../auth'
import { writeAudit } from '../repos/audit.repo'
import { addMember, createClass, listClassesForUser, listMembers, removeMember } from '../repos/class.repo'

const CreateClassSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().max(80).optional(),
  term: z.string().trim().max(40).optional(),
  organizationId: z.string().optional(),
})

const AddMemberSchema = z
  .object({
    publicId: z.string().optional(),
    userId: z.string().optional(),
    role: z.enum(['TEACHER', 'TA', 'TUTOR', 'STUDENT']),
  })
  .refine((b) => Boolean(b.publicId) || Boolean(b.userId), 'provide publicId or userId')

/**
 * Classes + enrollment (§6). Only platform TEACHER/TUTOR may create a class; the
 * creator becomes its lead TEACHER. All member operations are class-scoped via
 * requireClassRole, so a teacher acts only within classes they belong to.
 */
export const classes = new Hono<AppEnv>()
  .post('/', requireRole('TEACHER', 'TUTOR'), validate('json', CreateClassSchema), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const body = c.req.valid('json')

    // A class may attach to an org only if the creator belongs to that org —
    // prevents smuggling a class under an organization you aren't part of (§6).
    if (body.organizationId) {
      const member = await db.member.findUnique({
        where: { organizationId_userId: { organizationId: body.organizationId, userId: user.id } },
        select: { id: true },
      })
      if (!member) throw AppError.forbidden('Not a member of that organization')
    }

    const cls = await createClass({
      creatorId: user.id,
      name: body.name,
      subject: body.subject ?? null,
      term: body.term ?? null,
      organizationId: body.organizationId ?? null,
    })
    await writeAudit({
      action: 'class.created',
      actorUserId: user.id,
      organizationId: body.organizationId ?? null,
      classId: cls.id,
      targetType: 'class',
      targetId: cls.id,
    })
    return ok(c, cls, 201)
  })
  .get('/', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listClassesForUser(user.id))
  })
  .get('/:classId', requireClassRole('TEACHER', 'TA', 'TUTOR', 'STUDENT'), async (c) => {
    const cls = await db.class.findUnique({
      where: { id: c.req.param('classId') },
      select: {
        id: true,
        name: true,
        subject: true,
        term: true,
        status: true,
        organizationId: true,
        createdAt: true,
      },
    })
    if (!cls) throw AppError.notFound()
    return ok(c, cls)
  })
  // Only teaching roles see the roster (a student can't enumerate classmates).
  .get('/:classId/members', requireClassRole('TEACHER', 'TA', 'TUTOR'), async (c) =>
    ok(c, await listMembers(c.req.param('classId'))),
  )
  .post('/:classId/members', requireClassRole('TEACHER'), validate('json', AddMemberSchema), async (c) => {
    const actor = c.get('user')
    if (!actor) throw AppError.unauthorized()
    const classId = c.req.param('classId')
    const body = c.req.valid('json')

    const target = await db.user.findFirst({
      where: body.publicId ? { publicId: body.publicId } : { id: body.userId },
      select: { id: true },
    })
    if (!target) throw AppError.notFound('User not found')

    await addMember(classId, target.id, body.role)
    await writeAudit({
      action: 'class.enroll',
      actorUserId: actor.id,
      classId,
      targetType: 'user',
      targetId: target.id,
      metadata: { role: body.role },
    })
    return ok(c, { classId, userId: target.id, role: body.role }, 201)
  })
  .delete('/:classId/members/:userId', requireClassRole('TEACHER'), async (c) => {
    const actor = c.get('user')
    if (!actor) throw AppError.unauthorized()
    const classId = c.req.param('classId')
    const userId = c.req.param('userId')

    await removeMember(classId, userId)
    await writeAudit({
      action: 'class.unenroll',
      actorUserId: actor.id,
      classId,
      targetType: 'user',
      targetId: userId,
    })
    return ok(c, { ok: true })
  })
