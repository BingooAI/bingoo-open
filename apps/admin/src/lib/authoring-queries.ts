import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadToSignedUrl } from './api-client';
import type { MediaAssetDto } from './api-types';
import type { CreateAssetResult } from './media-queries';

/**
 * Authoring — sinh khung năng lực (framework) và vỏ khoá học, bám @bingoo/knowledge-engine.
 * DTO viết tay mirror API (chưa có generated client). API là biên RBAC thật (CONTENT_EDITOR|ADMIN).
 */

// ── DTOs (mirror apps/api/src/routes/authoring.ts) ───────────────────────────
export interface GraphNodeDto {
  slug: string;
  title: Record<string, string>;
  kind: string;
  parent?: string;
  level?: number;
  subject?: string;
  /** 7 trục phân biệt — thứ quyết định hai KC có phải một. Người soạn PHẢI thấy được. */
  facets?: Record<string, unknown>;
  /** MẠCH kiến thức — để gom nhóm/thu gọn đồ thị. */
  strand?: string;
}
export interface ViolationDto {
  code: string;
  severity: string;
  message: string;
  slugs: string[];
}
export interface GraphEdgeDto {
  from: string;
  to: string;
  mode: string;
  relType?: string;
  weight?: number;
}
export interface ObjectiveDto {
  slug: string;
  title: Record<string, string>;
  code?: string;
  mapsTo: string[];
}
export interface FrameworkMetaDto {
  slug: string;
  name: Record<string, string>;
  kind: string;
  locale: string;
}
export interface DraftIssueDto {
  code: string;
  severity: string;
  message: string;
}
export interface IngestResultDto {
  compiled: {
    graph: { nodes: GraphNodeDto[]; edges: GraphEdgeDto[] };
    objectives: ObjectiveDto[];
    framework?: FrameworkMetaDto;
  };
  issues: DraftIssueDto[];
  /** Cảnh báo pipeline (vd cạnh bị bỏ) — nuốt cảnh báo = mù. */
  warnings: string[];
  /** Vi phạm bất biến, XEM TRƯỚC khi ghi. */
  violations: ViolationDto[];
  blocking: boolean;
}

export interface CoursePlanDto {
  slug: string;
  title: Record<string, string>;
  objectives: string[];
  frameworkVersionId?: string;
  units: {
    slug: string;
    title: Record<string, string>;
    concepts: string[];
    lessons: { slug: string; title: Record<string, string>; teaches: string[] }[];
  }[];
}
export interface SavedCourseDto {
  slug: string;
  frameworkVersionId: string | null;
  status: string;
  plan: CoursePlanDto;
  /** Chỉ có khi sinh từ SÁCH: bài giữ đúng chỗ nhưng chưa map KC + cảnh báo OCR bị cắt. */
  bookReport?: {
    unmappedLessons: string[];
    truncated: boolean;
  };
}
export interface CourseListItemDto {
  slug: string;
  title: unknown;
  status: string;
  frameworkVersionId: string | null;
}

export interface ApplyResultDto {
  nodes: number;
  edges: number;
  framework?: { frameworkVersionId: string; objectives: number; mapsTo: number };
}

// ── Upload: PDF → media (presigned 3 bước) → URL đã ký để đưa cho AI ─────────
export async function uploadPdfAndGetUrl(file: File): Promise<string> {
  const mimeType = file.type || 'application/pdf';
  const { asset, upload } = await api.post<CreateAssetResult>('/media/assets', {
    kind: 'DOCUMENT',
    title: { vi: file.name },
    mimeType,
  });
  await uploadToSignedUrl(upload.url, file, { contentType: mimeType });
  const done = await api.post<MediaAssetDto>(`/media/assets/${asset.id}/complete`, {
    byteSize: file.size,
  });
  const url =
    done.renditions?.find((r) => r.kind === 'ORIGINAL')?.url ?? done.renditions?.[0]?.url ?? null;
  if (!url) throw new Error('Không lấy được URL của file đã tải lên.');
  return url;
}

// ── Framework ────────────────────────────────────────────────────────────────
export function useFrameworkFromPrompt() {
  return useMutation({
    mutationFn: (input: { topic: string; locale?: string }) =>
      api.post<IngestResultDto>('/authoring/framework/from-prompt', input),
  });
}

export function useFrameworkFromPdf() {
  return useMutation({
    mutationFn: async (input: { file: File; locale?: string }) => {
      const pdf = await uploadPdfAndGetUrl(input.file);
      return api.post<IngestResultDto>('/authoring/framework/from-pdf', {
        pdf,
        locale: input.locale ?? 'vi',
      });
    },
  });
}

/** Duyệt: ghi đồ thị + framework + objectives + MAPS_TO. */
export function useApplyFramework() {
  return useMutation({
    mutationFn: (compiled: IngestResultDto['compiled']) =>
      api.post<ApplyResultDto>('/authoring/apply', {
        nodes: compiled.graph.nodes,
        edges: compiled.graph.edges,
        ...(compiled.framework ? { framework: compiled.framework } : {}),
        ...(compiled.objectives.length ? { objectives: compiled.objectives } : {}),
      }),
  });
}

// ── Course shell ─────────────────────────────────────────────────────────────
/** Phạm vi chương trình chung cho sinh vỏ khoá — quyết định vốn KC được map (grade/stage). */
export interface CourseScopeInput {
  locale?: string;
  frameworkVersionId?: string;
  frameworkSlug?: string;
  stage?: string;
  strand?: string;
}

const scopeBody = (s: CourseScopeInput): Record<string, string> => ({
  locale: s.locale ?? 'vi',
  ...(s.frameworkVersionId ? { frameworkVersionId: s.frameworkVersionId } : {}),
  ...(s.frameworkSlug ? { frameworkSlug: s.frameworkSlug } : {}),
  ...(s.stage ? { stage: s.stage } : {}),
  ...(s.strand ? { strand: s.strand } : {}),
});

export function useCourseFromPrompt() {
  return useMutation({
    mutationFn: (input: CourseScopeInput & { brief: string }) =>
      api.post<SavedCourseDto>('/authoring/course/from-prompt', {
        brief: input.brief,
        ...scopeBody(input),
      }),
  });
}

export function useCourseFromBook() {
  return useMutation({
    mutationFn: async (input: CourseScopeInput & { file: File }) => {
      const pdf = await uploadPdfAndGetUrl(input.file);
      return api.post<SavedCourseDto>('/authoring/course/from-book', { pdf, ...scopeBody(input) });
    },
  });
}

export function useCourses() {
  return useQuery({
    queryKey: ['authoring', 'courses'],
    queryFn: () => api.get<CourseListItemDto[]>('/authoring/course'),
  });
}

// ── Giáo án (Instruction Plan) cho 1 bài ─────────────────────────────────────
export interface IssueDto {
  code: string;
  severity: string;
  message: string;
}
export interface LessonStepDto {
  slug: string;
  role: string;
  title: Record<string, string>;
  intent?: Record<string, string>;
  durationMin: number;
  deliveryKind: 'explainer' | 'content' | 'practice' | 'assessment' | 'reflection';
  /** Brief nội dung cụ thể — generator bám vào để không sinh chung chung. */
  brief?: Record<string, string>;
  mustCover?: Record<string, string>[];
  /** Bước phục vụ trạng thái người học nào (novice/gap/proficient/mastered); rỗng = mọi trạng thái. */
  forStates?: string[];
  primitiveKinds?: string[];
  itemCount?: number;
  band?: string;
}
/** Mỗi KC một chuỗi bước riêng (không gộp) — xếp theo tiên quyết. */
export interface KcArcDto {
  kc: string;
  title?: Record<string, string>;
  steps: LessonStepDto[];
}
export interface LessonPlanDto {
  slug: string;
  title: Record<string, string>;
  teaches: string[];
  knowledgePoints: {
    slug: string;
    targets: string[];
    misconceptions?: { id: string; type: string; wrong: Record<string, string> }[];
  }[];
  /** CẤU TRÚC bài — MỖI KC MỘT CHUỖI bước (explainer/content/practice/assessment/reflection). */
  kcArcs?: KcArcDto[];
}
export interface LessonPlanResultDto {
  plan: LessonPlanDto;
  quality: { issues: IssueDto[]; score: number; approvable: boolean };
}

export function useGenerateLessonPlan() {
  return useMutation({
    mutationFn: (input: { kcs: string[]; language?: string; level?: string }) =>
      api.post<LessonPlanResultDto>('/authoring/plan/generate', {
        kcs: input.kcs,
        language: input.language ?? 'vi',
        ...(input.level ? { level: input.level } : {}),
      }),
  });
}

// ── Nội dung 1 bài: HỌC (block) + ĐÁNH GIÁ (quiz) + ÔN TẬP (flashcard) ───────
export interface ItemDto {
  itemKey: string;
  primitiveKind: string;
  skills: string[];
}
export interface LessonContentDto {
  teaching: ItemDto[];
  review: ItemDto[];
  assessment: { items: ItemDto[]; issues: IssueDto[]; approvable: boolean };
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: (input: {
      lesson: { teaches: string[]; knowledgePoints: { targets: string[] }[] };
      level: string;
      language?: string;
    }) =>
      api.post<LessonContentDto>('/authoring/content/generate', {
        lesson: input.lesson,
        learner: { level: input.level, language: input.language ?? 'vi' },
      }),
  });
}

export function useApproveItems() {
  return useMutation({
    mutationFn: (itemKeys: string[]) =>
      api.post<{ approved: number }>('/authoring/content/approve', { itemKeys }),
  });
}

// ── PER-ITEM content: sinh từng cái → soát → duyệt/sinh lại/xoá. Đa ngôn ngữ. ──────────────────
export interface ContentItemDto {
  itemKey: string;
  skills: string[];
  difficulty: number;
  mode: string;
  measurable?: boolean;
  primitiveKind: string;
  lessonSlug?: string;
  payload: Record<string, unknown>;
  status: string; // DRAFT | NEEDS_REVIEW | APPROVED | PUBLISHED
}

const contentItemsQK = (skill?: string, lesson?: string) =>
  ['authoring', 'content-items', skill ?? '', lesson ?? ''] as const;

// Mô tả primitive (họ nào + học sinh làm gì) — để soạn giả hiểu trước khi sinh.
export interface PrimitiveInfoDto {
  kind: string;
  family: 'quiz' | 'kit' | 'block';
  canPreview: boolean;
  answerReady: boolean;
  label: { vi: string; en: string };
  desc: { vi: string; en: string } | null;
}
export function usePrimitiveInfos(kinds: string[], enabled = true) {
  const key = kinds.join(',');
  return useQuery({
    queryKey: ['authoring', 'primitive-info', key] as const,
    queryFn: () =>
      api.get<PrimitiveInfoDto[]>(`/authoring/primitive-info?kinds=${encodeURIComponent(key)}`),
    enabled: enabled && kinds.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** Toàn bộ palette primitive (2 họ) — để chọn loại hợp khi gợi ý của plan không đủ. */
export function useAllPrimitives(enabled = true) {
  return useQuery({
    queryKey: ['authoring', 'primitives-all'] as const,
    queryFn: () => api.get<PrimitiveInfoDto[]>('/authoring/primitives'),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export interface PrimitiveRecoDto {
  kind: string;
  reason: string;
  info: PrimitiveInfoDto;
}
/** Hệ GỢI Ý loại phù hợp cho một step (LLM đọc brief + catalogue) — khỏi dò 122 loại. */
export function useRecommendPrimitives() {
  return useMutation({
    mutationFn: (input: {
      kc: string;
      brief: string;
      representation?: string;
      band?: string;
      language?: string;
    }) => api.post<PrimitiveRecoDto[]>('/authoring/primitive-recommend', input),
  });
}

/** Item để SOÁT — lọc theo KC (skill) và/hoặc bài. */
export function useContentItems(skill?: string, lesson?: string, enabled = true) {
  return useQuery({
    queryKey: contentItemsQK(skill, lesson),
    queryFn: () => {
      const q = new URLSearchParams();
      if (skill) q.set('skill', skill);
      if (lesson) q.set('lesson', lesson);
      return api.get<ContentItemDto[]>(`/authoring/content/items?${q.toString()}`);
    },
    enabled: enabled && Boolean(skill || lesson),
  });
}

export interface GenOneItemInput {
  kc: string;
  primitiveKind: string;
  /** Khoá — để server rút misconceptions của KC từ kế hoạch bài (distractor nhắm đúng hiểu-sai). */
  courseSlug?: string;
  lessonSlug?: string;
  /** Bước (content step) sở hữu item — vào itemKey để tách item giữa các bước cùng KC (chống trùng). */
  stepSlug?: string;
  /** Brief step (grounding) — content bám đúng ý đồ step. */
  brief?: string;
  band?: string;
  languages?: string[];
  representation?: string;
  seq?: number;
  newItem?: boolean;
}

/** Sinh ĐÚNG 1 item; `inv` = phạm vi để nạp lại danh sách soát sau khi sinh. */
export function useGenOneItem(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenOneItemInput) =>
      api.post<ContentItemDto>('/authoring/content/item/generate', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  });
}

export function useDeleteItem(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemKey: string) =>
      api.post<{ deleted: string }>('/authoring/content/item/delete', { itemKey }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  });
}

/** Duyệt item (giữ nguyên KC+lesson) + nạp lại danh sách soát. */
export function useApproveItemsFor(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemKeys: string[]) =>
      api.post<{ approved: number }>('/authoring/content/approve', { itemKeys }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) }),
  });
}

// ── MEDIA per-item: MỖI Ô có nhãn rõ + preview + duyệt/từ chối/sinh lại (ảnh vật kit, minh hoạ, đáp án A/B/C…) ─
export interface MediaSlotDto {
  path: string;
  kind: 'image' | 'audio';
  slot: string;
  label: { vi: string; en: string };
  query: string;
  asUrl: boolean;
  current: string | null;
}
export interface GenAssetDto {
  id: string;
  title?: Record<string, string>;
  renditions?: { url: string | null }[];
}

const itemMediaQK = (itemKey: string) => ['authoring', 'item-media', itemKey] as const;

/** Tất cả ô media của item (ảnh + audio), có nhãn + giá trị đang gắn — để render vòng soát per-slot. */
export function useItemMediaSlots(itemKey: string, enabled = true) {
  return useQuery({
    queryKey: itemMediaQK(itemKey),
    queryFn: () =>
      api.get<{ slots: MediaSlotDto[] }>(
        `/authoring/content/item/media-targets?itemKey=${encodeURIComponent(itemKey)}`,
      ),
    enabled: enabled && Boolean(itemKey),
  });
}

export function useAttachItemMedia(inv: { skill?: string; lesson?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: { itemKey: string; path: string; assetId: string; asUrl?: boolean }) =>
      api.post<ContentItemDto>('/authoring/content/item/media', i),
    onSuccess: (_d, i) => {
      void qc.invalidateQueries({ queryKey: contentItemsQK(inv.skill, inv.lesson) });
      void qc.invalidateQueries({ queryKey: itemMediaQK(i.itemKey) });
    },
  });
}

// ── SINH MEDIA NỀN: sinh 1 ảnh/audio tốn ~15–30s → API trả 202 + job; client POLL đến 'done' ──────
// Vì sao KHÔNG đồng bộ: giữ socket suốt 15–30s bị proxy dev Next cắt → "Internal Server Error" DÙ asset
// đã tạo + vào thư viện. Job nền + poll nhanh né hẳn (giống job sinh kế hoạch).
export type MediaJobState = 'running' | 'done' | 'error' | 'cancelled';
export type MediaJobKind = 'image' | 'audio';
/** Kết quả đã serialize: ảnh → {count,assets}; audio → 1 asset. Chỉ có khi state='done'. */
export type MediaJobResult = { count: number; assets: GenAssetDto[] } | GenAssetDto | null;
export interface MediaJobDto {
  id: string;
  kind: MediaJobKind;
  state: MediaJobState;
  etaMs?: number;
  result?: MediaJobResult;
  error?: string;
}

/** Rút asset đầu tiên từ result của job (ảnh lấy assets[0], audio là chính nó). */
export function mediaJobAsset(r: MediaJobResult | undefined): GenAssetDto | null {
  if (!r) return null;
  if ('assets' in r) return r.assets[0] ?? null;
  return r;
}

// ── ĐỘ DÀY NGÂN HÀNG (rich bank) cho 1 KC: đích (rep×band×misconception) vs bank hiện có → còn thiếu ──
export interface DensityRowDto {
  slot: { representation: string; band: string; misconceptionId?: string; count: number };
  have: number;
  need: number;
}
export interface DensityDto {
  kc: string;
  richness: string;
  representations: string[];
  targetTotal: number;
  have: number;
  gapTotal: number;
  coverage: DensityRowDto[];
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
  });
}

/** Khởi động sinh ẢNH (openai) → trả job đang chạy (id để poll). */
export function useStartGenImage() {
  return useMutation({
    mutationFn: (i: { prompt: string; count?: number }) =>
      api.post<MediaJobDto>('/media/generate/image', i),
  });
}

/** Khởi động sinh ÂM THANH (elevenlabs) từ text → trả job đang chạy. */
export function useStartGenAudio() {
  return useMutation({
    mutationFn: (i: { text: string; languageCode?: string }) =>
      api.post<MediaJobDto>('/media/generate/audio', i),
  });
}

/** Poll trạng thái job sinh media theo id; chỉ lặp khi 'running', tự dừng khi kết thúc. */
export function useMediaJob(jobId: string | null) {
  return useQuery({
    queryKey: ['authoring', 'media-job', jobId] as const,
    queryFn: () => api.get<MediaJobDto>(`/media/generate/job/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 1500 : false),
  });
}

/** Hủy job sinh media đang chạy (abort provider call thật). */
export function useCancelMediaJob() {
  return useMutation({
    mutationFn: (jobId: string) => api.post<MediaJobDto>(`/media/generate/job/${jobId}/cancel`, {}),
  });
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
  });
}

// ── Bước tách rời: PDF → text → khung (để UI hiện tiến trình từng chặng) ─────
export function useExtractText() {
  return useMutation({
    mutationFn: async (file: File) => {
      const pdf = await uploadPdfAndGetUrl(file);
      return api.post<{ text: string; chars: number }>('/authoring/source/extract-text', { pdf });
    },
  });
}

export function useFrameworkFromText() {
  return useMutation({
    mutationFn: (input: { text: string; locale?: string }) =>
      api.post<IngestResultDto>('/authoring/framework/from-text', {
        text: input.text,
        locale: input.locale ?? 'vi',
      }),
  });
}

// ── Quản lý Framework ────────────────────────────────────────────────────────
export interface FrameworkListItemDto {
  slug: string;
  name: Record<string, string>;
  kind: string;
  locale: string;
  versions: number;
  objectives: number;
  updatedAt: string;
}
export interface FrameworkVersionDto {
  id: string;
  semver: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  objectives: number;
}
export interface FrameworkDetailDto {
  slug: string;
  name: Record<string, string>;
  kind: string;
  locale: string;
  versions: FrameworkVersionDto[];
  objectives: {
    slug: string;
    title: Record<string, string>;
    code: string | null;
    versionId: string | null;
  }[];
}
export interface GraphViewDto {
  nodes: {
    id: string;
    slug: string;
    title: Record<string, string>;
    kind: string;
    strand?: string;
  }[];
  edges: { from: string; to: string; relType: string; mode: string }[];
}

const fwKeys = {
  all: ['authoring', 'frameworks'] as const,
  one: (slug: string) => ['authoring', 'framework', slug] as const,
  graph: (slug: string) => ['authoring', 'framework', slug, 'graph'] as const,
};

export function useFrameworks() {
  return useQuery({
    queryKey: fwKeys.all,
    queryFn: () => api.get<FrameworkListItemDto[]>('/authoring/framework'),
  });
}

export function useFramework(slug: string) {
  return useQuery({
    queryKey: fwKeys.one(slug),
    queryFn: () => api.get<FrameworkDetailDto>(`/authoring/framework/${slug}`),
  });
}

export function useFrameworkGraph(slug: string) {
  return useQuery({
    queryKey: fwKeys.graph(slug),
    queryFn: () => api.get<GraphViewDto>(`/authoring/framework/${slug}/graph`),
  });
}

export function useCreateVersion(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (release: 'MAJOR' | 'MINOR' | 'PATCH') =>
      api.post<FrameworkVersionDto>(`/authoring/framework/${slug}/version`, { release }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fwKeys.one(slug) }),
  });
}

export function usePublishVersion(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      api.post<{ published: string; deprecated: number }>(
        `/authoring/framework/version/${versionId}/publish`,
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: fwKeys.one(slug) }),
  });
}

// ── Quản lý Course ───────────────────────────────────────────────────────────
export function useCourse(slug: string) {
  return useQuery({
    queryKey: ['authoring', 'course', slug],
    queryFn: () => api.get<SavedCourseDto>(`/authoring/course/${slug}`),
  });
}

export function useSetCourseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: string }) =>
      api.patch<{ slug: string; status: string }>(`/authoring/course/${slug}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring'] }),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.del<{ deleted: string }>(`/authoring/course/${slug}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring', 'courses'] }),
  });
}

// ── ĐỐI CHIẾU khung #2 vào vốn KC canonical ──────────────────────────────────
export type AlignVerdict = 'SAME' | 'SUBSET' | 'SUPERSET' | 'OVERLAP' | 'NEW' | 'UNKNOWN';

export interface AlignProposalDto {
  tempId: string;
  title: string;
  /** Slug do SERVER mint (chống trùng toàn đồ thị) — client KHÔNG được tự chế. */
  slug: string;
  kind: string;
  subject?: string;
  /** Facets phải đi cùng: thiếu nó thì KC ghi ra sẽ vô danh, vi phạm I8, và lần đối chiếu sau mù. */
  facets?: Record<string, unknown>;
  target?: string;
  targetTitle?: string;
  decision: { verdict: AlignVerdict; axes: string[]; reason: string; decidedBy: string };
  needsHuman: boolean;
}
export interface AlignReportDto {
  proposals: AlignProposalDto[];
  summary: Record<string, number>;
  needsHuman: number;
  warnings: string[];
}

export function useAlignSource() {
  return useMutation({
    mutationFn: (input: { text: string; subject?: string; locale?: string }) =>
      api.post<AlignReportDto>('/authoring/framework/align', {
        text: input.text,
        locale: input.locale ?? 'en',
        ...(input.subject ? { subject: input.subject } : {}),
      }),
  });
}

export interface AlignDecisionDto {
  slug: string;
  title: Record<string, string>;
  kind: string;
  subject?: string;
  facets?: Record<string, unknown>;
  verdict: AlignVerdict;
  target?: string;
  /** Máy đề xuất gì — gửi kèm để lưu audit và đo được người sửa máy ở đâu. */
  proposedVerdict?: AlignVerdict;
  proposedBy?: string;
  proposedReason?: string;
}

export interface AlignHistoryRow {
  id: string;
  sourceSlug: string;
  sourceTitle: Record<string, string>;
  targetSlug: string | null;
  verdict: AlignVerdict;
  proposedVerdict: AlignVerdict | null;
  proposedBy: string | null;
  proposedReason: string | null;
  overridden: boolean;
  decidedBy: string | null;
  createdAt: string;
}

/** Lịch sử đối chiếu — quyết định GỘP là vĩnh viễn, đây là chỗ duy nhất truy được "ai chốt, vì sao". */
export function useAlignHistory() {
  return useQuery({
    queryKey: ['authoring', 'align-history'],
    queryFn: () => api.get<AlignHistoryRow[]>('/authoring/framework/align/history'),
  });
}

export function useApplyAlignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (decisions: AlignDecisionDto[]) =>
      api.post<{ reused: number; created: number; prerequisite: number; aligns: number }>(
        '/authoring/framework/align/apply',
        { decisions },
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['authoring'] }),
  });
}

// ── ĐỘ PHỦ 2 CHIỀU: khung ↕ KC ↕ khoá ────────────────────────────────────────
export interface CoverageDto {
  frameworkSlug: string;
  courseSlug: string;
  objectives: {
    slug: string;
    title: string;
    kind: string;
    code?: string;
    stage?: string;
    strand?: string;
  }[];
  kcs: {
    slug: string;
    title: string;
    kind: string;
    facets?: Record<string, unknown>;
    strand?: string;
  }[];
  lessons: { slug: string; title: string; unit: string; teaches: string[] }[];
  edges: { from: string; to: string; relType: string }[];
  objectiveCoverage: {
    slug: string;
    code?: string;
    title: string;
    requires: string[];
    taught: string[];
    status: 'full' | 'partial' | 'none';
  }[];
  untetheredKcs: string[];
  summary: {
    objectivesFull: number;
    objectivesPartial: number;
    objectivesNone: number;
    kcsTaught: number;
    kcsTotal: number;
  };
}

export function useCoverage(framework: string, course: string) {
  return useQuery({
    queryKey: ['authoring', 'coverage', framework, course],
    queryFn: () => api.get<CoverageDto>(`/authoring/coverage/${framework}/${course}`),
    enabled: Boolean(framework && course),
  });
}

// ── KẾ HOẠCH PHÂN CẤP: Khoá → Unit → Bài, mỗi cấp có trạng thái DUYỆT ──────────
export type PlanLevel = 'course' | 'unit' | 'lesson';

export interface HierQualityDto {
  issues: { code: string; severity: 'error' | 'warning'; message: string }[];
  score: number;
  approvable: boolean;
}
export interface StoredPlanDto {
  level: PlanLevel;
  refSlug: string;
  doc: Record<string, unknown>;
  status: string; // DRAFT | APPROVED
  version: number;
  quality: HierQualityDto | null;
  approvedBy: string | null;
}

/** Cây kế hoạch của khoá — mọi cấp + trạng thái duyệt (để gate UI). */
export function useCoursePlans(courseSlug: string) {
  return useQuery({
    queryKey: ['authoring', 'plans', courseSlug],
    queryFn: () => api.get<StoredPlanDto[]>(`/authoring/plan/course/${courseSlug}`),
    enabled: Boolean(courseSlug),
  });
}

// ── DERIVED INSIGHTS: KC theo LOẠI (knowledge/skill/…), mục tiêu, tiên quyết — TÍNH từ graph ────────
export interface KcRefDto {
  slug: string;
  title: Record<string, string>;
  kind: string;
}
export interface KindGroupDto {
  kind: string;
  items: KcRefDto[];
}
export interface MisconceptionRefDto {
  kc: string;
  type: string;
  wrong: Record<string, string>;
  lessonSlug: string;
}
export interface EvidenceRefDto {
  concept: string;
  title: Record<string, string>;
  itemCount: number;
  modes: string[];
  lessons: string[];
}
export interface LevelInsightsDto {
  level: PlanLevel;
  refSlug: string;
  kcCount: number;
  byKind: KindGroupDto[];
  objectives: KcRefDto[];
  prerequisites: KcRefDto[];
  misconceptions: MisconceptionRefDto[];
  evidence: EvidenceRefDto[];
}

/** Dẫn xuất từ graph cho một cấp — không author, luôn phản ánh graph hiện tại. Cache 60s. */
export function useLevelInsights(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['authoring', 'insights', courseSlug, level, refSlug],
    queryFn: () =>
      api.get<LevelInsightsDto>(
        `/authoring/plan/course/${courseSlug}/insights?level=${level}&ref=${encodeURIComponent(refSlug)}`,
      ),
    enabled: enabled && Boolean(courseSlug && refSlug),
    staleTime: 60_000,
  });
}

// ── JOB SINH NỀN: sinh 1 kế hoạch ~2 phút → API trả 202 + job; client POLL trạng thái ──────────
// Reload vẫn nối lại (job theo tiến trình API, không theo trình duyệt): poll on-mount theo (level,ref).
export type PlanJobState = 'idle' | 'running' | 'done' | 'error' | 'cancelled';
export interface PlanJobDto {
  key?: string;
  level: PlanLevel;
  refSlug: string;
  state: PlanJobState;
  startedAt?: number;
  finishedAt?: number;
  /** Ước lượng ms để vẽ thanh tiến trình (server gợi ý theo cấp). */
  etaMs?: number;
  error?: string;
}

const planJobQK = (courseSlug: string, level: PlanLevel, refSlug: string) =>
  ['authoring', 'plan-job', courseSlug, level, refSlug] as const;
const plansQK = (courseSlug: string) => ['authoring', 'plans', courseSlug] as const;

/**
 * Poll job sinh cho (level, ref). Bật sẵn khi mount (bắt được job đang chạy sau khi reload); chỉ lặp
 * khi state='running', tự dừng khi kết thúc. Job vừa 'done' → nạp lại cây kế hoạch để hiện plan mới.
 */
export function usePlanJob(courseSlug: string, level: PlanLevel, refSlug: string, enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: planJobQK(courseSlug, level, refSlug),
    queryFn: () =>
      api.get<PlanJobDto>(
        `/authoring/plan/course/${courseSlug}/job?level=${level}&ref=${encodeURIComponent(refSlug)}`,
      ),
    enabled: enabled && Boolean(courseSlug && refSlug),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 2500 : false),
  });
  // Chuyển sang trạng thái kết thúc: 'done' thì nạp lại danh sách kế hoạch (một lần mỗi lần đổi state).
  const prev = useRef<PlanJobState | undefined>(undefined);
  useEffect(() => {
    const s = q.data?.state;
    if (s && s !== prev.current) {
      if (s === 'done') void qc.invalidateQueries({ queryKey: plansQK(courseSlug) });
      prev.current = s;
    }
  }, [q.data?.state, courseSlug, qc]);
  return q;
}

export function useCancelPlanJob(courseSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { level: PlanLevel; refSlug: string }) =>
      api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/job/cancel`, input),
    onSuccess: (_d, input) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, input.level, input.refSlug) }),
  });
}

export function useGenCoursePlan(courseSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/generate`, {}),
    // Job vừa khởi động → nạp trạng thái job ngay để thanh tiến trình chạy.
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'course', courseSlug) }),
  });
}

export function useGenUnitPlan(courseSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitSlug: string) =>
      api.post<PlanJobDto>(`/authoring/plan/course/${courseSlug}/unit/${unitSlug}/generate`, {}),
    onSuccess: (_d, unitSlug) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'unit', unitSlug) }),
  });
}

export function useApprovePlan(courseSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { level: PlanLevel; refSlug: string }) =>
      api.post<StoredPlanDto>(`/authoring/plan/course/${courseSlug}/approve`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: plansQK(courseSlug) }),
  });
}

/** Sinh kế hoạch BÀI trong khoá (gate: unit đã duyệt) — grounding + lưu; job nền + poll. */
export function useGenLessonPlanInCourse(courseSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { lessonSlug: string; level?: string }) =>
      api.post<PlanJobDto>(
        `/authoring/plan/course/${courseSlug}/lesson/${input.lessonSlug}/generate` +
          (input.level ? `?level=${encodeURIComponent(input.level)}` : ''),
        {},
      ),
    onSuccess: (_d, input) =>
      void qc.invalidateQueries({ queryKey: planJobQK(courseSlug, 'lesson', input.lessonSlug) }),
  });
}
