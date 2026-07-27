// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Request schema for the authoring `/apply` route, kept in its own file so it can be unit-tested
 * without importing the whole route module (which pulls in services, providers and the db).
 *
 * A node carries `stage`, `strand`, `subject` and `facets` on purpose. `facets` IS the identity of
 * a knowledge component — it is what makes "add within 20" a different concept from "add within
 * 100" — and `stage` is what scopes a course to a curriculum stage. `persistGraph` writes all
 * four and `checkInvariants` reads them (I1 identity, I2 stage-only-on-objective, I8 required
 * facets), so if the transport schema drops them the graph is written without the very fields its
 * invariants exist to guard, and no error is ever raised. Facets are held loosely (an opaque
 * object): their validity is enforced at the invariant layer, not on the wire.
 */
import { z } from 'zod'

const KINDS = [
  'OBJECTIVE',
  'OUTCOME',
  'SKILL',
  'KNOWLEDGE',
  'PROCEDURE',
  'BEHAVIOR',
  'ATTITUDE',
  'DISPOSITION',
] as const
const RELS = ['PREREQUISITE', 'ENABLES', 'COMPOSES', 'ALIGNS', 'VARIANT_OF', 'MAPS_TO'] as const
const MODES = ['REQUIRED', 'RECOMMENDED'] as const

/**
 * CÂU NGUỒN đã kiểm.
 *
 * Trước đây trường này không có trong schema, nên nó bị cắt IM LẶNG ngay tại đây: pipeline đối chiếu
 * câu trích vào tài liệu, đánh dấu đã kiểm, rồi bằng chứng chết trên đường dây. Đó là lý do nhãn
 * "có căn cứ" chỉ từng xuất hiện trên dữ liệu seed — dữ liệu đi qua giao diện không bao giờ mang
 * được căn cứ tới server.
 */
const EvidenceBody = z.array(
  z.object({
    chunkId: z.string().min(1),
    quote: z.string().min(1),
    verified: z.boolean().optional(),
    charStart: z.number().int().optional(),
    charEnd: z.number().int().optional(),
  }),
)

export const GraphBody = z.object({
  nodes: z
    .array(
      z.object({
        slug: z.string().min(1),
        title: z.record(z.string(), z.string()),
        kind: z.enum(KINDS),
        parent: z.string().optional(),
        level: z.number().int().optional(),
        // Identity/scoping fields — must survive to persistGraph + checkInvariants (see file header).
        stage: z.string().max(128).optional(),
        strand: z.string().max(128).optional(),
        subject: z.string().max(64).optional(),
        facets: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
  edges: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      mode: z.enum(MODES),
      relType: z.enum(RELS).optional(),
      weight: z.number().optional(),
    }),
  ),
  // Tuỳ chọn: bền hoá Framework + objectives + MAPS_TO cùng lúc.
  framework: z
    .object({
      slug: z.string().min(1),
      name: z.record(z.string(), z.string()),
      kind: z.enum(['CURRICULUM', 'CREDENTIAL', 'JOB_PROFILE']),
      locale: z.string().min(1),
    })
    .optional(),
  objectives: z
    .array(
      z.object({
        slug: z.string().min(1),
        title: z.record(z.string(), z.string()),
        code: z.string().optional(),
        mapsTo: z.array(z.string()).default([]),
        evidence: EvidenceBody.optional(),
      }),
    )
    .optional(),
  /**
   * Bằng chứng nguồn của từng KIẾN THỨC — đi song song với `nodes`, không nằm trong đó.
   *
   * Hợp đồng đồ thị không có chỗ cho bằng chứng (engine không đọc nó), nên nhồi vào `nodes` là làm
   * bẩn một hợp đồng đang sạch. Danh sách riêng, khoá theo slug.
   */
  concepts: z
    .array(
      z.object({
        slug: z.string().min(1),
        title: z.record(z.string(), z.string()),
        kind: z.enum(KINDS),
        facets: z.record(z.string(), z.unknown()).optional(),
        evidence: EvidenceBody.default([]),
        confidence: z.number().optional(),
      }),
    )
    .optional(),
  /**
   * Đoạn nguồn để ĐỐI CHIẾU LẠI câu trích lúc ghi.
   *
   * Không tin cờ `verified` gửi từ trình duyệt: nó đi qua chỗ mà bất cứ ai cũng sửa được. Ghi thẻ
   * phải kiểm lại vào chính đoạn văn bản SẼ ĐƯỢC LƯU cùng thẻ, nếu không thì "đã kiểm" chỉ là một
   * ô tích mà không ai kiểm.
   */
  source: z.object({ text: z.string().min(1), storageKey: z.string().max(512).optional() }).optional(),
  /**
   * Những chỗ máy TỰ GỘP hai khái niệm làm một.
   *
   * Quyết định nặng nhất máy được phép tự làm, và trước đây nó không đi qua đường dây này nên xảy
   * ra hoàn toàn im lặng. Có ở đây thì mỗi lần gộp để lại một thẻ người duyệt lật lại được.
   */
  merges: z
    .array(
      z.object({
        tempId: z.string().min(1),
        into: z.string().min(1),
        reason: z.enum(['existing', 'within-batch']),
        similarity: z.number(),
        fromTitle: z.string(),
        intoTitle: z.string(),
      }),
    )
    .optional(),
})
export type GraphBody = z.infer<typeof GraphBody>

/**
 * Quyết định của NGƯỜI DUYỆT khi máy không phân biệt được hai kiến thức (I1).
 *
 * Đúng hai lối mà chính bất biến nêu: gộp làm một, hoặc nói ra trục làm chúng khác nhau. `scope`
 * KHÔNG có trong danh sách trục — nó là dữ liệu cấu trúc ({max:100}), sửa bằng một chuỗi gõ tay là
 * mở đường cho phạm vi rác đi thẳng vào chỗ suy ra thứ tự học.
 */
const DISTINGUISH_AXES = ['object', 'channel', 'representation', 'bloom', 'transfer', 'fluency'] as const

export const CollisionDecisionBody = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('merge'),
    keep: z.string().min(1),
    drop: z.string().min(1),
  }),
  z.object({
    kind: z.literal('distinguish'),
    slug: z.string().min(1),
    axis: z.enum(DISTINGUISH_AXES),
    value: z.string().min(1).max(64),
  }),
  // Gỡ một mắt của chuỗi quay vòng — máy thấy vòng nhưng không biết mắt nào sai.
  z.object({
    kind: z.literal('drop-edge'),
    from: z.string().min(1),
    to: z.string().min(1),
    relType: z.string().max(32).optional(),
  }),
  // Loại một mục không phải kiến thức dạy được. Lý do BẮT BUỘC: bỏ mà không ghi lại thì
  // "vì sao khung không có cái này" mất luôn câu trả lời.
  z.object({
    kind: z.literal('drop-concept'),
    slug: z.string().min(1),
    reason: z.string().min(1).max(280),
  }),
])

/**
 * Bản nháp + quyết định. Bản nháp đi vòng qua trình duyệt nên phải khai lại đủ — nhưng KIỂM LẠI thì
 * ở server, vì bất biến cần hồ sơ môn và đồ thị đang có, hai thứ trình duyệt không có.
 */
export const ResolveCollisionsBody = z.object({
  nodes: GraphBody.shape.nodes,
  edges: GraphBody.shape.edges,
  objectives: GraphBody.shape.objectives,
  decisions: z.array(CollisionDecisionBody).max(200),
})
export type ResolveCollisionsBody = z.infer<typeof ResolveCollisionsBody>
