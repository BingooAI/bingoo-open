// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { z } from 'zod'
import type { EvidenceInput } from '@bingoo.ai/knowledge-engine'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { requireAuth } from '../auth'
import {
  certifyLearner,
  getLearnerFrontier,
  getNextSession,
  recordLearnerEvidence,
} from '../services/knowledge.service'
import { gradeAndFold } from '../services/content-grade.service'
import { getCrosswalk, getLearnerFrameworkReport } from '../repos/crosswalk.repo'
import { loadExposure } from '../repos/content-item.repo'
import { dueReview, reviewFlashcard } from '../services/srs.service'

/**
 * Knowledge engine — đo lường học tập trên đồ thị năng lực. Ghi bằng chứng (fold vào
 * mức nắm) + đọc biên học. Engine content-agnostic: chỉ nhận `Observation` + trả Candidate.
 */

const EvidenceBody = z
  .object({
    skill: z.string().min(1),
    correct: z.boolean().optional(),
    outcome: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    difficulty: z.number().optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    hintsUsed: z.number().int().nonnegative().optional(),
    retry: z.number().int().nonnegative().optional(),
    atMs: z.number().optional(),
    source: z.enum(['QUIZ', 'PROJECT', 'RUBRIC', 'PEER', 'OBSERVATION', 'TIME']).optional(),
    mode: z.enum(['LEARN', 'MEASURE']).optional(),
    itemKey: z.string().optional(),
    lang: z.string().optional(),
    knowledgePointId: z.string().optional(),
    attemptId: z.string().optional(),
  })
  .refine((b) => b.correct !== undefined || b.outcome !== undefined, 'provide correct or outcome')

const GradeBody = z.object({
  itemKey: z.string().min(1),
  attemptId: z.string().min(1),
  response: z.unknown(),
  latencyMs: z.number().int().nonnegative().optional(),
  hintsUsed: z.number().int().nonnegative().optional(),
  lang: z.string().optional(),
  atMs: z.number().optional(),
  // Với primitive không tự chấm (rubric/peer/observation): rater cấp outcome/confidence.
  outcome: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

const ReviewBody = z.object({
  cardKey: z.string().min(1),
  grade: z.enum(['again', 'hard', 'good', 'easy']),
})

const CertifyBody = z.object({
  objectives: z.array(z.string().min(1)).min(1),
})

export const knowledge = new Hono<AppEnv>()
  // CHUYỂN KHUNG cho NGƯỜI HỌC: học chương trình này, sang chương trình kia còn thiếu gì.
  // Dữ liệu khung (không nhạy cảm) — chỉ cần đăng nhập, không cần quyền biên soạn. Đối chiếu qua
  // KC nền dùng chung; nếu học viên đã có mastery thật thì `/framework/:slug/report` đọc theo họ.
  .get('/crosswalk/:a/:b', requireAuth, async (c) => {
    const r = await getCrosswalk(c.req.param('a'), c.req.param('b'))
    if (!r) throw AppError.notFound('Không có một trong hai chương trình này.')
    return ok(c, r)
  })
  .get('/framework/:slug/report', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const r = await getLearnerFrameworkReport(user.id, c.req.param('slug'))
    if (!r) throw AppError.notFound('Không có chương trình này.')
    return ok(c, r)
  })
  .post('/evidence', requireAuth, validate('json', EvidenceBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const body = c.req.valid('json')
    const ev: EvidenceInput = { ...body, actor: 'LEARNER_SELF' }
    return ok(c, await recordLearnerEvidence(user.id, ev))
  })
  .get('/frontier', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await getLearnerFrontier(user.id))
  })
  // Phiên học thích ứng: item kế tiếp từ ngân hàng (đã duyệt) khớp năng lực. ?size=&focus=slug,slug
  .get('/next', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const sizeRaw = c.req.query('size')
    const size = sizeRaw !== undefined ? Number(sizeRaw) : undefined
    const focus = c.req
      .query('focus')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return ok(
      c,
      await getNextSession(user.id, {
        ...(size !== undefined && Number.isFinite(size) ? { size } : {}),
        ...(focus && focus.length ? { focus } : {}),
      }),
    )
  })
  // Chứng nhận: đo mức nắm với tập objective (slug) → đạt/không + %.
  .post('/certify', requireAuth, validate('json', CertifyBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await certifyLearner(user.id, c.req.valid('json').objectives))
  })
  // Content HỌC (phơi bày) đã duyệt, lọc theo skills=slug,slug — để hiển thị cho học viên.
  .get('/content', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const skills = c.req
      .query('skills')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return ok(c, await loadExposure(skills && skills.length ? { skills } : undefined))
  })
  // Khép vòng: trả lời item ngân hàng → chấm → fold evidence → mức nắm. Idempotent qua attemptId.
  .post('/grade', requireAuth, validate('json', GradeBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')
    return ok(c, await gradeAndFold(user.id, { ...b, response: b.response }))
  })
  // Ôn tập SRS (flashcard) — KHÔNG sinh evidence, chỉ dời lịch ôn.
  .get('/review/due', requireAuth, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const skills = c.req
      .query('skills')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return ok(c, await dueReview(user.id, skills && skills.length ? { skills } : undefined))
  })
  .post('/review', requireAuth, validate('json', ReviewBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const { cardKey, grade } = c.req.valid('json')
    return ok(c, await reviewFlashcard(user.id, cardKey, grade))
  })
