// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { z } from 'zod'
import type { GraphData } from '@bingoo.ai/knowledge-engine'
import type { RawSource } from '@bingoo.ai/authoring'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { requireRole } from '../auth'
import { ingestSource } from '../services/authoring-ingest.service'
import { applyAuthoredFramework } from '../services/authoring.service'
import { GraphBody, ResolveCollisionsBody } from './authoring.schema'
import type { FrameworkMeta } from '../repos/authoring.repo'
import type { CompiledConcept, CompiledObjective, Merge } from '@bingoo.ai/authoring'
import { generateLessonContent } from '../services/content-generate.service'
import { generateOneItem } from '../services/content-item-gen.service'
import { allPrimitives, primitiveInfos, recommendPrimitives } from '../services/primitive-info.service'
import { applyMediaAsset } from '@bingoo.ai/authored-item'
import { itemMediaSlots } from '../services/item-media.service'
import { getAssetById } from '../repos/media-asset.repo'
import { serializeAsset } from '../lib/media-serialize'
import {
  approveItems,
  countItemsForPrimitive,
  deleteItem,
  listItemsForReview,
  loadItem,
  saveItems,
} from '../repos/content-item.repo'
import { generateLessonPlanFor, generateLessonPlanInCourse } from '../services/plan-generate.service'
import { getPlanGrounding } from '../services/plan-grounding.service'
import { acceptProposal } from '../services/proposal-accept.service'
import { generateCoursePlan, generateUnitPlan } from '../services/plan-hierarchy.service'
import { cancelPlanJob, getPlanJob, startPlanJob } from '../services/plan-jobs'
import { deriveLevelInsights } from '../services/plan-insights.service'
import { approvePlan, getPlan, listPlans } from '../repos/plan-hierarchy.repo'
import { misconceptionsForKc, representationsForKc } from '../services/item-brief'
import {
  bankCoverage,
  bankDensityPolicy,
  bankTargetTotal,
  bandOfElo,
  coverageGapTotal,
  type BankItemFacets,
  type Richness,
} from '../services/bank-policy'
import { driveStep, getPipeline, startPipeline } from '../services/authoring-workflow.service'
import {
  chunkText,
  extractSourceText,
  frameworkFromPdf,
  resolveFrameworkCollisions,
  frameworkFromPrompt,
  frameworkFromText,
} from '../services/authoring-framework.service'
import {
  getDecisionTraces,
  getObjectiveTrace,
  getSourceDocumentBytes,
  setTraceVerdict,
} from '../services/decision-trace.service'

/**
 * Bốn loại thẻ đọc được. Dùng thẳng giá trị trong cơ sở dữ liệu, không đặt bí danh — một bảng tra
 * bí danh là một chỗ nữa để lệch, và đây là đường chỉ nhân sự nội bộ mở.
 *
 * CONCEPT_IDENTITY không có làn nguồn lẫn làn tự kiểm: trigram không sinh ra thứ gì kiểm được. Lời
 * giải thích của nó nằm ở cột `reason`, và tấm thẻ vẽ đúng cột đó.
 */
const TraceArtifactParam = z.enum(['OBJECTIVE_EXISTS', 'CONCEPT_EXISTS', 'PREREQ_EDGE', 'OBJECTIVE_COVERAGE'])
import { courseShellFromBook, courseShellFromPrompt } from '../services/course-shell.service'
import { alignSource } from '../services/alignment.service'
import { applyAlignDecisions, listAlignHistory } from '../services/alignment-apply.service'
import { getCoverage } from '../repos/coverage.repo'
import { getCrosswalk } from '../repos/crosswalk.repo'
import { deleteCourse, getCourse, listCourses, setCourseStatus } from '../repos/course.repo'
import {
  createFrameworkVersion,
  getFrameworkDetail,
  getFrameworkGraph,
  listFrameworks,
  listStages,
  loadFrameworkForExport,
  publishFrameworkVersion,
} from '../repos/authoring.repo'
import { CaseDecodeError, decodeCase, encodeCase, type EncodeInput } from '@bingoo.ai/codecs/case'
import { writeAudit } from '../repos/audit.repo'
import type { LessonInstructionPlan } from '@bingoo.ai/plans'
import type { EngineSnapshot, LearnerPersona, TeacherPersona } from '@bingoo.ai/personalization'

/**
 * Authoring — biên soạn khung năng lực. S2: nguồn thô → (LLM) đồ thị KC ứng viên (DỪNG ở review).
 * Sau khi người duyệt → /apply ghi vào đồ thị (cổng chặn chu trình). Chia nhỏ · duyệt · tái sinh.
 */

// Biên soạn nội dung = quyền tác giả (CONTENT_EDITOR) hoặc ADMIN. requireRole tự chặn chưa-đăng-nhập.
const authorGuard = requireRole('CONTENT_EDITOR', 'ADMIN')

const SourceBody = z.object({
  id: z.string().min(1),
  kind: z.enum(['pdf', 'zip-images', 'text']),
  locale: z.string().min(1),
  chunks: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().nonnegative(),
        label: z.string().optional(),
        text: z.string().optional(),
        imageRef: z.string().optional(),
      }),
    )
    .min(1),
  threshold: z.number().min(0).max(1).optional(),
})

// Nguồn → framework: slug/name để dựng Framework thật (kèm objectives có mã) chứ không chỉ competency rời.
const FromSourceBody = z.object({
  locale: z.string().min(1).default('vi'),
  slug: z.string().min(1).optional(),
  name: z.record(z.string(), z.string()).optional(),
})

// stage/frameworkSlug: vốn từ KC được lọc qua objective(stage) --MAPS_TO--> KC → sách Stage 1 chỉ
// neo vào KC mà khung Stage 1 chứng nhận.
const CourseScope = {
  locale: z.string().min(1).default('vi'),
  frameworkVersionId: z.string().optional(),
  frameworkSlug: z.string().optional(),
  stage: z.string().optional(),
  strand: z.string().optional(),
}
const CourseBody = z.object({ brief: z.string().min(1), ...CourseScope })
const BookBody = z.object({ pdf: z.string().min(1), ...CourseScope })

const LearnerBody = z.object({
  level: z.enum(['L1', 'L2', 'L3']),
  language: z.string().min(1),
  age: z.number().int().optional(),
  interests: z.array(z.string()).optional(),
  accessibility: z.array(z.string()).optional(),
})
const TeacherBody = z
  .object({
    style: z.string().optional(),
    classSize: z.number().int().optional(),
    minutes: z.number().int().optional(),
    variants: z.array(z.string()).optional(),
  })
  .optional()
const SnapshotBody = z
  .object({
    mastered: z.array(z.string()).optional(),
    fading: z.array(z.string()).optional(),
    frontier: z.array(z.string()).optional(),
  })
  .optional()
// Nhẹ: contentPlan chỉ đọc teaches + knowledgePoints[].targets để suy ra KC đích.
/**
 * Sinh nội dung: nêu BÀI NÀO, không gửi giáo án.
 *
 * Trước đây thân yêu cầu mang thẳng giáo án, nên route không biết nó đang sinh cho bài nào và
 * KHÔNG THỂ kiểm giáo án ấy đã được duyệt hay chưa — kể cả nếu muốn. Cổng duyệt chỉ tồn tại ở nút
 * bấm trong trình duyệt, mà một cổng chỉ có ở trình duyệt thì không phải cổng.
 *
 * Đường sinh GIÁO ÁN một bước trước đó đã theo đúng nguyên tắc này: nó lấy kiến thức TỪ VỎ KHOÁ và
 * ghi rõ "không tin client". Bước sinh NỘI DUNG TỚI TRẺ thì lại tin — đúng chỗ không được tin nhất.
 */
const ContentBody = z.object({
  courseSlug: z.string().min(1),
  lessonSlug: z.string().min(1),
  learner: LearnerBody,
  teacher: TeacherBody,
  snapshot: SnapshotBody,
})

export const authoring = new Hono<AppEnv>()
  .post('/content/generate', authorGuard, validate('json', ContentBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')

    // Giáo án lấy TỪ KHO, và phải ĐÃ DUYỆT. Đây là thứ trẻ sẽ học (R5) — không có bước nào sau đây
    // để bắt lại, nên chặn ở đây chứ không ở nút bấm.
    const stored = await getPlan(b.courseSlug, 'lesson', b.lessonSlug)
    if (!stored) throw AppError.notFound('Chưa có giáo án cho bài này.')
    if (stored.status !== 'APPROVED') {
      throw AppError.validation([
        {
          path: 'lessonSlug',
          message: 'Giáo án của bài này chưa được duyệt — duyệt trước, vì nội dung sinh ra là thứ trẻ học.',
          code: 'plan_not_approved',
        },
      ])
    }

    return ok(
      c,
      await generateLessonContent({
        lesson: stored.doc as LessonInstructionPlan,
        learner: b.learner as LearnerPersona,
        userId: user.id, // không truyền snapshot → tự chụp ảnh engine của học viên
        ...(b.teacher ? { teacher: b.teacher as TeacherPersona } : {}),
        ...(b.snapshot ? { snapshot: b.snapshot as EngineSnapshot } : {}),
      }),
    )
  })
  // S4 — sinh Instruction Plan cho tập KC + chấm planQuality (đường CŨ, không grounding/không lưu).
  .post(
    '/plan/generate',
    authorGuard,
    validate(
      'json',
      z.object({
        kcs: z.array(z.string().min(1)).min(1),
        language: z.string().min(1).default('vi'),
        level: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { kcs, language, level } = c.req.valid('json')
      return ok(c, await generateLessonPlanFor({ kcs, language, ...(level ? { level } : {}) }))
    },
  )

  // ── KẾ HOẠCH PHÂN CẤP: Khoá → Unit → Bài. Mỗi cấp sinh (DRAFT) → duyệt → mới sinh cấp con. ──────
  // Sinh 1 kế hoạch = 1 LLM call ~1.5–2 phút → KHÔNG giữ socket đồng bộ (proxy/LB cắt "socket hang
  // up" dù server vẫn xong). Thay bằng JOB NỀN: trả 202 + trạng thái ngay; service tự LƯU plan khi
  // xong; client POLL /job (reload vẫn nối lại vì job theo tiến trình, không theo trình duyệt).
  // P1) Kế hoạch KHOÁ.
  .post('/plan/course/:course/generate', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const course = c.req.param('course')
    const language = c.req.query('language') ?? 'vi'
    const job = startPlanJob(course, 'course', course, (signal) =>
      generateCoursePlan({ courseSlug: course, language, userId: user.id, signal }),
    )
    return ok(c, job, 202)
  })
  // P2) Kế hoạch UNIT (gate: khoá đã duyệt).
  .post('/plan/course/:course/unit/:unit/generate', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const course = c.req.param('course')
    const unit = c.req.param('unit')
    const language = c.req.query('language') ?? 'vi'
    const job = startPlanJob(course, 'unit', unit, (signal) =>
      generateUnitPlan({ courseSlug: course, unitSlug: unit, language, userId: user.id, signal }),
    )
    return ok(c, job, 202)
  })
  // P3) Kế hoạch BÀI (gate: unit đã duyệt) — grounding bằng context khoá+unit, LƯU lại.
  .post('/plan/course/:course/lesson/:lesson/generate', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const course = c.req.param('course')
    const lesson = c.req.param('lesson')
    const level = c.req.query('level') ?? undefined
    const language = c.req.query('language') ?? 'vi'
    const job = startPlanJob(course, 'lesson', lesson, (signal) =>
      generateLessonPlanInCourse({
        courseSlug: course,
        lessonSlug: lesson,
        language,
        ...(level ? { level } : {}),
        userId: user.id,
        signal,
      }),
    )
    return ok(c, job, 202)
  })
  // P3b) Trạng thái job sinh (poll). state='idle' nếu chưa/không có job cho key này.
  .get('/plan/course/:course/job', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const level = c.req.query('level')
    const ref = c.req.query('ref')
    if (level !== 'course' && level !== 'unit' && level !== 'lesson')
      throw AppError.badRequest('level phải là course|unit|lesson.')
    if (!ref) throw AppError.badRequest('Thiếu ref.')
    const job = getPlanJob(c.req.param('course'), level, ref)
    return ok(c, job ?? { state: 'idle', level, refSlug: ref })
  })
  // P3c) HỦY job sinh đang chạy (abort LLM thật).
  .post(
    '/plan/course/:course/job/cancel',
    authorGuard,
    validate('json', z.object({ level: z.enum(['course', 'unit', 'lesson']), refSlug: z.string().min(1) })),
    (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { level, refSlug } = c.req.valid('json')
      const job = cancelPlanJob(c.req.param('course'), level, refSlug)
      if (!job) throw AppError.notFound('Không có job để hủy.')
      return ok(c, job)
    },
  )
  // P4) DUYỆT một kế hoạch (course|unit|lesson).
  .post(
    '/plan/course/:course/approve',
    authorGuard,
    validate('json', z.object({ level: z.enum(['course', 'unit', 'lesson']), refSlug: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { level, refSlug } = c.req.valid('json')
      const course = c.req.param('course')
      const r = await approvePlan(course, level, refSlug, user.id)
      if (r === 'not-found') throw AppError.notFound('Chưa có bản nháp kế hoạch để duyệt.')
      if (r === 'parent-not-approved') {
        // Nói rõ THỨ TỰ, không chỉ nói "không được": người soạn cần biết phải làm gì trước.
        throw AppError.validation([
          {
            path: 'level',
            message:
              level === 'unit'
                ? 'Kế hoạch KHOÁ chưa duyệt — duyệt nó trước, vì kế hoạch chương đứng trên nó.'
                : 'Kế hoạch CHƯƠNG chưa duyệt — duyệt nó trước, vì kế hoạch bài đứng trên nó.',
            code: 'parent_not_approved',
          },
        ])
      }
      // DẤU VẾT (R5): ai DUYỆT giáo án nào, lúc nào, bản mấy — thứ trẻ sẽ học đi qua đây.
      await writeAudit({
        action: 'authoring.plan.approve',
        actorUserId: user.id,
        targetType: 'authoring_plan',
        targetId: `${course}/${level}/${refSlug}`,
        metadata: { course, level, refSlug, version: r.version },
      })
      return ok(c, r)
    },
  )
  // P5) Liệt kê mọi kế hoạch của khoá (UI dựng cây trạng thái duyệt).
  .get('/plan/course/:course', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listPlans(c.req.param('course')))
  })
  // P6) DERIVED insights cho một cấp (khoá/unit/bài): KC theo LOẠI (knowledge/skill/…), mục tiêu, tiên
  // quyết — TÍNH từ graph, không author. Grounding cho người soạn + hiện ở review.
  .get('/plan/course/:course/insights', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const level = c.req.query('level')
    const ref = c.req.query('ref')
    if (level !== 'course' && level !== 'unit' && level !== 'lesson')
      throw AppError.badRequest('level phải là course|unit|lesson.')
    if (!ref) throw AppError.badRequest('Thiếu ref.')
    return ok(c, await deriveLevelInsights(c.req.param('course'), level, ref))
  })
  .post(
    '/content/approve',
    authorGuard,
    validate('json', z.object({ itemKeys: z.array(z.string().min(1)).min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const itemKeys = c.req.valid('json').itemKeys
      const approved = await approveItems(itemKeys)
      // DẤU VẾT (R5): ai DUYỆT nội dung tới trẻ — item nào, bao nhiêu.
      await writeAudit({
        action: 'authoring.content.approve',
        actorUserId: user.id,
        targetType: 'content_item',
        metadata: { itemKeys, count: approved },
      })
      return ok(c, { approved })
    },
  )
  // ── SINH TỪNG ITEM MỘT (per-item, KHÔNG batch): bấm → sinh 1 → soát → duyệt/sinh lại. Đa ngôn ngữ.
  // Item luôn mang KC (skills) + lesson (lessonSlug) + primitiveKind + band → tìm/lọc được về sau.
  .post(
    '/content/item/generate',
    authorGuard,
    validate(
      'json',
      z.object({
        kc: z.string().min(1),
        primitiveKind: z.string().min(1),
        courseSlug: z.string().min(1).optional(),
        lessonSlug: z.string().min(1).optional(),
        stepSlug: z.string().min(1).optional(),
        brief: z.string().optional(),
        band: z.enum(['easy', 'core', 'stretch']).optional(),
        languages: z.array(z.string().min(1)).optional(),
        representation: z.enum(['concrete', 'pictorial', 'abstract']).optional(),
        seq: z.number().int().nonnegative().optional(),
        /** true → seq kế tiếp (SINH MỚI, giữ bản cũ); mặc định seq=0 hoặc seq truyền (SINH LẠI, đè). */
        newItem: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const b = c.req.valid('json')
      const seq = b.seq ?? (b.newItem ? await countItemsForPrimitive(b.kc, b.primitiveKind) : 0)
      // ItemBrief: rút MISCONCEPTIONS của KC từ kế hoạch bài đã lưu (course+lesson) → distractor nhắm đúng
      // hiểu-sai. Thiếu course/lesson/plan → sinh như cũ (tương thích). Xem [[item-brief]].
      const mcs =
        b.courseSlug && b.lessonSlug
          ? misconceptionsForKc((await getPlan(b.courseSlug, 'lesson', b.lessonSlug))?.doc, b.kc)
          : []
      const item = await generateOneItem({
        kc: b.kc,
        primitiveKind: b.primitiveKind,
        seq,
        ...(b.lessonSlug ? { lessonSlug: b.lessonSlug } : {}),
        ...(b.stepSlug ? { stepSlug: b.stepSlug } : {}),
        ...(b.brief ? { brief: b.brief } : {}),
        ...(mcs.length ? { misconceptions: mcs } : {}),
        ...(b.band ? { band: b.band } : {}),
        ...(b.languages ? { languages: b.languages } : {}),
        ...(b.representation ? { representation: b.representation } : {}),
      })
      if (!item)
        throw AppError.validation([
          {
            path: 'item',
            message: 'LLM chưa ra item hợp lệ (sai hợp đồng/đáp án) — thử lại hoặc đổi loại.',
            code: 'no_item',
          },
        ])
      return ok(c, item)
    },
  )
  // TOÀN BỘ palette primitive (2 họ: quiz + kit) — để chọn loại HỢP, không kẹt gợi ý của plan.
  .get('/primitives', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, allPrimitives())
  })
  // GỢI Ý loại phù hợp cho MỘT step (LLM đọc brief + toàn catalogue) — hệ chọn hộ, khỏi dò 122 loại.
  .post(
    '/primitive-recommend',
    authorGuard,
    validate(
      'json',
      z.object({
        kc: z.string().min(1),
        brief: z.string().min(1),
        representation: z.string().optional(),
        band: z.string().optional(),
        language: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const b = c.req.valid('json')
      return ok(
        c,
        await recommendPrimitives({
          kc: b.kc,
          brief: b.brief,
          ...(b.representation ? { representation: b.representation } : {}),
          ...(b.band ? { band: b.band } : {}),
          ...(b.language ? { language: b.language } : {}),
        }),
      )
    },
  )
  // MÔ TẢ primitive (loại này LÀ GÌ, học sinh làm gì) — để soạn giả hiểu TRƯỚC khi sinh. isKit → preview được.
  .get('/primitive-info', authorGuard, (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const kinds = (c.req.query('kinds') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return ok(c, primitiveInfos(kinds))
  })
  // Liệt kê item để SOÁT — lọc theo KC (skill) và/hoặc bài. Mọi trạng thái đang soạn.
  .get('/content/items', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const skill = c.req.query('skill')
    const lesson = c.req.query('lesson')
    return ok(
      c,
      await listItemsForReview({
        ...(skill ? { skill } : {}),
        ...(lesson ? { lessonSlug: lesson } : {}),
      }),
    )
  })
  // ĐỘ DÀY NGÂN HÀNG (rich bank) cho 1 KC: chính sách ĐÍCH (rep×band×misconception) + đối chiếu bank hiện
  // có → GAP để sinh bù ĐÚNG chỗ thiếu. representations+misconceptions lấy từ KP của kế hoạch bài.
  .get('/content/density', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const kc = c.req.query('kc')
    const course = c.req.query('course')
    const lesson = c.req.query('lesson')
    const richness = (c.req.query('richness') ?? 'standard') as Richness
    if (!kc) throw AppError.badRequest('Thiếu kc.')
    const doc = course && lesson ? (await getPlan(course, 'lesson', lesson))?.doc : undefined
    const representations = doc ? representationsForKc(doc, kc) : []
    const misconceptions = doc ? misconceptionsForKc(doc, kc).map((m) => ({ id: m.id })) : []
    const policy = bankDensityPolicy({ representations, misconceptions, richness })
    // Item hiện có của KC → facets đã đóng dấu (payload.facets); band suy từ Elo nếu thiếu.
    const items = await listItemsForReview({
      skill: kc,
      ...(lesson ? { lessonSlug: lesson } : {}),
      statuses: ['DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED'],
    })
    const facets: BankItemFacets[] = items.map((it) => {
      const f = ((it.payload as { facets?: BankItemFacets })?.facets ?? {}) as BankItemFacets
      return { ...f, band: f.band ?? bandOfElo(it.difficulty) }
    })
    const coverage = bankCoverage(facets, policy)
    return ok(c, {
      kc,
      richness,
      representations,
      targetTotal: bankTargetTotal(policy),
      have: items.length,
      gapTotal: coverageGapTotal(coverage),
      coverage,
    })
  })
  // Xoá một bản nháp không ưng (itemKey mang `::` → dùng body, không nhét vào path).
  .post(
    '/content/item/delete',
    authorGuard,
    validate('json', z.object({ itemKey: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const removed = await deleteItem(c.req.valid('json').itemKey)
      if (!removed) throw AppError.notFound('Không có item này.')
      return ok(c, { deleted: c.req.valid('json').itemKey })
    },
  )
  // MEDIA per-item: ô media CẦN gắn (ảnh minh hoạ + đọc-to prompt + ô cấu trúc). Ảnh = chọn thư viện /
  // sinh mới; audio = sinh (sau khi ưng text). Gắn qua applyMediaAsset; nếu item đã duyệt, đổi media
  // HẠ nó về NEEDS_REVIEW (R5) — media mới tới trẻ phải xem lại.
  .get('/content/item/media-targets', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const itemKey = c.req.query('itemKey')
    if (!itemKey) throw AppError.badRequest('Thiếu itemKey.')
    const item = await loadItem(itemKey)
    if (!item) throw AppError.notFound('Không có item này.')
    return ok(c, { slots: itemMediaSlots(item) })
  })
  .post(
    '/content/item/media',
    authorGuard,
    // assetId rỗng = XOÁ media ở path đó. asUrl=true → LƯU URL xem được (cho kit render ảnh-vật).
    validate(
      'json',
      z.object({
        itemKey: z.string().min(1),
        path: z.string().min(1),
        assetId: z.string(),
        asUrl: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { itemKey, path, assetId, asUrl } = c.req.valid('json')
      const item = await loadItem(itemKey)
      if (!item) throw AppError.notFound('Không có item này.')
      // Kit render ảnh-vật cần URL (params.assets[shape]); ô khác lưu assetId. Xoá (rỗng) → giữ nguyên.
      let value = assetId
      if (asUrl && assetId) {
        const asset = await getAssetById(assetId)
        const s = asset ? await serializeAsset(asset) : null
        value = s?.renditions.find((r) => r.url)?.url ?? assetId
      }
      const payload = applyMediaAsset(item.payload, path, value)
      await saveItems([{ ...item, payload }]) // item ĐÃ DUYỆT + đổi media → saveItems HẠ về NEEDS_REVIEW (R5)
      return ok(c, { ...item, payload })
    },
  )
  // A) Sinh FRAMEWORK: từ prompt (generative) hoặc từ PDF (OCR). Trả draft để duyệt; /apply mới ghi.
  .post(
    '/framework/from-prompt',
    authorGuard,
    validate('json', z.object({ topic: z.string().min(1), locale: z.string().min(1).default('vi') })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { topic, locale } = c.req.valid('json')
      return ok(c, await frameworkFromPrompt(topic, locale))
    },
  )
  .post(
    '/framework/from-pdf',
    authorGuard,
    validate('json', FromSourceBody.extend({ pdf: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { pdf, locale, slug, name } = c.req.valid('json')
      return ok(
        c,
        await frameworkFromPdf(pdf, locale, {
          ...(slug ? { slug } : {}),
          ...(name ? { name } : {}),
        }),
      )
    },
  )
  // A2) BƯỚC TÁCH RỜI (để UI hiện tiến trình + kết quả từng chặng, cho sửa trước khi đi tiếp).
  .post(
    '/source/extract-text',
    authorGuard,
    validate('json', z.object({ pdf: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      return ok(c, await extractSourceText(c.req.valid('json').pdf))
    },
  )
  .post(
    '/framework/from-text',
    authorGuard,
    validate('json', FromSourceBody.extend({ text: z.string().min(1) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { text, locale, slug, name } = c.req.valid('json')
      return ok(
        c,
        await frameworkFromText(text, locale, {
          ...(slug ? { slug } : {}),
          ...(name ? { name } : {}),
        }),
      )
    },
  )

  // A4) ĐỐI CHIẾU khung #2 vào vốn KC canonical. KHÔNG ghi gì — chỉ trả ĐỀ XUẤT để người duyệt chốt.
  // Cấu trúc quyết phần lớn (miễn phí); LLM chỉ xử phần dư và phải nêu CÂU HỎI PHÂN BIỆT làm bằng chứng.
  .post(
    '/framework/align',
    authorGuard,
    validate(
      'json',
      z.object({
        text: z.string().min(1),
        locale: z.string().min(1).default('en'),
        subject: z.string().min(1).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const { text, locale, subject } = c.req.valid('json')
      const chunks = chunkText(text).map((t, i) => ({ id: `c${i}`, order: i, text: t }))
      return ok(
        c,
        await alignSource(
          { id: 'align-source', kind: 'text', locale, chunks },
          subject ? { subject } : undefined,
        ),
      )
    },
  )

  // A5) ÁP quyết định đối chiếu (người duyệt đã chốt). SAME → tái dùng KC; SUBSET/SUPERSET → cạnh
  // tiên quyết; OVERLAP → ALIGNS; NEW → mint. KHÔNG bao giờ tự gộp.
  .post(
    '/framework/align/apply',
    authorGuard,
    validate(
      'json',
      z.object({
        decisions: z
          .array(
            z.object({
              slug: z.string().min(1),
              title: z.record(z.string(), z.string()),
              kind: z.string().min(1).default('KNOWLEDGE'),
              subject: z.string().optional(),
              facets: z.record(z.string(), z.unknown()).optional(),
              verdict: z.enum(['SAME', 'SUBSET', 'SUPERSET', 'OVERLAP', 'NEW', 'UNKNOWN']),
              target: z.string().optional(),
              // Máy đề xuất gì — lưu lại để biết người đã SỬA những chỗ nào (tín hiệu chỉnh facets/prompt).
              proposedVerdict: z.enum(['SAME', 'SUBSET', 'SUPERSET', 'OVERLAP', 'NEW', 'UNKNOWN']).optional(),
              proposedBy: z.string().optional(),
              proposedReason: z.string().optional(),
            }),
          )
          .min(1),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      return ok(c, await applyAlignDecisions(c.req.valid('json').decisions as never, user.id))
    },
  )

  // A5b) LỊCH SỬ đối chiếu — ai chốt gì, máy đề xuất gì, người sửa chỗ nào.
  .get('/framework/align/history', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listAlignHistory(Number(c.req.query('limit') ?? 100)))
  })

  // A6) ĐỘ PHỦ 2 CHIỀU: objective (khung) ↕ KC ↕ bài học (khoá). Thấy lỗ hổng cả hai phía.
  .get('/coverage/:framework/:course', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const r = await getCoverage(c.req.param('framework'), c.req.param('course'))
    if (!r) throw AppError.notFound('Không có framework hoặc khoá học này.')
    return ok(c, r)
  })

  // A6b) CROSSWALK hai khung: KC TRÙNG + THIẾU gì khi chuyển mỗi chiều — join qua KC nền, không
  // qua cạnh objective↔objective. Người dạy đối chiếu Cambridge ↔ MOET để thấy học bên này chuyển
  // bên kia còn hụt gì.
  .get('/crosswalk/:a/:b', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const r = await getCrosswalk(c.req.param('a'), c.req.param('b'))
    if (!r) throw AppError.notFound('Không có một trong hai framework này.')
    return ok(c, r)
  })

  // A3) Quản lý FRAMEWORK: list · detail (versions + objectives) · graph · tạo version · phát hành.
  .get('/stages', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listStages())
  })
  .get('/framework', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listFrameworks())
  })
  .get('/framework/:slug', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const d = await getFrameworkDetail(c.req.param('slug'))
    if (!d) throw AppError.notFound('Không có framework này.')
    return ok(c, d)
  })
  .get('/framework/:slug/graph', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const g = await getFrameworkGraph(c.req.param('slug'))
    if (!g) throw AppError.notFound('Không có framework này.')
    return ok(c, g)
  })
  // TRUY NGUỒN một mục tiêu: thẻ "vì sao có mục tiêu này" + kiểm-lại-sống đối chiếu bản đóng băng.
  .get('/trace/objective/:slug', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const trace = await getObjectiveTrace(c.req.param('slug'))
    if (!trace) throw AppError.notFound('Chưa có vết truy nguồn cho mục tiêu này.')
    return ok(c, trace)
  })
  /**
   * TRUY NGUỒN một chỗ BẤT KỲ — bốn loại thẻ đi chung một đường.
   *
   * Đăng ký SAU đường `/trace/objective/:slug` là bắt buộc: Hono khớp theo thứ tự đăng ký, nên nếu
   * đường này đứng trước thì `/trace/objective/x` rơi vào đây với `artifact: 'objective'`, và một
   * endpoint đang chạy tốt biến thành lỗi 400.
   *
   * Trả DANH SÁCH và trả 200 cả khi rỗng: một mục tiêu có nhiều thẻ phủ (mỗi mảnh kiến thức một
   * thẻ), còn "chưa có thẻ nào" là trạng thái thường của người duyệt chứ không phải chuyện hỏng.
   */
  .get('/trace/:artifact/:subject', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const parsed = TraceArtifactParam.safeParse(c.req.param('artifact'))
    if (!parsed.success) throw AppError.badRequest('Loại thẻ căn cứ không hợp lệ.')
    const object = c.req.query('object')
    return ok(
      c,
      await getDecisionTraces({
        artifact: parsed.data,
        subjectSlug: c.req.param('subject'),
        ...(object ? { objectSlug: object } : {}),
      }),
    )
  })
  /**
   * VÌ SAO GIÁO ÁN NÀY Ở ĐÂY — nối lại từ vết đã có, không đúc thẻ mới.
   *
   * Kế hoạch bài neo vào ba thứ và cả ba đều đã có vết riêng. Chỗ này chỉ đi lại con đường đó:
   * bài dạy kiến thức nào → kiến thức ấy chứng nhận mục tiêu nào → bài đến từ đâu trong sách.
   */
  .get('/plan/:courseSlug/:lessonSlug/grounding', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await getPlanGrounding(c.req.param('courseSlug'), c.req.param('lessonSlug')))
  })
  /**
   * NGƯỜI DUYỆT CHỐT một tấm thẻ. Lần đầu tiên trong hệ có đường ghi phán quyết.
   *
   * TỪ CHỐI và SỬA đòi lý do, và đòi ở đây chứ không nhắc nhở: một tấm thẻ bị từ chối mà không nêu
   * lý do trông y hệt một tấm chưa ai xem, nên "vì sao điều này không được nhận" mất luôn câu trả
   * lời — đúng cái lỗi đã phải sửa ba lần ở những chỗ khác trong hệ này.
   */
  .post(
    '/trace/:id/verdict',
    authorGuard,
    validate(
      'json',
      z.object({
        verdict: z.enum(['CONFIRMED', 'REJECTED', 'EDITED']),
        note: z.string().trim().max(500).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const b = c.req.valid('json')
      if (b.verdict !== 'CONFIRMED' && (b.note === undefined || b.note.length === 0)) {
        throw AppError.validation([
          { path: 'note', message: 'Từ chối hoặc sửa thì phải nêu lý do.', code: 'note_required' },
        ])
      }
      const r = await setTraceVerdict({
        id: c.req.param('id'),
        verdict: b.verdict,
        ...(b.note !== undefined ? { note: b.note } : {}),
        decidedById: user.id,
        decidedAt: new Date(),
      })
      if (!r) throw AppError.notFound('Không có thẻ căn cứ này.')
      // DẤU VẾT: ai chốt cái gì — phán quyết của người là thứ thi hành, nên phải ghi lại.
      await writeAudit({
        action: 'authoring.trace.verdict',
        actorUserId: user.id,
        targetType: 'decision_record',
        targetId: r.id,
        metadata: { verdict: r.verdict, overridden: r.overridden },
      })
      return ok(c, r)
    },
  )
  /**
   * NHẬN một đề xuất làm dày — sách dạy thứ khung chưa có, người duyệt đồng ý đưa vào.
   *
   * Đòi người duyệt khai NÓ NÓI VỀ CÁI GÌ và học QUA KÊNH NÀO. Không phải thủ tục: một kiến thức
   * không có dấu hiệu phân biệt thì ngày mai không ai tách nổi nó khỏi cái bên cạnh, và gộp sai là
   * hỏng vĩnh viễn mà không có tín hiệu nào báo. Máy đúc từ nhan đề là tự tạo ra đúng thứ đó.
   */
  .post(
    '/trace/:id/accept-proposal',
    authorGuard,
    validate(
      'json',
      z.object({
        object: z.string().trim().min(1).max(64),
        channel: z.string().trim().min(1).max(64),
        bloom: z.string().trim().max(32).optional(),
        subject: z.string().trim().max(64).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const b = c.req.valid('json')
      const r = await acceptProposal({
        traceId: c.req.param('id'),
        object: b.object,
        channel: b.channel,
        ...(b.bloom !== undefined ? { bloom: b.bloom } : {}),
        ...(b.subject !== undefined ? { subject: b.subject } : {}),
        decidedById: user.id,
        decidedAt: new Date(),
      })
      // Thêm một kiến thức vào khung là sửa xương sống bằng chứng — phải biết ai đã thêm.
      await writeAudit({
        action: 'authoring.proposal.accept',
        actorUserId: user.id,
        targetType: 'competency',
        targetId: r.slug,
        metadata: { fromTrace: r.traceId, title: r.title },
      })
      return ok(c, r)
    },
  )
  // BYTES tài liệu nguồn cho viewer (mở đúng trang, tô đúng dòng). Staff-gated.
  .get('/source/:id/file', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const bytes = await getSourceDocumentBytes(c.req.param('id'))
    if (!bytes) throw AppError.notFound('Không có tệp nguồn (hoặc chưa cấu hình SOURCE_DOC_ROOT).')
    c.header('content-type', 'application/pdf')
    c.header('cache-control', 'private, max-age=600')
    return c.body(bytes.buffer as ArrayBuffer)
  })
  .post(
    '/framework/:slug/version',
    authorGuard,
    validate('json', z.object({ release: z.enum(['MAJOR', 'MINOR', 'PATCH']).default('MINOR') })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const v = await createFrameworkVersion(c.req.param('slug'), c.req.valid('json').release)
      if (!v) throw AppError.notFound('Không có framework này.')
      return ok(c, v)
    },
  )
  .post('/framework/version/:id/publish', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const id = c.req.param('id')
    const r = await publishFrameworkVersion(id)
    if (!r) throw AppError.notFound('Không có bản phát hành này.')
    // DẤU VẾT: ai PHÁT HÀNH bản khung nào — bản này bất biến, content/state sẽ ghim vào nó.
    await writeAudit({
      action: 'authoring.framework.publish',
      actorUserId: user.id,
      targetType: 'framework_version',
      targetId: id,
      metadata: { published: r.published, deprecated: r.deprecated },
    })
    return ok(c, r)
  })
  // XUẤT khung ra CASE 1EdTech (một bản version — mặc định mới nhất). Trả gói + report (thứ bị bỏ/mặc định).
  .get('/framework/:slug/export/case', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const data = await loadFrameworkForExport(c.req.param('slug'), c.req.query('version'))
    if (!data) throw AppError.notFound('Không có framework này.')
    const { package: pkg, report } = encodeCase({
      framework: data.framework,
      // knowledge-engine's GraphData types version/weight as optional; the loader always sets them
      // (version: 1, weight from a non-null column), so the data satisfies encode's stricter shape.
      graph: data.graph as unknown as EncodeInput['graph'],
      lastChangeDateTime: new Date().toISOString(),
    })
    return ok(c, { package: pkg, report })
  })
  // NHẬP khung CASE ngoài → BẢN NHÁP (graph OBJECTIVE + report) để NGƯỜI DUYỆT rồi mới /apply (R5).
  // Không tự ghi: nhập thẳng vào đồ thị là bỏ qua bước người kiểm.
  .post('/framework/import/case', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw AppError.badRequest('Body không phải JSON hợp lệ.')
    }
    try {
      return ok(c, decodeCase(body))
    } catch (e) {
      if (e instanceof CaseDecodeError)
        throw AppError.validation(
          e.issues.map((message) => ({ path: 'package', message, code: 'case_invalid' })),
        )
      throw e
    }
  })

  // B) Sinh VỎ KHOÁ (course shell) map vào framework — từ prompt hoặc từ sách PDF. Lưu luôn (DRAFT).
  .post('/course/from-prompt', authorGuard, validate('json', CourseBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')
    return ok(
      c,
      await courseShellFromPrompt({
        brief: b.brief,
        createdBy: user.id,
        locale: b.locale,
        ...(b.frameworkVersionId ? { frameworkVersionId: b.frameworkVersionId } : {}),
        ...(b.frameworkSlug ? { frameworkSlug: b.frameworkSlug } : {}),
        ...(b.stage ? { stage: b.stage } : {}),
        ...(b.strand ? { strand: b.strand } : {}),
      }),
    )
  })
  .post('/course/from-book', authorGuard, validate('json', BookBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')
    return ok(
      c,
      await courseShellFromBook({
        pdf: b.pdf,
        createdBy: user.id,
        locale: b.locale,
        ...(b.frameworkVersionId ? { frameworkVersionId: b.frameworkVersionId } : {}),
        ...(b.frameworkSlug ? { frameworkSlug: b.frameworkSlug } : {}),
        ...(b.stage ? { stage: b.stage } : {}),
        ...(b.strand ? { strand: b.strand } : {}),
      }),
    )
  })
  .get('/course', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await listCourses())
  })
  .get('/course/:slug', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const course = await getCourse(c.req.param('slug'))
    if (!course) throw AppError.notFound('Không có vỏ khoá này.')
    return ok(c, course)
  })
  .patch(
    '/course/:slug',
    authorGuard,
    validate('json', z.object({ status: z.enum(['DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED']) })),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      const okd = await setCourseStatus(c.req.param('slug'), c.req.valid('json').status)
      if (!okd) throw AppError.notFound('Không có vỏ khoá này.')
      // DUYỆT một vỏ khoá là một quyết định của người — cùng hạng với duyệt đồ thị, nên cùng để lại vết.
      await writeAudit({
        action: 'authoring.course.status',
        actorUserId: user.id,
        targetType: 'course',
        targetId: c.req.param('slug'),
        metadata: { status: c.req.valid('json').status },
      })
      return ok(c, { slug: c.req.param('slug'), status: c.req.valid('json').status })
    },
  )
  .delete('/course/:slug', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const slug = c.req.param('slug')
    const r = await deleteCourse(slug)
    if (!r.deleted) throw AppError.notFound('Không có vỏ khoá này.')
    // Xoá nội dung đã soạn mà không ghi ai xoá thì không truy được — và ở đây nó kéo theo cả kế
    // hoạch lẫn thẻ căn cứ, nên số lượng cũng phải nằm trong vết.
    await writeAudit({
      action: 'authoring.course.delete',
      actorUserId: user.id,
      targetType: 'course',
      targetId: slug,
      metadata: { plans: r.plans, documents: r.documents, traces: r.traces },
    })
    return ok(c, { deleted: slug, plans: r.plans, documents: r.documents, traces: r.traces })
  })
  // Pipeline S1→S7: tạo, xem trạng thái, đẩy event (generate/complete/approve/regenerate/…).
  .post('/pipeline', authorGuard, validate('json', z.object({ title: z.string().min(1) })), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await startPipeline(c.req.valid('json').title, user.id))
  })
  .get('/pipeline/:id', authorGuard, async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    return ok(c, await getPipeline(c.req.param('id')))
  })
  .post(
    '/pipeline/:id/step/:stepKey',
    authorGuard,
    validate(
      'json',
      z.object({
        event: z.enum(['generate', 'complete', 'fail', 'approve', 'reject', 'regenerate', 'invalidate']),
      }),
    ),
    async (c) => {
      const user = c.get('user')
      if (!user) throw AppError.unauthorized()
      return ok(c, await driveStep(c.req.param('id'), c.req.param('stepKey'), c.req.valid('json').event))
    },
  )
  .post('/ingest', authorGuard, validate('json', SourceBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const { threshold, ...source } = c.req.valid('json')
    return ok(c, await ingestSource(source as RawSource, threshold !== undefined ? { threshold } : undefined))
  })
  .post('/apply', authorGuard, validate('json', GraphBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')
    const res = await applyAuthoredFramework({
      graph: { nodes: b.nodes, edges: b.edges } as GraphData,
      ...(b.framework ? { framework: b.framework as FrameworkMeta } : {}),
      ...(b.objectives ? { objectives: b.objectives as CompiledObjective[] } : {}),
      ...(b.concepts ? { concepts: b.concepts as CompiledConcept[] } : {}),
      ...(b.source ? { source: b.source } : {}),
      ...(b.merges ? { merges: b.merges as Merge[] } : {}),
    })
    // DẤU VẾT: ai GHI đồ thị năng lực (xương sống bằng chứng) — bao nhiêu node/cạnh, khung nào.
    await writeAudit({
      action: 'authoring.framework.apply',
      actorUserId: user.id,
      targetType: 'framework',
      ...(b.framework ? { targetId: b.framework.slug } : {}),
      metadata: {
        nodes: res.nodes,
        edges: res.edges,
        ...(b.framework ? { framework: b.framework.slug } : {}),
      },
    })
    return ok(c, res)
  })

  /**
   * NGƯỜI DUYỆT CHỐT chỗ máy không phân biệt được hai kiến thức, rồi KIỂM LẠI.
   *
   * Bất biến I1 chặn việc ghi khi hai kiến thức trùng khít mọi trục, và chặn đúng. Nhưng trước
   * route này người duyệt chỉ đọc được lời cảnh báo: nút Ghi tắt, không lối nào đi tiếp — trên một
   * chương trình thật thì trùng trục xảy ra thường xuyên, nên đó là đường cụt, không phải lan can.
   *
   * KHÔNG ghi gì. Trả bản nháp đã chốt + kết quả kiểm lại; người duyệt vẫn phải bấm Ghi.
   */
  .post('/framework/resolve-collisions', authorGuard, validate('json', ResolveCollisionsBody), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    const b = c.req.valid('json')
    return ok(
      c,
      await resolveFrameworkCollisions({
        graph: { nodes: b.nodes, edges: b.edges } as GraphData,
        objectives: (b.objectives ?? []) as CompiledObjective[],
        decisions: b.decisions,
      }),
    )
  })
