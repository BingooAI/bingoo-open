/**
 * Máy trạng thái pipeline biên soạn S1→S7 (KE-HOACH-AUTHORING / KE-HOACH-CONTENT).
 * Mỗi bước: chia nhỏ · phê duyệt · tái sinh · tự STALE khi thượng nguồn đổi version.
 * Thuần, tất định — KHÔNG I/O, KHÔNG LLM (adapter/persist ở apps/api).
 */

/** 7 chặng của nhà máy: nhập liệu → khung → vỏ khoá → giáo án → nội dung → đề đo → phát hành. */
export type Stage = 'ingest' | 'framework' | 'course_shell' | 'plans' | 'content' | 'assessment' | 'publish'

export const STAGE_ORDER: readonly Stage[] = [
  'ingest',
  'framework',
  'course_shell',
  'plans',
  'content',
  'assessment',
  'publish',
]

export type StepStatus =
  | 'draft' // chưa sinh
  | 'generating' // đang sinh (LLM/vision chạy)
  | 'needs_review' // đã sinh, chờ người duyệt
  | 'approved' // đã duyệt — nguồn tin cho hạ nguồn
  | 'stale' // thượng nguồn đã đổi, cần tái sinh
  | 'failed' // sinh lỗi

export type StepEvent =
  | 'generate' // bắt đầu/tái chạy sinh
  | 'complete' // sinh xong → chờ duyệt
  | 'fail' // sinh lỗi
  | 'approve' // duyệt (bump version)
  | 'reject' // trả về draft
  | 'regenerate' // duyệt rồi vẫn muốn làm lại
  | 'invalidate' // đánh dấu stale (do thượng nguồn)

export interface PipelineStep {
  readonly id: string
  readonly stage: Stage
  readonly status: StepStatus
  /** Tăng mỗi lần approve — hạ nguồn ghim theo số này để phát hiện lệch. */
  readonly version: number
  /** Các step thượng nguồn mà step này tiêu thụ. */
  readonly parents: readonly string[]
  /** parentId → version đã dùng khi sinh step này. */
  readonly builtFrom: Readonly<Record<string, number>>
}
