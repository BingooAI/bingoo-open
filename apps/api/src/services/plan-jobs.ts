// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * REGISTRY JOB SINH KẾ HOẠCH — chạy nền, client poll trạng thái.
 *
 * Vì sao: sinh 1 kế hoạch tốn ~1.5–2 phút (một LLM call dài). Giữ socket đồng bộ suốt thời gian đó
 * sẽ bị proxy/LB cắt ("socket hang up") DÙ server vẫn hoàn tất và đã lưu plan → người dùng thấy lỗi
 * oan. Nên: kick off nền, trả 202 ngay, client POLL theo KEY (course/level/ref).
 *
 * Hệ quả tốt:
 *  · RELOAD vẫn nối lại được — job sống trong tiến trình API, không theo trình duyệt; client chỉ cần
 *    poll lại theo key khi mount.
 *  · HỦY thật — mỗi job giữ một AbortController luồn xuống LLM call (không phải hủy giả ở client).
 *  · Chống double — cùng key đang chạy thì trả job hiện có, không sinh trùng.
 *
 * Phạm vi: in-memory, đủ cho 1 instance (dev/single-node). Đa-instance sau này thay bằng store dùng
 * chung (Redis/DB) — HỢP ĐỒNG (key + poll status + cancel) giữ nguyên, chỉ đổi nơi lưu.
 */

import { AppError } from '../lib/errors'

export type PlanJobState = 'running' | 'done' | 'error' | 'cancelled'
export type PlanLevel = 'course' | 'unit' | 'lesson'

/** Bản CHIẾU an toàn để trả cho client (không lộ AbortController). */
export interface PlanJobView {
  readonly key: string
  readonly level: PlanLevel
  readonly refSlug: string
  readonly state: PlanJobState
  readonly startedAt: number
  readonly finishedAt?: number
  /** Ước lượng thời gian (ms) để client vẽ thanh tiến trình — KHÔNG ảnh hưởng logic. */
  readonly etaMs: number
  /** Thông điệp lỗi người đọc được (đã bóc từ details), chỉ khi state='error'. */
  readonly error?: string
}

interface PlanJob extends Omit<PlanJobView, 'error'> {
  state: PlanJobState
  finishedAt?: number
  error?: string
  readonly controller: AbortController
}

const jobs = new Map<string, PlanJob>()

/** ETA vẽ progress theo cấp — bài giàu (kcArcs) lâu hơn khoá/unit. Chỉ để hiển thị. */
const ETA_BY_LEVEL: Record<PlanLevel, number> = {
  course: 90_000,
  unit: 90_000,
  lesson: 120_000,
}

export function planJobKey(courseSlug: string, level: PlanLevel, refSlug: string): string {
  return `${courseSlug}::${level}::${refSlug}`
}

const view = (j: PlanJob): PlanJobView => ({
  key: j.key,
  level: j.level,
  refSlug: j.refSlug,
  state: j.state,
  startedAt: j.startedAt,
  etaMs: j.etaMs,
  ...(j.finishedAt !== undefined ? { finishedAt: j.finishedAt } : {}),
  ...(j.error !== undefined ? { error: j.error } : {}),
})

export function getPlanJob(courseSlug: string, level: PlanLevel, refSlug: string): PlanJobView | undefined {
  const j = jobs.get(planJobKey(courseSlug, level, refSlug))
  return j ? view(j) : undefined
}

/**
 * Lỗi → thông điệp NGƯỜI ĐỌC ĐƯỢC. Lỗi validation/gate mang lý do thật ở details[].message (title
 * chỉ là "Validation failed"); ta bóc ra đúng như client làm, để job.error nói được VÌ SAO.
 */
function humanError(e: unknown): string {
  if (e instanceof AppError && Array.isArray(e.details)) {
    const msgs = (e.details as unknown[])
      .map((d) =>
        d && typeof d === 'object' && 'message' in d ? String((d as { message: unknown }).message ?? '') : '',
      )
      .map((s) => s.trim())
      .filter(Boolean)
    if (msgs.length) return msgs.join(' ')
  }
  return e instanceof Error ? e.message : String(e)
}

/**
 * Bắt đầu (hoặc trả lại) job cho KEY. Nếu đang chạy → trả job hiện có (idempotent). `fn` nhận signal
 * để luồn vào LLM call. KHÔNG await `fn` — chạy nền; kết quả (plan) do chính service lưu xuống DB, nên
 * client chỉ cần nạp lại danh sách kế hoạch khi job 'done'.
 */
export function startPlanJob(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
  fn: (signal: AbortSignal) => Promise<unknown>,
): PlanJobView {
  const key = planJobKey(courseSlug, level, refSlug)
  const existing = jobs.get(key)
  if (existing?.state === 'running') return view(existing)

  const controller = new AbortController()
  const job: PlanJob = {
    key,
    level,
    refSlug,
    state: 'running',
    startedAt: Date.now(),
    etaMs: ETA_BY_LEVEL[level],
    controller,
  }
  jobs.set(key, job)

  fn(controller.signal)
    .then(() => {
      job.state = 'done'
      job.finishedAt = Date.now()
    })
    .catch((e: unknown) => {
      const aborted = controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')
      job.state = aborted ? 'cancelled' : 'error'
      job.finishedAt = Date.now()
      if (!aborted) job.error = humanError(e)
    })

  return view(job)
}

/** HỦY job đang chạy (abort LLM). Trả job (đã/đang chuyển 'cancelled') hoặc undefined nếu không có. */
export function cancelPlanJob(
  courseSlug: string,
  level: PlanLevel,
  refSlug: string,
): PlanJobView | undefined {
  const key = planJobKey(courseSlug, level, refSlug)
  const j = jobs.get(key)
  if (!j) return undefined
  if (j.state === 'running') j.controller.abort()
  return view(j)
}
