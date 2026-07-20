/**
 * Chỉ mục NGỮ NGHĨA của KC — dùng để TRUY HỒI ứng viên đối chiếu, và CHỈ để truy hồi.
 *
 * RANH GIỚI NÀY LÀ CỐT TỬ, đọc kỹ trước khi mở rộng:
 *   • Embedding trả lời "cái gì GIỐNG cái này" — câu hỏi mờ, có thang độ, không có ngưỡng nào đúng.
 *   • "Hai cái này có phải MỘT KC không" là câu hỏi NHỊ PHÂN, và nó quyết định vĩnh viễn xương sống
 *     bằng chứng học tập. Nó được trả lời bằng CẤU TRÚC (facets) + NGƯỜI DUYỆT.
 * Lấy cosine ra quyết định gộp chính là cái bẫy đã đẻ ra toàn bộ lớp bug định danh. Ở đây embedding
 * làm đúng một việc: khi `object` chưa từng thấy và trigram bó tay (khác ngôn ngữ, khác cách diễn
 * đạt), nó tìm ra ứng viên để ĐEM ĐI SO CẤU TRÚC.
 *
 * Cột `embedding` là pgvector (Prisma không hiểu) → ghi scalar bằng client, set vector bằng raw SQL,
 * đúng như media_embedding.
 */

import { db, Prisma } from '@bingoo.ai/db'
import { createHash } from 'node:crypto'
import { getEmbedding } from '../providers'

/** Băm văn bản đã nhúng — không đổi thì không nhúng lại (embedding tốn tiền theo lượt gọi). */
const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 32)

/**
 * Văn bản đem đi nhúng: TIÊU ĐỀ TIẾNG ANH + đối tượng tri thức.
 * Tiếng Anh là bản gốc, nên "Phép cộng trong phạm vi 20" và "Add within 20" cùng nhúng về một chỗ.
 */
const embedText = (title: string, object?: string): string => (object ? `${title} — ${object}` : title)

export interface IndexKcInput {
  readonly slug: string
  readonly title: string
  readonly object?: string
}

/** Nhúng + lưu vector cho các KC. Bỏ qua cái đã nhúng đúng nội dung đó rồi. Lỗi → BỎ QUA, không chặn. */
export async function indexKcEmbeddings(items: readonly IndexKcInput[]): Promise<number> {
  if (items.length === 0) return 0

  const port = getEmbedding()
  const rows = await db.competency.findMany({
    where: { slug: { in: items.map((i) => i.slug) } },
    select: { id: true, slug: true },
  })
  const idBySlug = new Map(rows.map((r) => [r.slug, r.id]))

  const model = 'default'
  const pending: { id: string; text: string; hash: string }[] = []
  for (const it of items) {
    const id = idBySlug.get(it.slug)
    if (!id) continue
    const text = embedText(it.title, it.object)
    const h = hash(text)
    const existing = await db.competencyEmbedding.findUnique({
      where: { competencyId_model: { competencyId: id, model } },
      select: { contentHash: true },
    })
    if (existing?.contentHash === h) continue // không đổi → không tốn tiền nhúng lại
    pending.push({ id, text, hash: h })
  }
  if (pending.length === 0) return 0

  const res = await port.embed({ texts: pending.map((p) => p.text) })
  let n = 0
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]
    const vec = res.vectors[i]
    if (!p || !vec) continue
    const row = await db.competencyEmbedding.upsert({
      where: { competencyId_model: { competencyId: p.id, model } },
      create: { competencyId: p.id, model, dim: res.dim, contentHash: p.hash },
      update: { dim: res.dim, contentHash: p.hash },
      select: { id: true },
    })
    await db.$executeRaw(
      Prisma.sql`UPDATE "competency_embedding" SET "embedding" = ${`[${vec.join(',')}]`}::vector, "updatedAt" = now() WHERE "id" = ${row.id}`,
    )
    n++
  }
  return n
}

export interface NearestKc {
  readonly slug: string
  readonly score: number
}

/**
 * K ứng viên gần nhất về NGỮ NGHĨA. Trả về ỨNG VIÊN, không trả về phán quyết —
 * `score` chỉ để xếp thứ tự, KHÔNG được đem so với bất kỳ ngưỡng nào để kết luận "là một".
 */
export async function nearestKcs(
  text: string,
  opts: { subject?: string; k?: number } = {},
): Promise<readonly NearestKc[]> {
  const port = getEmbedding()
  const res = await port.embed({ texts: [text] })
  const vec = res.vectors[0]
  if (!vec) return []

  const lit = `[${vec.join(',')}]`
  const k = opts.k ?? 5
  const where = opts.subject
    ? Prisma.sql`c."subject" = ${opts.subject} AND c."kind" <> 'OBJECTIVE'`
    : Prisma.sql`c."kind" <> 'OBJECTIVE'`

  return db.$queryRaw<NearestKc[]>(Prisma.sql`
    SELECT c."slug" AS slug,
           (1 - (e."embedding" <=> ${lit}::vector))::float8 AS score
    FROM "competency_embedding" e
    JOIN "competency" c ON c."id" = e."competencyId"
    WHERE e."embedding" IS NOT NULL AND ${where}
    ORDER BY e."embedding" <=> ${lit}::vector ASC
    LIMIT ${k}
  `)
}
