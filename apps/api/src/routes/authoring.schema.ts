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
