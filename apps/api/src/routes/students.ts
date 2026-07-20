// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { db } from '@bingoo.ai/db'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { requireAuth } from '../auth'
import { canAccessStudent } from '../repos/class.repo'

/**
 * Student access through the union of valid relations (§6): a caller may read a
 * student only as themself, their guardian, a teacher of a shared class, or a
 * platform ADMIN/MODERATOR. This is the anti-leak rule — a teacher can't reach a
 * student outside their classes, enforced entirely server-side (R6).
 */
export const students = new Hono<AppEnv>().get('/:id', requireAuth, async (c) => {
  const requester = c.get('user')
  if (!requester) throw AppError.unauthorized()
  const studentId = c.req.param('id')

  if (!(await canAccessStudent(requester, studentId))) throw AppError.forbidden()

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      publicId: true,
      name: true,
      username: true,
      accountType: true,
      status: true,
    },
  })
  if (!student) throw AppError.notFound()
  return ok(c, student)
})
