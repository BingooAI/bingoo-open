/**
 * REGISTRY JOB SINH MEDIA (ảnh/audio) — chạy nền, client poll trạng thái.
 *
 * Vì sao: sinh 1 ảnh OpenAI / 1 audio ElevenLabs tốn ~15–30s. Giữ socket đồng bộ suốt thời gian đó bị
 * proxy dev của Next cắt → client thấy "Internal Server Error" DÙ asset ĐÃ tạo xong + vào thư viện.
 * Nên: kick off nền, trả 202 ngay kèm jobId, client POLL theo id đến khi 'done' rồi đọc `result`.
 *
 * Khác plan-jobs:
 *  · KEY = id ngẫu nhiên, không phải khoá bền (course/level/ref) — mỗi lần sinh media là một yêu cầu
 *    rời (prompt/text tuỳ ô), không cần chống-double theo khoá ngữ nghĩa, không cần reload-reconnect
 *    (asset vẫn nằm trong thư viện; ứng viên đang chờ duyệt là trạng thái tạm ở client).
 *  · Job MANG kết quả (`result`) — client cần đúng asset vừa sinh để preview + gắn vào ô media. Plan-jobs
 *    thì service tự lưu plan xuống DB nên client chỉ nạp lại theo khoá; media không có khoá bền như vậy.
 *
 * HỦY thật: mỗi job giữ một AbortController luồn xuống provider call (image/tts adapter nhận `signal`),
 * không phải hủy giả ở client.
 *
 * Phạm vi: in-memory, đủ cho 1 instance (dev/single-node). Đa-instance sau này thay bằng store dùng chung.
 */

export type MediaJobState = 'running' | 'done' | 'error' | 'cancelled'
export type MediaJobKind = 'image' | 'audio'

/** Bản CHIẾU an toàn trả cho client (không lộ AbortController). `result` chỉ có khi state='done'. */
export interface MediaJobView<R = unknown> {
  readonly id: string
  readonly kind: MediaJobKind
  readonly state: MediaJobState
  readonly startedAt: number
  readonly finishedAt?: number
  /** Ước lượng ms để client vẽ thanh tiến trình — KHÔNG ảnh hưởng logic. */
  readonly etaMs: number
  /** Kết quả đã serialize (image: {count,assets}; audio: asset) — chỉ khi 'done'. */
  readonly result?: R
  /** Thông điệp lỗi người đọc được — chỉ khi 'error'. */
  readonly error?: string
}

interface MediaJob extends Omit<MediaJobView, 'error' | 'result'> {
  state: MediaJobState
  finishedAt?: number
  result?: unknown
  error?: string
  readonly controller: AbortController
}

const jobs = new Map<string, MediaJob>()

/** ETA vẽ progress theo loại — ảnh (OpenAI) lâu hơn audio. Chỉ để hiển thị. */
const ETA_BY_KIND: Record<MediaJobKind, number> = {
  image: 30_000,
  audio: 20_000,
}

const view = (j: MediaJob): MediaJobView => ({
  id: j.id,
  kind: j.kind,
  state: j.state,
  startedAt: j.startedAt,
  etaMs: j.etaMs,
  ...(j.finishedAt !== undefined ? { finishedAt: j.finishedAt } : {}),
  ...(j.result !== undefined ? { result: j.result } : {}),
  ...(j.error !== undefined ? { error: j.error } : {}),
})

export function getMediaJob(id: string): MediaJobView | undefined {
  const j = jobs.get(id)
  return j ? view(j) : undefined
}

/**
 * Bắt đầu một job sinh media. `fn` nhận signal để luồn vào provider call; giá trị nó trả về (DTO đã
 * serialize) được lưu vào `job.result` khi 'done'. KHÔNG await `fn` — chạy nền, trả view ngay.
 */
export function startMediaJob<R>(
  kind: MediaJobKind,
  id: string,
  fn: (signal: AbortSignal) => Promise<R>,
): MediaJobView {
  const controller = new AbortController()
  const job: MediaJob = {
    id,
    kind,
    state: 'running',
    startedAt: Date.now(),
    etaMs: ETA_BY_KIND[kind],
    controller,
  }
  jobs.set(id, job)

  fn(controller.signal)
    .then((result) => {
      job.state = 'done'
      job.finishedAt = Date.now()
      job.result = result
    })
    .catch((e: unknown) => {
      const aborted = controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')
      job.state = aborted ? 'cancelled' : 'error'
      job.finishedAt = Date.now()
      if (!aborted) job.error = e instanceof Error ? e.message : String(e)
    })

  return view(job)
}

/** HỦY job đang chạy (abort provider call). Trả job hoặc undefined nếu không có id đó. */
export function cancelMediaJob(id: string): MediaJobView | undefined {
  const j = jobs.get(id)
  if (!j) return undefined
  if (j.state === 'running') j.controller.abort()
  return view(j)
}
