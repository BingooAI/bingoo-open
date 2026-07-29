// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, uploadToSignedUrl } from './api-client'
import type { MediaAssetDto } from './api-types'
import type { CreateAssetResult } from './media-queries'

/**
 * Authoring — sinh khung năng lực (framework) và vỏ khoá học, bám @bingoo.ai/knowledge-engine.
 * DTO viết tay mirror API (chưa có generated client). API là biên RBAC thật (CONTENT_EDITOR|ADMIN).
 */

// ── DTOs (mirror apps/api/src/routes/authoring.ts) ───────────────────────────
export interface GraphNodeDto {
  slug: string
  title: Record<string, string>
  kind: string
  parent?: string
  level?: number
  subject?: string
  /** 7 trục phân biệt — thứ quyết định hai KC có phải một. Người soạn PHẢI thấy được. */
  facets?: Record<string, unknown>
  /** MẠCH kiến thức — để gom nhóm/thu gọn đồ thị. */
  strand?: string
}
export interface ViolationDto {
  code: string
  severity: string
  message: string
  slugs: string[]
}
export interface GraphEdgeDto {
  from: string
  to: string
  mode: string
  relType?: string
  weight?: number
}
export interface ObjectiveDto {
  slug: string
  title: Record<string, string>
  code?: string
  mapsTo: string[]
}
export interface FrameworkMetaDto {
  slug: string
  name: Record<string, string>
  kind: string
  locale: string
}
export interface DraftIssueDto {
  code: string
  severity: string
  message: string
}
export interface IngestResultDto {
  compiled: {
    graph: { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] }
    objectives: ObjectiveDto[]
    framework?: FrameworkMetaDto
    /**
     * Kết quả khử trùng lặp, gồm những chỗ máy TỰ GỘP hai khái niệm làm một.
     *
     * Đây là quyết định nặng nhất máy được phép tự làm — gộp sai thì hai kiến thức khác nhau vĩnh
     * viễn thành một và không có tín hiệu nào báo về sau. Máy chủ vẫn luôn gửi kèm; chỗ này không
     * khai ra nên nó chưa từng được gửi ngược lại lúc duyệt, và mỗi lần gộp trôi qua không dấu vết.
     */
    dedup?: {
      merges: {
        tempId: string
        into: string
        reason: 'existing' | 'within-batch'
        similarity: number
        fromTitle: string
        intoTitle: string
      }[]
    }
    /** Bằng chứng nguồn của từng KIẾN THỨC — hợp đồng đồ thị không chở được nên nó đi danh sách riêng. */
    concepts?: {
      slug: string
      title: Record<string, string>
      kind: string
      facets?: Record<string, unknown>
      evidence: { chunkId: string; quote: string; verified?: boolean; charStart?: number; charEnd?: number }[]
      confidence?: number
    }[]
  }
  issues: DraftIssueDto[]
  /** Cảnh báo pipeline (vd cạnh bị bỏ) — nuốt cảnh báo = mù. */
  warnings: string[]
  /** Vi phạm bất biến, XEM TRƯỚC khi ghi. */
  violations: ViolationDto[]
  /** Chỗ máy KHÔNG phân biệt được hai kiến thức — kèm so-từng-trục để người duyệt chốt. */
  collisions?: CollisionDto[]
  /** Chuỗi học quay vòng — kèm từng mắt, vì máy thấy vòng nhưng không biết mắt nào sai. */
  cycles?: CycleDto[]
  blocking: boolean
}

/** So một trục facet giữa hai kiến thức. `same=false` khi khác HOẶC khi một bên không khai. */
export interface AxisAgreementDto {
  axis: string
  same: boolean
  a?: string
  b?: string
}

/**
 * Máy bí ở đâu, và bí vì sao.
 *
 * Không phải điểm giống. Trùng khít MỌI trục mới là lý do máy không có cơ sở tách hai kiến thức —
 * và cũng chính là chỗ người duyệt phải bổ sung nếu chúng thật sự khác nhau.
 */
export interface CollisionDto {
  slugs: [string, string]
  titles: [Record<string, string>, Record<string, string>]
  explanation: {
    tier: string
    basis: string
    facets?: {
      axes: AxisAgreementDto[]
      sameCount: number
      comparedCount: number
      indistinguishable: boolean
      scope: string
    }
  }
}

/**
 * MỘT MẮT của chuỗi quay vòng.
 *
 * `tier` là bậc trung thực của chính mắt đó: mắt "chắc" (máy tự chứng được thứ tự) thì đừng gỡ,
 * mắt "phán đoán" mới là chỗ nên xem lại. Không có nó thì người duyệt gỡ theo cảm tính.
 */
export interface CycleLinkDto {
  from: string
  to: string
  relType: string
  titles: [Record<string, string>, Record<string, string>]
  /**
   * `provenanceCaveat` = cấu trúc CHỨNG ĐƯỢC thứ tự, nhưng dấu hiệu nuôi nó chưa ai đối chiếu vào
   * tài liệu. Gộp nó vào "phán đoán" là mất một mức: một bước suy luận đúng trên dữ liệu chưa kiểm
   * khác hẳn một phán đoán sư phạm thuần tuý, và người duyệt xử hai thứ đó theo hai cách khác nhau.
   */
  explanation: { tier: string; basis: string; machineProven?: boolean; provenanceCaveat?: boolean }
}

export interface CycleDto {
  path: string[]
  links: CycleLinkDto[]
}

/** Bốn lối người duyệt được dùng khi máy bí. Hai lối đầu cho trùng định danh, hai lối sau cho vòng
 * và cho thứ trích ra nhưng không phải kiến thức dạy được. */
export type CollisionDecisionDto =
  | { kind: 'merge'; keep: string; drop: string }
  | { kind: 'distinguish'; slug: string; axis: string; value: string }
  | { kind: 'drop-edge'; from: string; to: string; relType?: string }
  | { kind: 'drop-concept'; slug: string; reason: string }

export interface ResolveCollisionsResultDto {
  graph: { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] }
  objectives: ObjectiveDto[]
  applied: number
  rejected: { code: string }[]
  issues: DraftIssueDto[]
  violations: ViolationDto[]
  collisions: CollisionDto[]
  cycles: CycleDto[]
  blocking: boolean
}

export interface CoursePlanDto {
  slug: string
  title: Record<string, string>
  objectives: string[]
  frameworkVersionId?: string
  units: {
    slug: string
    title: Record<string, string>
    concepts: string[]
    lessons: { slug: string; title: Record<string, string>; teaches: string[] }[]
  }[]
}
export interface SavedCourseDto {
  slug: string
  frameworkVersionId: string | null
  status: string
  /** Lần sinh này đè lên một vỏ khoá ĐÃ DUYỆT, nên con dấu duyệt đã bị gỡ. */
  resetApproval?: boolean
  plan: CoursePlanDto
  /** Chỉ có khi sinh từ SÁCH: bài giữ đúng chỗ nhưng chưa map KC + cảnh báo OCR bị cắt. */
  bookReport?: {
    unmappedLessons: string[]
    truncated: boolean
  }
}
export interface CourseListItemDto {
  slug: string
  title: unknown
  status: string
  frameworkVersionId: string | null
}

export interface ApplyResultDto {
  nodes: number
  edges: number
  framework?: { frameworkVersionId: string; objectives: number; mapsTo: number }
}

// ── Upload: PDF → media (presigned 3 bước) → URL đã ký để đưa cho AI ─────────
export async function uploadPdfAndGetUrl(file: File): Promise<{ url: string; storageKey: string }> {
  const mimeType = file.type || 'application/pdf'
  const { asset, upload } = await api.post<CreateAssetResult>('/media/assets', {
    kind: 'DOCUMENT',
    title: { vi: file.name },
    mimeType,
  })
  await uploadToSignedUrl(upload.url, file, { contentType: mimeType })
  const done = await api.post<MediaAssetDto>(`/media/assets/${asset.id}/complete`, {
    byteSize: file.size,
  })
  const url = done.renditions?.find((r) => r.kind === 'ORIGINAL')?.url ?? done.renditions?.[0]?.url ?? null
  if (!url) throw new Error('Không lấy được URL của file đã tải lên.')
  // KHOÁ KHO đi kèm: chỉ có nó thì lúc duyệt máy chủ mới lấy lại được bytes để định vị từng câu
  // trong PDF. Thiếu, thì thẻ căn cứ vẫn có câu trích nhưng không bao giờ mở được đúng trang.
  return { url, storageKey: upload.key }
}

// ── Framework ────────────────────────────────────────────────────────────────
export function useFrameworkFromPrompt() {
  return useMutation({
    mutationFn: (input: { topic: string; locale?: string }) =>
      api.post<IngestResultDto>('/authoring/framework/from-prompt', input),
  })
}

/** Duyệt: ghi đồ thị + framework + objectives + MAPS_TO. */
/**
 * Duyệt: ghi đồ thị + khung + mục tiêu + ánh xạ, VÀ tài liệu nguồn.
 *
 * `source` từng bị bỏ ra khỏi thân yêu cầu, nên máy chủ không có gì để đối chiếu và không ghi một
 * thẻ căn cứ nào. Hậu quả đọc lên rất khó lần: mọi khung nhập qua trình duyệt ra một đồ thị đầy đủ
 * mà nút "xem căn cứ" mở ra trống, trong khi đúng đường đó chạy từ dòng lệnh thì có đủ.
 *
 * `concepts` cũng vậy — bằng chứng của từng kiến thức đi đường riêng chứ đồ thị không chở được.
 */
export function useApplyFramework() {
  return useMutation({
    mutationFn: (input: {
      compiled: IngestResultDto['compiled']
      source?: { text: string; storageKey?: string }
    }) =>
      api.post<ApplyResultDto>('/authoring/apply', {
        nodes: input.compiled.graph.nodes,
        edges: input.compiled.graph.edges,
        ...(input.compiled.framework ? { framework: input.compiled.framework } : {}),
        ...(input.compiled.objectives.length ? { objectives: input.compiled.objectives } : {}),
        ...(input.compiled.concepts?.length ? { concepts: input.compiled.concepts } : {}),
        ...(input.compiled.dedup?.merges.length ? { merges: input.compiled.dedup.merges } : {}),
        ...(input.source?.text ? { source: input.source } : {}),
      }),
  })
}

/**
 * Gửi quyết định của người duyệt lên server rồi lấy kết quả KIỂM LẠI.
 *
 * Kiểm lại phải ở server: bất biến cần hồ sơ môn và đồ thị đang có để bắt trùng với KC cũ, chứ
 * không chỉ trong lô — trình duyệt không có hai thứ đó, nên nếu để nó tự tuyên "hết vi phạm" thì
 * người duyệt bấm Ghi và bị chặn, hoặc tệ hơn là lọt một trùng định danh với KC đã có.
 */
export function useResolveCollisions() {
  return useMutation({
    mutationFn: (input: { compiled: IngestResultDto['compiled']; decisions: CollisionDecisionDto[] }) =>
      api.post<ResolveCollisionsResultDto>('/authoring/framework/resolve-collisions', {
        nodes: input.compiled.graph.nodes,
        edges: input.compiled.graph.edges,
        ...(input.compiled.objectives.length ? { objectives: input.compiled.objectives } : {}),
        decisions: input.decisions,
      }),
  })
}

// ── Course shell ─────────────────────────────────────────────────────────────
/** Phạm vi chương trình chung cho sinh vỏ khoá — quyết định vốn KC được map (grade/stage). */
export interface CourseScopeInput {
  locale?: string
  frameworkVersionId?: string
  frameworkSlug?: string
  stage?: string
  strand?: string
}

const scopeBody = (s: CourseScopeInput): Record<string, string> => ({
  locale: s.locale ?? 'vi',
  ...(s.frameworkVersionId ? { frameworkVersionId: s.frameworkVersionId } : {}),
  ...(s.frameworkSlug ? { frameworkSlug: s.frameworkSlug } : {}),
  ...(s.stage ? { stage: s.stage } : {}),
  ...(s.strand ? { strand: s.strand } : {}),
})

export function useCourseFromPrompt() {
  return useMutation({
    mutationFn: (input: CourseScopeInput & { brief: string }) =>
      api.post<SavedCourseDto>('/authoring/course/from-prompt', {
        brief: input.brief,
        ...scopeBody(input),
      }),
  })
}

export function useCourseFromBook() {
  return useMutation({
    mutationFn: async (input: CourseScopeInput & { file: File }) => {
      const { url } = await uploadPdfAndGetUrl(input.file)
      return api.post<SavedCourseDto>('/authoring/course/from-book', { pdf: url, ...scopeBody(input) })
    },
  })
}

export function useCourses() {
  return useQuery({
    queryKey: ['authoring', 'courses'],
    queryFn: () => api.get<CourseListItemDto[]>('/authoring/course'),
  })
}

// ── Giáo án (Instruction Plan) cho 1 bài ─────────────────────────────────────
export interface IssueDto {
  code: string
  severity: string
  message: string
}
export interface LessonStepDto {
  slug: string
  role: string
  title: Record<string, string>
  intent?: Record<string, string>
  durationMin: number
  deliveryKind: 'explainer' | 'content' | 'practice' | 'assessment' | 'reflection'
  /** Brief nội dung cụ thể — generator bám vào để không sinh chung chung. */
  brief?: Record<string, string>
  mustCover?: Record<string, string>[]
  /** Bước phục vụ trạng thái người học nào (novice/gap/proficient/mastered); rỗng = mọi trạng thái. */
  forStates?: string[]
  primitiveKinds?: string[]
  itemCount?: number
  band?: string
}
/** Mỗi KC một chuỗi bước riêng (không gộp) — xếp theo tiên quyết. */
export interface KcArcDto {
  kc: string
  title?: Record<string, string>
  steps: LessonStepDto[]
}
export interface LessonPlanDto {
  slug: string
  title: Record<string, string>
  teaches: string[]
  knowledgePoints: {
    slug: string
    targets: string[]
    misconceptions?: { id: string; type: string; wrong: Record<string, string> }[]
  }[]
  /** CẤU TRÚC bài — MỖI KC MỘT CHUỖI bước (explainer/content/practice/assessment/reflection). */
  kcArcs?: KcArcDto[]
}
export interface LessonPlanResultDto {
  plan: LessonPlanDto
  quality: { issues: IssueDto[]; score: number; approvable: boolean }
}

export function useGenerateLessonPlan() {
  return useMutation({
    mutationFn: (input: { kcs: string[]; language?: string; level?: string }) =>
      api.post<LessonPlanResultDto>('/authoring/plan/generate', {
        kcs: input.kcs,
        language: input.language ?? 'vi',
        ...(input.level ? { level: input.level } : {}),
      }),
  })
}

// ── Nội dung 1 bài: HỌC (block) + ĐÁNH GIÁ (quiz) + ÔN TẬP (flashcard) ───────
export interface ItemDto {
  itemKey: string
  primitiveKind: string
  skills: string[]
}
export interface LessonContentDto {
  teaching: ItemDto[]
  review: ItemDto[]
  assessment: { items: ItemDto[]; issues: IssueDto[]; approvable: boolean }
}

/**
 * Sinh nội dung cho một bài: nêu BÀI NÀO, máy chủ tự lấy giáo án ĐÃ DUYỆT.
 *
 * Trước đây giáo án được gửi lên từ trạng thái trình duyệt, nên máy chủ không biết đang sinh cho
 * bài nào và không kiểm được nó đã duyệt chưa. Nút bấm có khoá, nhưng khoá ở nút bấm thì không phải khoá.
 */
export function useGenerateContent() {
  return useMutation({
    mutationFn: (input: { courseSlug: string; lessonSlug: string; level: string; language?: string }) =>
      api.post<LessonContentDto>('/authoring/content/generate', {
        courseSlug: input.courseSlug,
        lessonSlug: input.lessonSlug,
        learner: { level: input.level, language: input.language ?? 'vi' },
      }),
  })
}

export function useApproveItems() {
  return useMutation({
    mutationFn: (itemKeys: string[]) =>
      api.post<{ approved: number }>('/authoring/content/approve', { itemKeys }),
  })
}

// ── PER-ITEM content: sinh từng cái → soát → duyệt/sinh lại/xoá. Đa ngôn ngữ. ──────────────────
export interface ContentItemDto {
  itemKey: string
  skills: string[]
  difficulty: number
  mode: string
  measurable?: boolean
  primitiveKind: string
  lessonSlug?: string
  payload: Record<string, unknown>
  status: string // DRAFT | NEEDS_REVIEW | APPROVED | PUBLISHED
}

const contentItemsQK = (skill?: string, lesson?: string) =>
  ['authoring', 'content-items', skill ?? '', lesson ?? ''] as const

// Mô tả primitive (họ nào + học sinh làm gì) — để soạn giả hiểu trước khi sinh.
export interface PrimitiveInfoDto {
  kind: string
  family: 'quiz' | 'kit' | 'block'
  canPreview: boolean
  answerReady: boolean
  label: { vi: string; en: string }
  desc: { vi: string; en: string } | null
}
export function usePrimitiveInfos(kinds: string[], enabled = true) {
  const key = kinds.join(',')
  return useQuery({
    queryKey: ['authoring', 'primitive-info', key] as const,
    queryFn: () => api.get<PrimitiveInfoDto[]>(`/authoring/primitive-info?kinds=${encodeURIComponent(key)}`),
    enabled: enabled && kinds.length > 0,
    staleTime: 5 * 60_000,
  })
}

/** Toàn bộ palette primitive (2 họ) — để chọn loại hợp khi gợi ý của plan không đủ. */
export function useAllPrimitives(enabled = true) {
  return useQuery({
    queryKey: ['authoring', 'primitives-all'] as const,
    queryFn: () => api.get<PrimitiveInfoDto[]>('/authoring/primitives'),
    enabled,
    staleTime: 10 * 60_000,
  })
}

export interface PrimitiveRecoDto {
  kind: string
  reason: string
  info: PrimitiveInfoDto
}
/** Hệ GỢI Ý loại phù hợp cho một step (LLM đọc brief + catalogue) — khỏi dò 122 loại. */
export function useRecommendPrimitives() {
  return useMutation({
    mutationFn: (input: {
      kc: string
      brief: string
      representation?: string
      band?: string
      language?: string
    }) => api.post<PrimitiveRecoDto[]>('/authoring/primitive-recommend', input),
  })
}

/** Item để SOÁT — lọc theo KC (skill) và/hoặc bài. */
export function useContentItems(skill?: string, lesson?: string, enabled = true) {
  return useQuery({
    queryKey: contentItemsQK(skill, lesson),
    queryFn: () => {
      const q = new URLSearchParams()
      if (skill) q.set('skill', skill)
      if (lesson) q.set('lesson', lesson)
      return api.get<ContentItemDto[]>(`/authoring/content/items?${q.toString()}`)
    },
    enabled: enabled && Boolean(skill || lesson),
  })
}

export interface GenOneItemInput {
  kc: string
  primitiveKind: string
  /** Khoá — để server rút misconceptions của KC từ kế hoạch bài (distractor nhắm đúng hiểu-sai). */
  courseSlug?: string
  lessonSlug?: string
  /** Bước (content step) sở hữu item — vào itemKey để tách item giữa các bước cùng KC (chống trùng). */
  stepSlug?: string
  /** Brief step (grounding) — content bám đúng ý đồ step. */
  brief?: string
  band?: string
  languages?: string[]
  representation?: string
  seq?: number
  newItem?: boolean
}

/** Sinh ĐÚNG 1 item; `inv` = phạm vi để nạp lại danh sách soát sau khi sinh. */
export function useGenOneItem(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenOneItemInput) =>
      api.post<ContentItemDto>('/authoring/content/item/generate', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  })
}

export function useDeleteItem(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemKey: string) =>
      api.post<{ deleted: string }>('/authoring/content/item/delete', { itemKey }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  })
}

/** Duyệt item (giữ nguyên KC+lesson) + nạp lại danh sách soát. */
export function useApproveItemsFor(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemKeys: string[]) =>
      api.post<{ approved: number }>('/authoring/content/approve', { itemKeys }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  })
}

// ── MEDIA per-item: MỖI Ô có nhãn rõ + preview + duyệt/từ chối/sinh lại (ảnh vật kit, minh hoạ, đáp án A/B/C…) ─
export interface MediaSlotDto {
  path: string
  kind: 'image' | 'audio'
  slot: string
  label: { vi: string; en: string }
  query: string
  asUrl: boolean
  current: string | null
}
export interface GenAssetDto {
  id: string
  title?: Record<string, string>
  renditions?: { url: string | null }[]
}

const itemMediaQK = (itemKey: string) => ['authoring', 'item-media', itemKey] as const

/** Tất cả ô media của item (ảnh + audio), có nhãn + giá trị đang gắn — để render vòng soát per-slot. */
export function useItemMediaSlots(itemKey: string, enabled = true) {
  return useQuery({
    queryKey: itemMediaQK(itemKey),
    queryFn: () =>
      api.get<{ slots: MediaSlotDto[] }>(
        `/authoring/content/item/media-targets?itemKey=${encodeURIComponent(itemKey)}`,
      ),
    enabled: enabled && Boolean(itemKey),
  })
}

export function useAttachItemMedia(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { itemKey: string; path: string; assetId: string; asUrl?: boolean }) =>
      api.post<ContentItemDto>('/authoring/content/item/media', i),
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) })
      void qc.invalidateQueries({ queryKey: itemMediaQK(i.itemKey) })
    },
  })
}

// ── SINH MEDIA NỀN: sinh 1 ảnh/audio tốn ~15–30s → API trả 202 + job; client POLL đến 'done' ──────
// Vì sao KHÔNG đồng bộ: giữ socket suốt 15–30s bị proxy dev Next cắt → "Internal Server Error" DÙ asset
// đã tạo + vào thư viện. Job nền + poll nhanh né hẳn (giống job sinh kế hoạch).
export type MediaJobState = 'running' | 'done' | 'error' | 'cancelled'
export type MediaJobKind = 'image' | 'audio'
/** Kết quả đã serialize: ảnh → {count,assets}; audio → 1 asset. Chỉ có khi state='done'. */
export type MediaJobResult = { count: number; assets: GenAssetDto[] } | GenAssetDto | null
export interface MediaJobDto {
  id: string
  kind: MediaJobKind
  state: MediaJobState
  etaMs?: number
  result?: MediaJobResult
  error?: string
}

/** Rút asset đầu tiên từ result của job (ảnh lấy assets[0], audio là chính nó). */
export function mediaJobAsset(r: MediaJobResult | undefined): GenAssetDto | null {
  if (!r) return null
  if ('assets' in r) return r.assets[0] ?? null
  return r
}

// ── ĐỘ DÀY NGÂN HÀNG (rich bank) cho 1 KC: đích (rep×band×misconception) vs bank hiện có → còn thiếu ──
export interface DensityRowDto {
  slot: { representation: string; band: string; misconceptionId?: string; count: number }
  have: number
  need: number
}
export interface DensityDto {
  kc: string
  richness: string
  representations: string[]
  targetTotal: number
  have: number
  gapTotal: number
  coverage: DensityRowDto[]
}

/** Độ dày bank của KC (course+lesson để lấy representations/misconceptions từ kế hoạch bài). */
export function useContentDensity(
  kc: string,
  courseSlug?: string,
  lessonSlug?: string,
  richness = 'standard',
  enabled = true,
) {
  return useQuery({
    queryKey: ['authoring', 'density', kc, courseSlug, lessonSlug, richness] as const,
    queryFn: () =>
      api.get<DensityDto>(
        `/authoring/content/density?kc=${encodeURIComponent(kc)}&richness=${richness}` +
          (courseSlug ? `&course=${encodeURIComponent(courseSlug)}` : '') +
          (lessonSlug ? `&lesson=${encodeURIComponent(lessonSlug)}` : ''),
      ),
    enabled: enabled && Boolean(kc),
  })
}

/** Khởi động sinh ẢNH (openai) → trả job đang chạy (id để poll). */
export function useStartGenImage() {
  return useMutation({
    mutationFn: (i: { prompt: string; count?: number }) => api.post<MediaJobDto>('/media/generate/image', i),
  })
}

/** Khởi động sinh ÂM THANH (elevenlabs) từ text → trả job đang chạy. */
export function useStartGenAudio() {
  return useMutation({
    mutationFn: (i: { text: string; languageCode?: string }) =>
      api.post<MediaJobDto>('/media/generate/audio', i),
  })
}

/** Poll trạng thái job sinh media theo id; chỉ lặp khi 'running', tự dừng khi kết thúc. */
export function useMediaJob(jobId: string | null) {
  return useQuery({
    queryKey: ['authoring', 'media-job', jobId] as const,
    queryFn: () => api.get<MediaJobDto>(`/media/generate/job/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 1500 : false),
  })
}

/** Hủy job sinh media đang chạy (abort provider call thật). */
export function useCancelMediaJob() {
  return useMutation({
    mutationFn: (jobId: string) => api.post<MediaJobDto>(`/media/generate/job/${jobId}/cancel`, {}),
  })
}

/** Tìm thư viện media theo mô tả (hybrid). `kind` DB là CHỮ HOA (IMAGE/AUDIO). Trả hits id + rendition url. */
export function useMediaSearch(text: string, kind: 'image' | 'audio', enabled: boolean) {
  return useQuery({
    queryKey: ['authoring', 'media-search', kind, text] as const,
    queryFn: () =>
      api.post<{ hits: GenAssetDto[] }>('/media/search', {
        text,
        kind: [kind.toUpperCase()],
        limit: 12,
      }),
    enabled: enabled && Boolean(text),
  })
}

// ── Bước tách rời: PDF → text → khung (để UI hiện tiến trình từng chặng) ─────
export function useExtractText() {
  return useMutation({
    mutationFn: async (file: File) => {
      const { url, storageKey } = await uploadPdfAndGetUrl(file)
      const r = await api.post<{ text: string; chars: number }>('/authoring/source/extract-text', {
        pdf: url,
      })
      return { ...r, storageKey }
    },
  })
}

export function useFrameworkFromText() {
  return useMutation({
    mutationFn: (input: { text: string; locale?: string }) =>
      api.post<IngestResultDto>('/authoring/framework/from-text', {
        text: input.text,
        locale: input.locale ?? 'vi',
      }),
  })
}

// ── Quản lý Framework ────────────────────────────────────────────────────────
export interface FrameworkListItemDto {
  slug: string
  name: Record<string, string>
  kind: string
  locale: string
  versions: number
  objectives: number
  updatedAt: string
}
export interface FrameworkVersionDto {
  id: string
  semver: string
  status: string
  publishedAt: string | null
  createdAt: string
  objectives: number
}
export interface FrameworkDetailDto {
  slug: string
  name: Record<string, string>
  kind: string
  locale: string
  versions: FrameworkVersionDto[]
  objectives: {
    slug: string
    title: Record<string, string>
    code: string | null
    versionId: string | null
    /** 'verified' = có nguồn trích được; 'review' = AI suy đoán, cần duyệt. */
    status?: 'verified' | 'review'
  }[]
}
export interface GraphViewDto {
  nodes: {
    id: string
    slug: string
    title: Record<string, string>
    kind: string
    strand?: string
    /** 6 trục facets — thứ quyết định hai KC có phải một; hiện khi bấm node để diễn giải. */
    facets?: Record<string, unknown>
    /** Mã hiển thị của objective (vd 1Nc.02). */
    code?: string
  }[]
  edges: { from: string; to: string; relType: string; mode: string }[]
}

const fwKeys = {
  all: ['authoring', 'frameworks'] as const,
  one: (slug: string) => ['authoring', 'framework', slug] as const,
  graph: (slug: string) => ['authoring', 'framework', slug, 'graph'] as const,
}

export function useFrameworks() {
  return useQuery({
    queryKey: fwKeys.all,
    queryFn: () => api.get<FrameworkListItemDto[]>('/authoring/framework'),
  })
}

export function useFramework(slug: string) {
  return useQuery({
    queryKey: fwKeys.one(slug),
    queryFn: () => api.get<FrameworkDetailDto>(`/authoring/framework/${slug}`),
  })
}

export function useFrameworkGraph(slug: string) {
  return useQuery({
    queryKey: fwKeys.graph(slug),
    queryFn: () => api.get<GraphViewDto>(`/authoring/framework/${slug}/graph`),
  })
}

// ── TRUY NGUỒN một mục tiêu (mirror decision-trace.service.ts) ────────────────
export interface RectDto {
  x: number
  y: number
  w: number
  h: number
}
export type SourceLocatorDto =
  { kind: 'pdf'; page: number; rects: RectDto[] } | { kind: 'text'; start: number; end: number }
export interface TraceSourceLaneDto {
  quote: string
  chunkId?: string
  excerpt: string
  charStart?: number
  charEnd?: number
  verifiedAtWrite: boolean
  verifiedNow: boolean
  documentId?: string
  pageCount?: number
  locator?: SourceLocatorDto
}
export interface TraceStructuralLaneDto {
  checkCode: string
  passedAtWrite: boolean
  passedNow: boolean
  /** Hôm nay có kiểm lại được thật không — không có thì tấm thẻ phải nói là chưa kiểm, không được vẽ như vừa kiểm xong. */
  liveChecked: boolean
  detail?: unknown
}

/** Bốn loại thẻ đọc được — khớp với TraceArtifact ở phía máy chủ. */
export type TraceArtifactDto =
  | 'OBJECTIVE_EXISTS'
  | 'CONCEPT_EXISTS'
  | 'PREREQ_EDGE'
  | 'OBJECTIVE_COVERAGE'
  /** Máy tự gộp hai khái niệm — không có làn nguồn lẫn làn tự kiểm; lời giải thích ở cột lý do. */
  | 'CONCEPT_IDENTITY'
  /** Bài trong sách dạy kiến thức nào. */
  | 'LESSON_MAPPING'
  /** Sách dạy thứ khung chưa có. */
  | 'KC_PROPOSED'

export interface DecisionTraceDto {
  id: string
  artifact: TraceArtifactDto
  subjectSlug: string
  objectSlug: string | null
  relType: string | null
  claim: Record<string, string>
  reason: Record<string, string> | null
  method: string
  basis: 'FROM_SOURCE' | 'STRUCTURAL' | 'AI_INFERRED'
  verdict: string
  overridden: boolean
  decidedAt: string | null
  /** Lý do NGƯỜI nêu khi từ chối/sửa — khác `reason`, vốn là câu AI tự lý giải. */
  decidedNote: string | null
  createdAt: string
  supersededCount: number
  source: TraceSourceLaneDto | null
  structural: TraceStructuralLaneDto[]
  drift: boolean
}

/**
 * Thẻ căn cứ cho MỘT chỗ bất kỳ — bốn loại chung một đường.
 *
 * Trả danh sách: một mục tiêu có thể có nhiều thẻ phủ (mỗi mảnh kiến thức một thẻ), và danh sách rỗng
 * là trạng thái bình thường chứ không phải lỗi.
 */
export function useDecisionTraces(a: {
  artifact: TraceArtifactDto
  subject: string | null
  object?: string
}) {
  return useQuery({
    queryKey: ['authoring', 'trace', a.artifact, a.subject, a.object ?? null] as const,
    queryFn: () =>
      api.get<DecisionTraceDto[]>(
        `/authoring/trace/${a.artifact}/${encodeURIComponent(a.subject ?? '')}` +
          (a.object ? `?object=${encodeURIComponent(a.object)}` : ''),
      ),
    enabled: a.subject !== null,
  })
}

// ── CROSSWALK hai khung (mirror crosswalk.repo.ts) ───────────────────────────
export type GapStatus = 'achieved' | 'partial' | 'none'
export interface CrosswalkObjectiveDto {
  slug: string
  code?: string
  title: string
  requires: string[]
}
export interface CrosswalkKcDto {
  slug: string
  title: string
  kind: string
  strand?: string
  side: 'both' | 'a' | 'b'
}
export interface ObjectiveGapDto {
  slug: string
  code?: string
  title: string
  requires: string[]
  have: string[]
  missing: string[]
  status: GapStatus
}
export interface FrameworkReportDto {
  frameworkSlug: string
  frameworkName: string
  objectives: ObjectiveGapDto[]
  summary: { achieved: number; partial: number; none: number; total: number; percent: number }
}
/**
 * VÌ SAO một kiến thức chỉ có ở một bên.
 *
 * Danh sách "chỉ bên A có" đọc lên như bên B thiếu sót, mà phần lớn không phải: hai bên nói cùng
 * một điều ở phạm vi khác nhau, hoặc qua một kênh khác. `matchedBy` nói cặp này thành cặp nhờ đâu —
 * thiếu nó thì một cặp ghép được vì tình cờ trùng chữ trông ngang hàng với một cặp cùng đối tượng.
 */
export interface CrosswalkDifferenceDto {
  slug: string
  title: string
  side: 'a' | 'b'
  nearest?: { slug: string; title: string }
  matchedBy?: 'object' | 'object-part' | 'wording'
  scope?: 'equal' | 'subset' | 'superset' | 'incomparable'
  explanation?: { tier: string; basis: string; facets?: { axes: AxisAgreementDto[] } }
}

export interface CrosswalkDto {
  a: { slug: string; name: string; objectives: CrosswalkObjectiveDto[] }
  b: { slug: string; name: string; objectives: CrosswalkObjectiveDto[] }
  kcs: CrosswalkKcDto[]
  sharedKcs: string[]
  edges: { from: string; to: string; relType: string }[]
  aToB: FrameworkReportDto
  bToA: FrameworkReportDto
  differences: CrosswalkDifferenceDto[]
}

/** Đối chiếu hai khung (KC trùng + thiếu gì khi chuyển). Chỉ chạy khi chọn đủ A ≠ B. */
export function useCrosswalk(a: string | undefined, b: string | undefined) {
  return useQuery({
    queryKey: ['authoring', 'crosswalk', a, b],
    queryFn: () => api.get<CrosswalkDto>(`/authoring/crosswalk/${a}/${b}`),
    enabled: Boolean(a && b && a !== b),
  })
}

export function useCreateVersion(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (release: 'MAJOR' | 'MINOR' | 'PATCH') =>
      api.post<FrameworkVersionDto>(`/authoring/framework/${slug}/version`, { release }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fwKeys.one(slug) }),
  })
}

export function usePublishVersion(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<{ published: string; deprecated: number }>(
        `/authoring/framework/version/${versionId}/publish`,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fwKeys.one(slug) }),
  })
}

// Kiểu tối thiểu của một gói CASE — CHỈ những trường viewer đọc. Admin không phụ thuộc
// `@bingoo.ai/codecs` (tách nền), nên khai lại ở đây thay vì import type từ codec.
export interface CaseLink {
  identifier?: string
  uri?: string
  title?: string
}
export interface CaseItem {
  identifier: string
  humanCodingScheme?: string
  fullStatement: string
  conceptKeywords?: string[]
  educationLevel?: string | string[]
  language?: string
  uri?: string
  /** Bản dịch đi kèm dưới túi mở rộng CASE (encode ghi `localizedStatements`: lang → phát biểu). */
  extensions?: { localizedStatements?: Record<string, string> } & Record<string, unknown>
}
export interface CaseAssociation {
  identifier: string
  associationType: string
  originNodeURI?: CaseLink
  destinationNodeURI?: CaseLink
}
export interface CasePackage {
  CFDocument: {
    identifier: string
    title: string
    language?: string
    version?: string
    officialSourceURL?: string
  }
  CFItems: CaseItem[]
  CFAssociations: CaseAssociation[]
}
export interface CaseExportDto {
  package: CasePackage
  report: { ok: boolean; issues: { severity: string; code: string; message: string }[] }
}

/** Lấy một bản khung ở dạng CASE 1EdTech (để XEM). Không tự tải — download là hành động riêng. */
export function useCaseExport(slug: string) {
  return useMutation({
    mutationFn: (version?: string): Promise<CaseExportDto> => {
      const q = version ? `?version=${encodeURIComponent(version)}` : ''
      return api.get<CaseExportDto>(`/authoring/framework/${slug}/export/case${q}`)
    },
  })
}

/** Tải gói CASE về máy dưới dạng `.case.json` (client-only; không lưu server). */
export function downloadCasePackage(pkg: CasePackage, slug: string, version?: string): void {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug}${version ? `@${version}` : ''}.case.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ── Quản lý Course ───────────────────────────────────────────────────────────
export function useCourse(slug: string) {
  return useQuery({
    queryKey: ['authoring', 'course', slug],
    queryFn: () => api.get<SavedCourseDto>(`/authoring/course/${slug}`),
  })
}

export function useSetCourseStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: string }) =>
      api.patch<{ slug: string; status: string }>(`/authoring/course/${slug}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring'] }),
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => api.del<{ deleted: string }>(`/authoring/course/${slug}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring', 'courses'] }),
  })
}

// ── ĐỐI CHIẾU khung #2 vào vốn KC canonical ──────────────────────────────────
export type AlignVerdict = 'SAME' | 'SUBSET' | 'SUPERSET' | 'OVERLAP' | 'NEW' | 'UNKNOWN'

export interface AlignProposalDto {
  tempId: string
  title: string
  /** Slug do SERVER mint (chống trùng toàn đồ thị) — client KHÔNG được tự chế. */
  slug: string
  kind: string
  subject?: string
  /** Facets phải đi cùng: thiếu nó thì KC ghi ra sẽ vô danh, vi phạm I8, và lần đối chiếu sau mù. */
  facets?: Record<string, unknown>
  target?: string
  targetTitle?: string
  decision: { verdict: AlignVerdict; axes: string[]; reason: string; decidedBy: string }
  needsHuman: boolean
}
export interface AlignReportDto {
  proposals: AlignProposalDto[]
  summary: Record<string, number>
  needsHuman: number
  warnings: string[]
}

export function useAlignSource() {
  return useMutation({
    mutationFn: (input: { text: string; subject?: string; locale?: string }) =>
      api.post<AlignReportDto>('/authoring/framework/align', {
        text: input.text,
        locale: input.locale ?? 'en',
        ...(input.subject ? { subject: input.subject } : {}),
      }),
  })
}

export interface AlignDecisionDto {
  slug: string
  title: Record<string, string>
  kind: string
  subject?: string
  facets?: Record<string, unknown>
  verdict: AlignVerdict
  target?: string
  /** Máy đề xuất gì — gửi kèm để lưu audit và đo được người sửa máy ở đâu. */
  proposedVerdict?: AlignVerdict
  proposedBy?: string
  proposedReason?: string
}

export interface AlignHistoryRow {
  id: string
  sourceSlug: string
  sourceTitle: Record<string, string>
  targetSlug: string | null
  verdict: AlignVerdict
  proposedVerdict: AlignVerdict | null
  proposedBy: string | null
  proposedReason: string | null
  overridden: boolean
  decidedBy: string | null
  createdAt: string
}

/** Lịch sử đối chiếu — quyết định GỘP là vĩnh viễn, đây là chỗ duy nhất truy được "ai chốt, vì sao". */
export function useAlignHistory() {
  return useQuery({
    queryKey: ['authoring', 'align-history'],
    queryFn: () => api.get<AlignHistoryRow[]>('/authoring/framework/align/history'),
  })
}

export function useApplyAlignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (decisions: AlignDecisionDto[]) =>
      api.post<{ reused: number; created: number; prerequisite: number; aligns: number }>(
        '/authoring/framework/align/apply',
        { decisions },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring'] }),
  })
}

// ── ĐỘ PHỦ 2 CHIỀU: khung ↕ KC ↕ khoá ────────────────────────────────────────
export interface CoverageDto {
  frameworkSlug: string
  courseSlug: string
  objectives: {
    slug: string
    title: string
    kind: string
    code?: string
    stage?: string
    strand?: string
  }[]
  kcs: {
    slug: string
    title: string
    kind: string
    facets?: Record<string, unknown>
    strand?: string
  }[]
  lessons: { slug: string; title: string; unit: string; teaches: string[] }[]
  edges: { from: string; to: string; relType: string }[]
  objectiveCoverage: {
    slug: string
    code?: string
    title: string
    requires: string[]
    taught: string[]
    status: 'full' | 'partial' | 'none'
  }[]
  untetheredKcs: string[]
  summary: {
    objectivesFull: number
    objectivesPartial: number
    objectivesNone: number
    kcsTaught: number
    kcsTotal: number
  }
}

export function useCoverage(framework: string, course: string) {
  return useQuery({
    queryKey: ['authoring', 'coverage', framework, course],
    queryFn: () => api.get<CoverageDto>(`/authoring/coverage/${framework}/${course}`),
    enabled: Boolean(framework && course),
  })
}

// ── KẾ HOẠCH PHÂN CẤP: Khoá → Unit → Bài, mỗi cấp có trạng thái DUYỆT ──────────
export type PlanLevel = 'course' | 'unit' | 'lesson'

export interface HierQualityDto {
  issues: { code: string; severity: 'error' | 'warning'; message: string }[]
  score: number
  approvable: boolean
}
export interface StoredPlanDto {
  /** Cấp DƯỚI vừa bị gỡ dấu duyệt vì bản này được sinh lại — người soạn phải thấy. */
  invalidated?: string[]
  level: PlanLevel
  refSlug: string
  doc: Record<string, unknown>
  status: string // DRAFT | APPROVED
  version: number
  quality: HierQualityDto | null
  approvedBy: string | null
  // PROVENANCE: model + prompt (id + hash) đã sinh bản này — null nếu không do AI / bản cũ.
  aiModel: string | null
  promptId: string | null
  promptHash: string | null
}

/** Cây kế hoạch của khoá — mọi cấp + trạng thái duyệt (để gate UI). */
export function useCoursePlans(courseSlug: string) {
  return useQuery({
    queryKey: ['authoring', 'plans', courseSlug],
    queryFn: () => api.get<StoredPlanDto[]>(`/authoring/plan/course/${courseSlug}`),
    enabled: Boolean(courseSlug),
  })
}

// ── DERIVED INSIGHTS: KC theo LOẠI (knowledge/skill/…), mục tiêu, tiên quyết — TÍNH từ graph ────────
export interface KcRefDto {
  slug: string
  title: Record<string, string>
  kind: string
}
export interface KindGroupDto {
  kind: string
  items: KcRefDto[]
}
export interface MisconceptionRefDto {
  kc: string
  type: string
  wrong: Record<string, string>
  lessonSlug: string
}
export interface EvidenceRefDto {
  concept: string
  title: Record<string, string>
  itemCount: number
  modes: string[]
  lessons: string[]
}
export interface LevelInsightsDto {
  level: PlanLevel
  refSlug: string
  kcCount: number
  byKind: KindGroupDto[]
  objectives: KcRefDto[]
  prerequisites: KcRefDto[]
  misconceptions: MisconceptionRefDto[]
  evidence: EvidenceRefDto[]
}

/** Dẫn xuất từ graph cho một cấp — không author, luôn phản ánh graph hiện tại. Cache 60s. */
export function useLevelInsights(courseSlug: string, level: PlanLevel, refSlug: string, enabled = true) {
  return useQuery({
    queryKey: ['authoring', 'insights', courseSlug, level, refSlug],
    queryFn: () =>
      api.get<LevelInsightsDto>(
        `/authoring/plan/course/${courseSlug}/insights?level=${level}&ref=${encodeURIComponent(refSlug)}`,
      ),
    enabled: enabled && Boolean(courseSlug && refSlug),
    staleTime: 60_000,
  })
}

// ── JOB SINH NỀN: sinh 1 kế hoạch ~2 phút → API trả 202 + job; client POLL trạng thái ──────────
// Reload vẫn nối lại (job theo tiến trình API, không theo trình duyệt): poll on-mount theo (level,ref).
export type PlanJobState = 'idle' | 'running' | 'done' | 'error' | 'cancelled'
export interface PlanJobDto {
  key?: string
  level: PlanLevel
  refSlug: string
  state: PlanJobState
  startedAt?: number
  finishedAt?: number
  /** Ước lượng ms để vẽ thanh tiến trình (server gợi ý theo cấp). */
  etaMs?: number
  error?: string
}

const planJobQK = (courseSlug: string, level: PlanLevel, refSlug: string) =>
  ['authoring', 'plan-job', courseSlug, level, refSlug] as const
const plansQK = (courseSlug: string) => ['authoring', 'plans', courseSlug] as const

/**
 * Poll job sinh cho (level, ref). Bật sẵn khi mount (bắt được job đang chạy sau khi reload); chỉ lặp
 * khi state='running', tự dừng khi kết thúc. Job vừa 'done' → nạp lại cây kế hoạch để hiện plan mới.
 */
export function usePlanJob(courseSlug: string, level: PlanLevel, refSlug: string, enabled = true) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: planJobQK(courseSlug, level, refSlug),
    queryFn: () =>
      api.get<PlanJobDto>(
        `/authoring/plan/course/${courseSlug}/job?level=${level}&ref=${encodeURIComponent(refSlug)}`,
      ),
    enabled: enabled && Boolean(courseSlug && refSlug),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 2500 : false),
  })
  // Chuyển sang trạng thái kết thúc: 'done' thì nạp lại danh sách kế hoạch (một lần mỗi lần đổi state).
  const prev = useRef<PlanJobState | undefined>(undefined)
  useEffect(() => {
    const s = q.data?.state
    if (s && s !== prev.current) {
      if (s === 'done') void qc.invalidateQueries({ queryKey: plansQK(courseSlug) })
      prev.current = s
    }
  }, [q.data?.state, courseSlug, qc])
  return q
}

export function useCancelPlanJob(courseSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { level: PlanLevel; refSlug: string }) =>
      api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/job/cancel`, input),
    onSuccess: (_d, input) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, input.level, input.refSlug) }),
  })
}

export function useGenCoursePlan(courseSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/generate`, {}),
    // Job vừa khởi động → nạp trạng thái job ngay để thanh tiến trình chạy.
    onSuccess: () => void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'course', courseSlug) }),
  })
}

export function useGenUnitPlan(courseSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (unitSlug: string) =>
      api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/unit/${unitSlug}/generate`, {}),
    onSuccess: (_d, unitSlug) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'unit', unitSlug) }),
  })
}

export function useApprovePlan(courseSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { level: PlanLevel; refSlug: string }) =>
      api.post<StoredPlanDto>(`/authoring/plan/course/${courseSlug}/approve`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: plansQK(courseSlug) }),
  })
}

/** Sinh kế hoạch BÀI trong khoá (gate: unit đã duyệt) — grounding + lưu; job nền + poll. */
export function useGenLessonPlanInCourse(courseSlug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { lessonSlug: string; level?: string }) =>
      api.post<PlanJobDto>(
        `/authoring/plan/course/${courseSlug}/lesson/${input.lessonSlug}/generate` +
          (input.level ? `?level=${encodeURIComponent(input.level)}` : ''),
        {},
      ),
    onSuccess: (_d, input) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'lesson', input.lessonSlug) }),
  })
}

/** Vì sao bài này ở đây — nối ngược từ bài về mục tiêu và về sách. Không đúc thẻ mới, chỉ soạn lại. */
export interface PlanGroundingDto {
  courseSlug: string
  lessonSlug: string
  lessonTitle: Record<string, string>
  unitSlug: string
  planStatus: string | null
  courseePlanApproved: boolean
  unitPlanApproved: boolean
  concepts: { slug: string; title: Record<string, string> | null; hasTrace: boolean }[]
  objectives: {
    slug: string
    code: string | null
    title: Record<string, string> | null
    frameworkSlug: string | null
    viaConcepts: string[]
    hasTrace: boolean
  }[]
  fromBook: { conceptSlug: string | null; hasQuote: boolean }[]
}

export function usePlanGrounding(courseSlug: string, lessonSlug: string | null) {
  return useQuery({
    queryKey: ['authoring', 'plan-grounding', courseSlug, lessonSlug] as const,
    queryFn: () =>
      api.get<PlanGroundingDto>(
        `/authoring/plan/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonSlug ?? '')}/grounding`,
      ),
    enabled: lessonSlug !== null,
  })
}

/**
 * Người duyệt CHỐT một tấm thẻ.
 *
 * Từ chối/sửa phải kèm lý do — máy chủ cưỡng chế, và giao diện cũng không cho bấm khi trống, để
 * người dùng biết trước chứ không bị chặn sau.
 */
export function useTraceVerdict() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; verdict: 'CONFIRMED' | 'REJECTED' | 'EDITED'; note?: string }) =>
      api.post<{ id: string; verdict: string; overridden: boolean }>(
        `/authoring/trace/${encodeURIComponent(input.id)}/verdict`,
        { verdict: input.verdict, ...(input.note ? { note: input.note } : {}) },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring', 'trace'] }),
  })
}

/**
 * Nhận một đề xuất làm dày: kiến thức mới thật sự vào khung.
 *
 * Đòi khai NÓ NÓI VỀ CÁI GÌ và học QUA KÊNH NÀO — không phải thủ tục. Một kiến thức không có dấu
 * hiệu phân biệt thì ngày mai không ai tách nổi nó khỏi cái bên cạnh, và gộp sai là hỏng vĩnh viễn
 * mà không có tín hiệu nào báo.
 */
export function useAcceptProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; object: string; channel: string; bloom?: string; subject?: string }) =>
      api.post<{ slug: string; title: string; traceId: string }>(
        `/authoring/trace/${encodeURIComponent(input.id)}/accept-proposal`,
        {
          object: input.object,
          channel: input.channel,
          ...(input.bloom ? { bloom: input.bloom } : {}),
          ...(input.subject ? { subject: input.subject } : {}),
        },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring', 'trace'] }),
  })
}
