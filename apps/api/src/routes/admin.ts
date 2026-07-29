// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { z } from 'zod'
import type { Prisma } from '@bingoo.ai/db'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok, paginated } from '../lib/response'
import { validate } from '../lib/validate'
import { paginationMeta, paginationQuerySchema, toSkipTake } from '../lib/pagination'
import { requireRole } from '../auth'
import { queryAudit, writeAudit } from '../repos/audit.repo'
import { getRemoteConfig, setRemoteConfig } from '../repos/config.repo'
import { createSegment, listSegments, recomputeSegment, segmentMembers } from '../repos/segment.repo'
import { getUserDetail, listReportableFrameworks, listUsers } from '../repos/user-admin.repo'
import { getLearnerGapReport, listFrameworkStages } from '../services/knowledge.service'

const UserQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(40).optional(),
  accountType: z.string().trim().min(1).max(40).optional(),
})

const GapQuerySchema = z.object({
  framework: z.string().trim().min(1).max(200),
  /** Nhãn bậc riêng của từng khung — so bằng chuỗi, không diễn giải. */
  stage: z.string().trim().min(1).max(120).optional(),
})

const ConfigSchema = z.object({
  value: z.unknown().refine((v) => v !== undefined, 'value is required'),
})

const CriterionSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('accountType'), op: z.literal('in'), value: z.array(z.string()) }),
  z.object({ field: z.literal('country'), op: z.literal('in'), value: z.array(z.string()) }),
  z.object({ field: z.literal('role'), op: z.literal('has'), value: z.string() }),
  z.object({ field: z.literal('status'), op: z.literal('eq'), value: z.string() }),
  z.object({ field: z.literal('childrenCount'), op: z.literal('gte'), value: z.number().int() }),
  z.object({ field: z.literal('activeWithinDays'), op: z.literal('lte'), value: z.number().int() }),
])
const CreateSegmentSchema = z.object({
  key: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  rule: z.object({
    all: z.array(CriterionSchema).optional(),
    any: z.array(CriterionSchema).optional(),
  }),
})

const AuditQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
  actorUserId: z.string().optional(),
  organizationId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/**
 * Platform-admin operations (ADMIN only, §4). Remote config (§R6) is edited here:
 * changes take effect without a release. Extend with user/role/org admin as the
 * platform grows — all behind requireRole('ADMIN').
 */
export const admin = new Hono<AppEnv>()
  .get('/config/:key', requireRole('ADMIN'), async (c) => {
    const key = c.req.param('key')
    return ok(c, { key, value: await getRemoteConfig<unknown>(key, null) })
  })
  .put('/config/:key', requireRole('ADMIN'), validate('json', ConfigSchema), async (c) => {
    const actor = c.get('user')
    if (!actor) throw AppError.unauthorized()
    const key = c.req.param('key')
    const { value } = c.req.valid('json')

    await setRemoteConfig(key, value as Prisma.InputJsonValue, actor.id)
    await writeAudit({
      action: 'config.updated',
      actorUserId: actor.id,
      targetType: 'config',
      targetId: key,
    })
    return ok(c, { key, value })
  })
  // Platform-wide audit lookup (§7). Org-scoped lookup lives at /orgs/:orgId/audit.
  .get('/audit', requireRole('ADMIN'), validate('query', AuditQuerySchema), async (c) => {
    const q = c.req.valid('query')
    const { skip, take } = toSkipTake(q)
    const { items, total } = await queryAudit(
      {
        action: q.action,
        actorUserId: q.actorUserId,
        organizationIds: q.organizationId ? [q.organizationId] : undefined,
        from: q.from,
        to: q.to,
      },
      skip,
      take,
    )
    return paginated(c, items, paginationMeta(q, total))
  })
  // ── Segmentation (§3.8) — admin-managed analytics cohorts ──────────────────
  .get('/segments', requireRole('ADMIN'), async (c) => ok(c, await listSegments()))
  .post('/segments', requireRole('ADMIN'), validate('json', CreateSegmentSchema), async (c) => {
    const actor = c.get('user')
    const segment = await createSegment(c.req.valid('json'))
    await writeAudit({
      action: 'segment.created',
      actorUserId: actor?.id ?? null,
      targetType: 'segment',
      targetId: segment.key,
    })
    return ok(c, segment, 201)
  })
  .post('/segments/:key/recompute', requireRole('ADMIN'), async (c) => {
    const count = await recomputeSegment(c.req.param('key'))
    return ok(c, { key: c.req.param('key'), members: count })
  })
  .get('/segments/:key/members', requireRole('ADMIN'), async (c) =>
    ok(c, await segmentMembers(c.req.param('key'))),
  )
  // ── Người dùng ────────────────────────────────────────────────────────────
  .get('/users', requireRole('ADMIN'), validate('query', UserQuerySchema), async (c) => {
    const q = c.req.valid('query')
    const { skip, take } = toSkipTake(q)
    const { items, total } = await listUsers({
      skip,
      take,
      ...(q.q === undefined ? {} : { q: q.q }),
      ...(q.role === undefined ? {} : { role: q.role }),
      ...(q.accountType === undefined ? {} : { accountType: q.accountType }),
    })
    return paginated(c, items, paginationMeta(q, total))
  })
  .get('/users/:id', requireRole('ADMIN'), async (c) => {
    const user = await getUserDetail(c.req.param('id'))
    if (!user) throw AppError.notFound('Không có người dùng này.')
    return ok(c, user)
  })
  /**
   * Lỗ hổng của MỘT người học so với một khung.
   *
   * Ghi audit, và ghi trước khi trả về. Đây là hồ sơ học tập của một đứa trẻ; ai mở nó ra và
   * lúc nào là chuyện phải trả lời được sau này. Ghi sau khi trả về thì mọi lần đọc bị lỗi
   * giữa chừng đều biến mất khỏi sổ.
   */
  .get('/users/:id/gap', requireRole('ADMIN'), validate('query', GapQuerySchema), async (c) => {
    const actor = c.get('user')
    const id = c.req.param('id')
    const { framework, stage } = c.req.valid('query')

    await writeAudit({
      action: 'learner.gap.viewed',
      actorUserId: actor?.id ?? null,
      targetType: 'user',
      targetId: id,
    })

    const report = await getLearnerGapReport(id, framework, stage)
    if (!report) throw AppError.notFound('Không có chương trình này.')
    return ok(c, report)
  })
  .get('/users/:id/gap/frameworks', requireRole('ADMIN'), async (c) =>
    ok(c, await listReportableFrameworks()),
  )
  .get('/frameworks/:slug/stages', requireRole('ADMIN'), async (c) =>
    ok(c, await listFrameworkStages(c.req.param('slug'))),
  )
