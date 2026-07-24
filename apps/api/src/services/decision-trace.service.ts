// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * GHI THẺ TRUY NGUỒN cho các quyết định của AI — node của đồ thị truy-ngược (C1 schema).
 *
 * Phần THUẦN ở đây (`buildObjectiveTrace`) không đụng DB: nó biến một mục tiêu đã compile thành
 * payload thẻ + bằng chứng, và LÀ NƠI quyết định làn nào được bật:
 *   • SOURCE_SPAN  — câu trích, ĐƯỢC KIỂM LẠI byte-for-byte vào chính đoạn nguồn sẽ LƯU (không tin
 *                    cờ verified mang từ xa tới); khớp → basis FROM_SOURCE, không → AI_INFERRED.
 *   • STRUCTURAL_CHECK — I5 phủ (mục tiêu MAPS_TO ≥1 KC), ĐÓNG BĂNG kết quả lúc này để sau đối chiếu.
 *
 * "Tìm thấy chuỗi" ≠ "câu này chứng minh mục tiêu": basis chỉ nói câu CÓ trong tài liệu, người
 * duyệt mới xác nhận nó có đúng là căn cứ (R5). Mục tiêu KHÔNG có câu trích (đường sinh-từ-chủ-đề)
 * là AI_INFERRED trung thực — làn nguồn để TRỐNG (UI hiện dòng xám "không trích từ tài liệu nào"),
 * KHÔNG phải "kiểm hụt".
 */

import { normalizeSource, verifyQuote, type CompiledObjective, type Merge } from '@bingoo.ai/authoring'
import { db, type Prisma } from '@bingoo.ai/db'

export type EvidenceBasis = 'FROM_SOURCE' | 'STRUCTURAL' | 'AI_INFERRED'

export interface TraceEvidenceInput {
  readonly kind: 'SOURCE_SPAN' | 'STRUCTURAL_CHECK'
  readonly basis: EvidenceBasis
  readonly method: string
  readonly quote?: string
  readonly chunkId?: string
  readonly quoteVerified?: boolean
  readonly charStart?: number
  readonly charEnd?: number
  readonly checkCode?: string
  readonly passed?: boolean
  readonly detail?: Readonly<Record<string, unknown>>
}

export interface TraceRecordInput {
  readonly artifact: 'OBJECTIVE_EXISTS'
  readonly subjectSlug: string
  readonly claim: { readonly vi: string; readonly en: string }
  readonly method: 'LLM'
  readonly basis: EvidenceBasis
  readonly checksPassed: readonly string[]
  readonly checksFailed: readonly string[]
  readonly evidence: readonly TraceEvidenceInput[]
}

const CHECK_COVERAGE = 'coverage:nonempty'

/**
 * Dựng thẻ OBJECTIVE_EXISTS cho một mục tiêu, đối chiếu câu trích vào `excerpt` (đoạn nguồn ĐÃ
 * chuẩn hoá sẽ được LƯU cùng — offset trả về khớp với nó). Thuần, không I/O.
 */
export function buildObjectiveTrace(o: CompiledObjective, excerpt: string): TraceRecordInput {
  const evidence: TraceEvidenceInput[] = []

  // SOURCE_SPAN — KIỂM LẠI vào chính đoạn sẽ lưu, không tin cờ verified mang từ lúc trích.
  const quote = o.evidence?.[0]?.quote
  let grounded = false
  if (quote !== undefined) {
    const m = verifyQuote(quote, excerpt)
    grounded = m.status === 'verified'
    const chunkId = o.evidence?.[0]?.chunkId
    evidence.push({
      kind: 'SOURCE_SPAN',
      basis: grounded ? 'FROM_SOURCE' : 'AI_INFERRED',
      method: 'quote',
      quote,
      ...(chunkId !== undefined ? { chunkId } : {}),
      quoteVerified: grounded,
      ...(m.charStart !== undefined ? { charStart: m.charStart, charEnd: m.charEnd } : {}),
    })
  }

  // STRUCTURAL_CHECK — I5 phủ: mục tiêu chứng nhận bởi ≥1 KC. Xác định, đóng băng lúc này.
  const covered = o.mapsTo.length >= 1
  evidence.push({
    kind: 'STRUCTURAL_CHECK',
    basis: 'STRUCTURAL',
    method: 'invariant:I5',
    checkCode: CHECK_COVERAGE,
    passed: covered,
    detail: { mapsTo: [...o.mapsTo] },
  })

  const titleVi = o.title.vi ?? o.title.en ?? o.slug
  const titleEn = o.title.en ?? o.title.vi ?? o.slug
  return {
    artifact: 'OBJECTIVE_EXISTS',
    subjectSlug: o.slug,
    claim: {
      vi: `"${titleVi}" là một mục tiêu học tập của khung này.`,
      en: `"${titleEn}" is a learning objective of this framework.`,
    },
    method: 'LLM',
    // basis của THẺ phản ánh làn mạnh nhất: có nguồn kiểm được → FROM_SOURCE, không → AI_INFERRED.
    // (Kiểm cấu trúc luôn có, nhưng nó chứng "đủ ≥1 KC", không chứng "vì sao có mục tiêu này".)
    basis: grounded ? 'FROM_SOURCE' : 'AI_INFERRED',
    checksPassed: covered ? [CHECK_COVERAGE] : [],
    checksFailed: covered ? [] : [CHECK_COVERAGE],
    evidence,
  }
}

/** Chuẩn hoá đoạn nguồn trước khi lưu (offset của thẻ khớp với chuỗi này). Re-export cho seed/writer. */
export { normalizeSource }

// ─────────────────────────────────────────────────────────────────────────────
// GHI (server-side) — seed/công cụ gọi TRỰC TIẾP. KHÔNG nối vào /apply: đường duyệt
// giữ nguyên như cũ (yêu cầu phản biện), tránh plumb evidence qua round-trip client.
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteTraceResult {
  readonly records: number
  readonly sourceDocumentId: string
}

/**
 * Ghi thẻ OBJECTIVE_EXISTS cho một BỘ mục tiêu vừa persist, đối chiếu vào `sourceText`.
 * IDEMPOTENT theo frameworkVersionId: xoá thẻ + nguồn cũ của đúng bản này rồi ghi lại (seed chạy
 * nhiều lần vẫn sạch — evidence cascade theo FK).
 */
export async function writeObjectiveTraces(
  frameworkVersionId: string,
  objectives: readonly CompiledObjective[],
  sourceText: string,
): Promise<WriteTraceResult> {
  const excerpt = normalizeSource(sourceText)
  const slugs = objectives.map((o) => o.slug)

  await db.decisionRecord.deleteMany({
    where: { artifact: 'OBJECTIVE_EXISTS', frameworkVersionId, subjectSlug: { in: slugs } },
  })
  await db.sourceDocument.deleteMany({ where: { frameworkVersionId } })

  const source = await db.sourceDocument.create({
    data: { frameworkVersionId, excerptText: excerpt },
  })

  for (const o of objectives) {
    const t = buildObjectiveTrace(o, excerpt)
    await db.decisionRecord.create({
      data: {
        artifact: t.artifact,
        subjectSlug: t.subjectSlug,
        claim: t.claim as unknown as Prisma.InputJsonValue,
        method: t.method,
        basis: t.basis,
        checksPassed: [...t.checksPassed],
        checksFailed: [...t.checksFailed],
        frameworkVersionId,
        sourceDocumentId: source.id,
        evidence: {
          create: t.evidence.map((e) => ({
            kind: e.kind,
            basis: e.basis,
            method: e.method,
            ...(e.quote !== undefined ? { quote: e.quote } : {}),
            ...(e.chunkId !== undefined ? { chunkId: e.chunkId } : {}),
            ...(e.quoteVerified !== undefined ? { quoteVerified: e.quoteVerified } : {}),
            ...(e.charStart !== undefined ? { charStart: e.charStart } : {}),
            ...(e.charEnd !== undefined ? { charEnd: e.charEnd } : {}),
            ...(e.checkCode !== undefined ? { checkCode: e.checkCode } : {}),
            ...(e.passed !== undefined ? { passed: e.passed } : {}),
            ...(e.detail !== undefined ? { detail: e.detail as unknown as Prisma.InputJsonValue } : {}),
          })),
        },
      },
    })
  }
  return { records: objectives.length, sourceDocumentId: source.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐÓNG ĐIỂM MÙ TRIGRAM — dedupeConcepts tự gộp hai khái niệm khi tên GẦN GIỐNG (ngưỡng 0.72),
// KHÔNG người, KHÔNG cấu trúc, và trước đây KHÔNG để lại vết. Một walk "sao hai cái này là một?"
// rơi vào hư không. Nay mỗi lần gộp phát một thẻ CONCEPT_IDENTITY — gắn rõ TRIGRAM/AI_INFERRED,
// verdict PENDING (chờ người duyệt). KHÔNG có bằng chứng cấu trúc: đó chính là điểm cần cảnh báo.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConceptIdentityTraceInput {
  readonly artifact: 'CONCEPT_IDENTITY'
  readonly subjectSlug: string
  readonly claim: { readonly vi: string; readonly en: string }
  readonly reason: { readonly vi: string; readonly en: string }
  readonly method: 'TRIGRAM'
  readonly basis: 'AI_INFERRED'
}

export function buildConceptIdentityTrace(m: Merge): ConceptIdentityTraceInput {
  const pct = Math.round(m.similarity * 100)
  return {
    artifact: 'CONCEPT_IDENTITY',
    // Gắn vào KC SỐNG SÓT: hỏi "cái gì đã gộp vào đây?" thì tra theo slug này.
    subjectSlug: m.into,
    claim: {
      vi: `"${m.fromTitle}" được coi là CÙNG một kiến thức với "${m.intoTitle}".`,
      en: `"${m.fromTitle}" is treated as the SAME knowledge as "${m.intoTitle}".`,
    },
    reason: {
      vi: `Máy tự gộp vì hai tên GẦN GIỐNG nhau (giống ${pct}%) — KHÔNG phải kết luận cấu trúc, cần thầy/cô xác nhận đúng là một.`,
      en: `Auto-merged because the two names are NEARLY identical (${pct}% similar) — not a structural finding; a reviewer should confirm they really are one.`,
    },
    method: 'TRIGRAM',
    basis: 'AI_INFERRED',
  }
}

/**
 * Ghi thẻ CONCEPT_IDENTITY cho MỌI lần gộp trigram của một bản phát hành. Idempotent theo
 * frameworkVersionId. Không có evidence row (trigram không sinh SOURCE_SPAN/STRUCTURAL_CHECK) —
 * độ giống nằm trong `reason`; verdict để PENDING vì đây là thứ cần người duyệt nhất.
 */
export async function writeConceptIdentityTraces(
  frameworkVersionId: string,
  merges: readonly Merge[],
): Promise<number> {
  await db.decisionRecord.deleteMany({ where: { artifact: 'CONCEPT_IDENTITY', frameworkVersionId } })
  for (const m of merges) {
    const t = buildConceptIdentityTrace(m)
    await db.decisionRecord.create({
      data: {
        artifact: t.artifact,
        subjectSlug: t.subjectSlug,
        claim: t.claim as unknown as Prisma.InputJsonValue,
        reason: t.reason as unknown as Prisma.InputJsonValue,
        method: t.method,
        basis: t.basis,
        frameworkVersionId,
      },
    })
  }
  return merges.length
}

// ─────────────────────────────────────────────────────────────────────────────
// ĐỌC — trả về cho panel truy ngược. KIỂM LẠI SỐNG rồi ĐỐI CHIẾU bản đóng băng:
// nếu khác (đồ thị đã đổi sau lần duyệt) thì `drift=true` → UI hiện "cần duyệt lại"
// (đúng R5, cùng lớp vấn đề re-review nội dung ở commit cd717f7). KHÔNG âm thầm
// thay số cũ bằng số mới, cũng KHÔNG chỉ phát lại số cũ.
// ─────────────────────────────────────────────────────────────────────────────

export interface TraceSourceLane {
  readonly quote: string
  readonly chunkId?: string
  readonly excerpt: string
  readonly charStart?: number
  readonly charEnd?: number
  readonly verifiedAtWrite: boolean
  readonly verifiedNow: boolean
}

export interface TraceStructuralLane {
  readonly checkCode: string
  readonly passedAtWrite: boolean
  readonly passedNow: boolean
  readonly detail?: unknown
}

export interface ObjectiveTraceView {
  readonly slug: string
  readonly claim: unknown
  readonly basis: EvidenceBasis
  readonly verdict: string
  readonly overridden: boolean
  readonly decidedAt: string | null
  readonly source: TraceSourceLane | null
  readonly structural: readonly TraceStructuralLane[]
  /** Bất kỳ làn nào kiểm-lại-hôm-nay khác bản đóng băng → cần duyệt lại. */
  readonly drift: boolean
}

// I5 SỐNG: mục tiêu (theo slug) hiện có MAPS_TO ≥1 KC không.
async function objectiveCoveredNow(slug: string): Promise<boolean> {
  const obj = await db.competency.findUnique({ where: { slug }, select: { id: true } })
  if (!obj) return false
  const n = await db.capabilityRelation.count({ where: { fromId: obj.id, relType: 'MAPS_TO' } })
  return n >= 1
}

export async function getObjectiveTrace(slug: string): Promise<ObjectiveTraceView | null> {
  const rec = await db.decisionRecord.findFirst({
    where: { artifact: 'OBJECTIVE_EXISTS', subjectSlug: slug },
    orderBy: { createdAt: 'desc' },
    include: { evidence: true },
  })
  if (!rec) return null

  const doc = rec.sourceDocumentId
    ? await db.sourceDocument.findUnique({ where: { id: rec.sourceDocumentId } })
    : null

  // Làn NGUỒN — kiểm lại byte-for-byte vào chính đoạn đã lưu.
  const span = rec.evidence.find((e) => e.kind === 'SOURCE_SPAN')
  let source: TraceSourceLane | null = null
  if (span?.quote !== undefined && span.quote !== null && doc) {
    const m = verifyQuote(span.quote, doc.excerptText)
    source = {
      quote: span.quote,
      ...(span.chunkId ? { chunkId: span.chunkId } : {}),
      excerpt: doc.excerptText,
      ...(span.charStart != null ? { charStart: span.charStart } : {}),
      ...(span.charEnd != null ? { charEnd: span.charEnd } : {}),
      verifiedAtWrite: span.quoteVerified ?? false,
      verifiedNow: m.status === 'verified',
    }
  }

  // Làn CẤU TRÚC — tính lại I5 sống, đối chiếu bản đóng băng.
  const liveCovered = await objectiveCoveredNow(slug)
  const structural: TraceStructuralLane[] = rec.evidence
    .filter((e) => e.kind === 'STRUCTURAL_CHECK')
    .map((e) => ({
      checkCode: e.checkCode ?? '',
      passedAtWrite: e.passed ?? false,
      passedNow: e.checkCode === 'coverage:nonempty' ? liveCovered : (e.passed ?? false),
      ...(e.detail != null ? { detail: e.detail } : {}),
    }))

  const drift =
    (source !== null && source.verifiedNow !== source.verifiedAtWrite) ||
    structural.some((s) => s.passedNow !== s.passedAtWrite)

  return {
    slug,
    claim: rec.claim,
    basis: rec.basis as EvidenceBasis,
    verdict: rec.verdict,
    overridden: rec.overridden,
    decidedAt: rec.decidedAt ? rec.decidedAt.toISOString() : null,
    source,
    structural,
    drift,
  }
}
