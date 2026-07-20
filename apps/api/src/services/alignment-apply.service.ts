/**
 * ÁP quyết định đối chiếu (sau khi NGƯỜI duyệt chốt).
 *
 * Mỗi phán quyết ghi một thứ KHÁC NHAU — và đây là chỗ quyết định xương sống bằng chứng đúng hay sai:
 *   SAME             → KHÔNG tạo KC mới. Objective của khung mới MAPS_TO thẳng vào KC cũ.
 *                      (Đây là toàn bộ mục đích: học theo Cambridge, chứng nhận được theo MOET.)
 *   SUBSET/SUPERSET  → tạo KC MỚI + cạnh PREREQUISITE (hẹp → rộng). KHÔNG gộp.
 *                      "count within 20" ⊂ "count within 100" là hai KC có thứ tự, không phải một.
 *   OVERLAP          → tạo KC MỚI + cạnh ALIGNS (ngang, không nằm trong DAG tiên quyết).
 *   NEW              → mint KC mới, không cạnh gì.
 *
 * Gộp sai = mastery lan sang kiến thức chưa học, vĩnh viễn, KHÔNG có tín hiệu báo lỗi. Nên chỉ NGƯỜI
 * mới được chốt SAME — service này chỉ THI HÀNH, không tự phán.
 */

import { db, type Prisma } from '@bingoo/db'
import type { AlignVerdict } from '@bingoo/authoring'
import type { Facets } from '@bingoo/facets'
import { AppError } from '../lib/errors'
import { indexKcEmbeddings } from '../repos/competency-embedding.repo'
import { invalidateGraphCache } from './knowledge.service'

export interface AlignDecisionInput {
  /** Khái niệm mới (từ khung #2). */
  readonly title: Record<string, string>
  readonly slug: string
  readonly kind: string
  readonly subject?: string
  readonly facets?: Facets
  /** Quyết định CUỐI CÙNG của người duyệt. */
  readonly verdict: AlignVerdict
  /** KC đã có được đối chiếu (bắt buộc trừ NEW). */
  readonly target?: string
  /** MÁY đã đề xuất gì (để đối chiếu với quyết định của người → đo được máy sai bao nhiêu). */
  readonly proposedVerdict?: AlignVerdict
  readonly proposedBy?: string
  readonly proposedReason?: string
}

export interface AlignApplyResult {
  readonly reused: number // SAME → dùng lại KC cũ, không đẻ node
  readonly created: number // KC mới được mint
  readonly prerequisite: number // cạnh SUBSET/SUPERSET
  readonly aligns: number // cạnh OVERLAP
}

/**
 * Ghi LỊCH SỬ trước khi thi hành. Append-only, không bao giờ sửa/xoá.
 *
 * Gộp (SAME) là thao tác VĨNH VIỄN và KHÔNG suy ngược được từ đồ thị: sau khi gộp, khái niệm của
 * khung mới đơn giản là không tồn tại — nên câu hỏi "vì sao hai thứ này là một?" và "ai chốt?" biến
 * mất cùng nó. Đây là bảng duy nhất trả lời được, và cũng là dữ liệu để biết máy đề xuất sai chỗ nào.
 */
async function recordDecision(d: AlignDecisionInput, decidedById?: string): Promise<void> {
  await db.alignmentDecision.create({
    data: {
      sourceSlug: d.slug,
      sourceTitle: d.title as Prisma.InputJsonValue,
      verdict: d.verdict,
      overridden: d.proposedVerdict !== undefined && d.proposedVerdict !== d.verdict,
      ...(d.subject ? { subject: d.subject } : {}),
      ...(d.facets ? { facets: d.facets as Prisma.InputJsonValue } : {}),
      ...(d.target ? { targetSlug: d.target } : {}),
      ...(d.proposedVerdict ? { proposedVerdict: d.proposedVerdict } : {}),
      ...(d.proposedBy ? { proposedBy: d.proposedBy } : {}),
      ...(d.proposedReason ? { proposedReason: d.proposedReason } : {}),
      ...(decidedById ? { decidedById } : {}),
    },
  })
}

export async function applyAlignDecisions(
  decisions: readonly AlignDecisionInput[],
  decidedById?: string,
): Promise<AlignApplyResult> {
  let reused = 0
  let created = 0
  let prerequisite = 0
  let aligns = 0

  for (const d of decisions) {
    // SAME → KHÔNG tạo gì. KC cũ được tái dùng; objective khung mới sẽ MAPS_TO vào nó.
    if (d.verdict === 'SAME') {
      if (!d.target) {
        throw AppError.validation([
          {
            path: 'target',
            message: `"${d.slug}" chốt SAME nhưng không chỉ ra KC đích.`,
            code: 'same_without_target',
          },
        ])
      }
      await recordDecision(d, decidedById)
      reused++
      continue
    }

    if (d.verdict === 'UNKNOWN') {
      throw AppError.validation([
        {
          path: 'verdict',
          message: `"${d.slug}" vẫn là UNKNOWN — người duyệt phải chốt trước khi ghi.`,
          code: 'undecided',
        },
      ])
    }

    await recordDecision(d, decidedById)

    // Còn lại đều TẠO KC MỚI (không gộp) — an toàn cho xương sống bằng chứng.
    const node = await db.competency.upsert({
      where: { slug: d.slug },
      create: {
        slug: d.slug,
        kind: d.kind as never,
        title: d.title as Prisma.InputJsonValue,
        ...(d.subject ? { subject: d.subject } : {}),
        ...(d.facets ? { facets: d.facets as Prisma.InputJsonValue } : {}),
      },
      update: {
        kind: d.kind as never,
        title: d.title as Prisma.InputJsonValue,
        ...(d.subject ? { subject: d.subject } : {}),
        ...(d.facets ? { facets: d.facets as Prisma.InputJsonValue } : {}),
      },
      select: { id: true },
    })
    created++

    if (d.verdict === 'NEW' || !d.target) continue

    const target = await db.competency.findUnique({
      where: { slug: d.target },
      select: { id: true },
    })
    if (!target) continue

    if (d.verdict === 'SUBSET' || d.verdict === 'SUPERSET') {
      // HẸP là tiên quyết của RỘNG. SUBSET: cái mới hẹp hơn → mới → cũ.
      const [fromId, toId] = d.verdict === 'SUBSET' ? [node.id, target.id] : [target.id, node.id]
      await db.capabilityRelation.upsert({
        where: { fromId_toId_relType: { fromId, toId, relType: 'PREREQUISITE' } },
        create: { fromId, toId, relType: 'PREREQUISITE', mode: 'REQUIRED' },
        update: { mode: 'REQUIRED' },
      })
      prerequisite++
      continue
    }

    if (d.verdict === 'OVERLAP') {
      // Quan hệ NGANG — không nằm trong DAG tiên quyết, nên không gây chu trình.
      await db.capabilityRelation.upsert({
        where: { fromId_toId_relType: { fromId: node.id, toId: target.id, relType: 'ALIGNS' } },
        create: { fromId: node.id, toId: target.id, relType: 'ALIGNS', mode: 'RECOMMENDED' },
        update: { mode: 'RECOMMENDED' },
      })
      aligns++
    }
  }

  // Nhúng KC mới vào chỉ mục ngữ nghĩa để lần đối chiếu SAU còn truy hồi được chúng.
  // Không nhúng được (thiếu nhà cung cấp, hết quota…) thì KHÔNG chặn việc ghi: đồ thị vẫn đúng,
  // chỉ là lần sau tìm ứng viên kém hơn. Đây là tiện ích, không phải bất biến.
  try {
    const fresh = decisions.filter((d) => d.verdict !== 'SAME' && d.verdict !== 'UNKNOWN')
    await indexKcEmbeddings(
      fresh.map((d) => ({
        slug: d.slug,
        title: d.title['en'] ?? Object.values(d.title)[0] ?? d.slug,
        ...(d.facets?.object ? { object: d.facets.object } : {}),
      })),
    )
  } catch {
    // im lặng — xem chú thích trên
  }

  invalidateGraphCache()
  return { reused, created, prerequisite, aligns }
}

export interface AlignHistoryRow {
  readonly id: string
  readonly sourceSlug: string
  readonly sourceTitle: Record<string, string>
  readonly targetSlug: string | null
  readonly verdict: string
  readonly proposedVerdict: string | null
  readonly proposedBy: string | null
  readonly proposedReason: string | null
  readonly overridden: boolean
  readonly decidedBy: string | null
  readonly createdAt: string
}

/** Lịch sử đối chiếu, mới nhất trước. `overridden` = chỗ người duyệt SỬA khác máy → xem lại facets/prompt. */
export async function listAlignHistory(limit = 100): Promise<readonly AlignHistoryRow[]> {
  const rows = await db.alignmentDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 500),
    include: { decidedBy: { select: { name: true, email: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    sourceSlug: r.sourceSlug,
    sourceTitle: (r.sourceTitle ?? {}) as Record<string, string>,
    targetSlug: r.targetSlug,
    verdict: r.verdict,
    proposedVerdict: r.proposedVerdict,
    proposedBy: r.proposedBy,
    proposedReason: r.proposedReason,
    overridden: r.overridden,
    decidedBy: r.decidedBy?.name ?? r.decidedBy?.email ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}
