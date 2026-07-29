// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * NHẬN MỘT ĐỀ XUẤT LÀM DÀY — sách dạy thứ khung chưa có, và người duyệt đồng ý đưa nó vào.
 *
 * Đây là chỗ khép vòng: bóc sách phát hiện ra kiến thức ngoài khung, để lại một tấm thẻ, và tấm thẻ
 * đó chờ một người. Không có bước này thì đề xuất chỉ là một dòng chữ đọc cho biết — khung không
 * bao giờ dày lên, và câu "sách dạy thứ khung chưa có" mãi mãi chỉ là một lời than.
 *
 * VÌ SAO NGƯỜI DUYỆT PHẢI KHAI THÊM, chứ máy không tự đúc kiến thức từ nhan đề:
 *
 * Một đề xuất chỉ có nhan đề và câu trích. Kiến thức trong hệ này được phân biệt bằng DẤU HIỆU —
 * nó nói về cái gì, học qua kênh nào, trong phạm vi nào. Đúc một kiến thức chỉ từ nhan đề là tạo ra
 * đúng loại kiến thức không phân biệt được mà quy tắc định danh tồn tại để chặn: hôm nay nó lọt,
 * ngày mai không ai tách nổi nó khỏi cái bên cạnh, và gộp sai thì hỏng vĩnh viễn không báo lỗi.
 *
 * Nên nhận một đề xuất KHÔNG phải là bấm một cái nút. Người duyệt nói ra nó nói về cái gì; máy lo
 * phần còn lại và vẫn bắt nó đi qua đủ cổng bất biến như mọi kiến thức khác.
 */

import { db, type Prisma } from '@bingoo.ai/db'
import { mintSlug } from '@bingoo.ai/authoring'
import type { GraphData, Slug } from '@bingoo.ai/knowledge-engine'
import { applyAuthoredGraph } from './authoring.service'
import { AppError } from '../lib/errors'

export interface AcceptProposalInput {
  readonly traceId: string
  /** NÓ NÓI VỀ CÁI GÌ — dấu hiệu quan trọng nhất; thiếu là máy không tách được nó khỏi cái khác. */
  readonly object: string
  /** Học qua kênh nào (nhận biết / tính / giải thích…). */
  readonly channel: string
  readonly bloom?: string
  readonly subject?: string
  readonly decidedById: string
  readonly decidedAt: Date
}

export interface AcceptProposalResult {
  readonly slug: string
  readonly title: string
  readonly traceId: string
}

export async function acceptProposal(input: AcceptProposalInput): Promise<AcceptProposalResult> {
  const rec = await db.decisionRecord.findUnique({
    where: { id: input.traceId },
    include: { evidence: true },
  })
  if (!rec) throw AppError.notFound('Không có thẻ đề xuất này.')
  if (rec.artifact !== 'KC_PROPOSED') {
    throw AppError.validation([
      { path: 'traceId', message: 'Thẻ này không phải một đề xuất làm dày.', code: 'not_a_proposal' },
    ])
  }
  if (rec.verdict !== 'PENDING') {
    // Nhận hai lần thì lần sau đẻ ra một kiến thức trùng — chặn ở đây, đừng để bất biến bắt sau.
    throw AppError.validation([
      { path: 'traceId', message: 'Đề xuất này đã được chốt rồi.', code: 'already_decided' },
    ])
  }

  // Nhan đề nằm trong câu kết luận của thẻ; lấy bản tiếng Anh vì slug mint từ đó (dùng chung mọi khung).
  const claim = rec.claim as Record<string, string> | null
  const title = extractTitle(claim?.en ?? '') ?? extractTitle(claim?.vi ?? '')
  if (title === undefined) {
    throw AppError.validation([
      { path: 'traceId', message: 'Không đọc được tên kiến thức từ thẻ này.', code: 'no_title' },
    ])
  }

  const taken = new Set((await db.competency.findMany({ select: { slug: true } })).map((r) => r.slug))
  const slug = mintSlug(title, taken)

  // Qua ĐÚNG cổng bất biến như mọi kiến thức khác — không có đường tắt cho thứ đến từ sách.
  const graph: GraphData = {
    nodes: [
      {
        slug: slug as Slug,
        title: { en: title, vi: title },
        kind: 'KNOWLEDGE',
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        facets: {
          object: input.object,
          channel: input.channel,
          ...(input.bloom !== undefined ? { bloom: input.bloom } : {}),
        },
      },
    ],
    edges: [],
  }
  await applyAuthoredGraph(graph)

  /**
   * Kiến thức mới MANG THEO câu trích của sách làm căn cứ.
   *
   * Không có bước này thì nó xuất hiện trong khung như thể từ hư không, và câu "vì sao có kiến thức
   * này" — thứ mọi kiến thức khác trả lời được — với riêng nó là im lặng.
   */
  const span = rec.evidence.find((e) => e.kind === 'SOURCE_SPAN')
  await db.decisionRecord.create({
    data: {
      artifact: 'CONCEPT_EXISTS',
      subjectSlug: slug,
      claim: {
        vi: `"${title}" vào khung từ một cuốn sách, do người duyệt nhận đề xuất.`,
        en: `"${title}" entered the framework from a book, accepted by a reviewer.`,
      } as unknown as Prisma.InputJsonValue,
      method: 'HUMAN',
      basis: span?.quoteVerified === true ? 'FROM_SOURCE' : 'AI_INFERRED',
      verdict: 'CONFIRMED',
      decidedById: input.decidedById,
      decidedAt: input.decidedAt,
      ...(rec.sourceDocumentId ? { sourceDocumentId: rec.sourceDocumentId } : {}),
      ...(span
        ? {
            evidence: {
              create: [
                {
                  kind: 'SOURCE_SPAN',
                  basis: span.basis,
                  method: 'quote',
                  ...(span.quote !== null ? { quote: span.quote } : {}),
                  ...(span.quoteVerified !== null ? { quoteVerified: span.quoteVerified } : {}),
                  ...(span.charStart !== null ? { charStart: span.charStart } : {}),
                  ...(span.charEnd !== null ? { charEnd: span.charEnd } : {}),
                  ...(span.anchorKind !== null ? { anchorKind: span.anchorKind } : {}),
                  ...(span.anchorLocator !== null
                    ? { anchorLocator: span.anchorLocator as Prisma.InputJsonValue }
                    : {}),
                  ...(span.anchorContentHash !== null ? { anchorContentHash: span.anchorContentHash } : {}),
                },
              ],
            },
          }
        : {}),
    },
  })

  // Thẻ đề xuất khép lại: người đã quyết, và quyết bằng cách nhận.
  await db.decisionRecord.update({
    where: { id: rec.id },
    data: {
      verdict: 'CONFIRMED',
      overridden: false,
      decidedById: input.decidedById,
      decidedAt: input.decidedAt,
      decidedNote: `Đã đưa vào khung với tên "${slug}".`,
    },
  })

  return { slug, title, traceId: rec.id }
}

/**
 * Rút tên kiến thức khỏi câu kết luận của thẻ.
 *
 * Câu có dạng: The book teaches "X" — the framework does not list it.
 * Thuần, để kiểm được mà không cần kho.
 */
export function extractTitle(claim: string): string | undefined {
  const m = /["“]([^"”]+)["”]/.exec(claim)
  const t = m?.[1]?.trim()
  return t !== undefined && t.length > 0 ? t : undefined
}
