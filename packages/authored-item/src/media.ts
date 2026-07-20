/**
 * HỢP ĐỒNG MEDIA per-item — THUẦN, không I/O. Nói CẦN media gì cho một item + ĐIỀU PHỐI resolve, nhưng
 * việc sinh/tìm thật (search thư viện · vision · TTS) được TIÊM VÀO (`resolve`) nên test được offline.
 *
 * Vì sao tách: mỗi primitive có ô media (câu hỏi + TỪNG đáp án: image/audio; content block image/video/
 * audio). Media tham chiếu qua `assetId` (thư viện) hoặc `src`/`image` (URL) — thiếu CẢ HAI mà có ý định
 * media = CHƯA RESOLVE. Bộ trích tìm ĐÚNG ô chưa resolve + `dedupKey` để TÁI DÙNG (không sinh lại "quả
 * táo đỏ" hai lần). Bước resolve thật (I/O) nằm ở apps/api và được truyền vào đây.
 *
 * ĐỘNG theo CẤU TRÚC payload + POLICY (đọc-to / đáp-án-tranh theo lứa tuổi), KHÔNG gõ tay từng primitive.
 */

import type { AuthoredItem } from './model'

export type MediaKind = 'image' | 'audio' | 'video'

export interface MediaTarget {
  /** Đường ĐẦY ĐỦ tới trường sẽ điền assetId (vd "assetId" · "media.assetId" · "choices[2].audio.assetId"). */
  readonly path: string
  readonly kind: MediaKind
  /** Câu truy vấn tìm/sinh (alt của block · nhãn đáp án · prompt câu hỏi). */
  readonly query: string
  /** kind + query chuẩn hoá → khoá TÁI DÙNG trong hồ media chung. */
  readonly dedupKey: string
}

/**
 * Chính sách media theo sư phạm/đối tượng (DỮ LIỆU, không cứng):
 *  - readAloud: thêm audio đọc-to cho prompt + nhãn đáp án (học viên nhỏ nghe thay vì đọc).
 *  - pictureChoices: thêm ảnh cho đáp án chỉ-có-chữ (biểu diễn concrete / mầm non).
 */
export interface MediaPolicy {
  readonly readAloud?: boolean
  readonly pictureChoices?: boolean
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** Chuẩn hoá query cho dedup — cùng mô tả → cùng khoá → tái dùng asset. */
export function mediaDedupKey(kind: MediaKind, query: string): string {
  return `${kind}:${query.trim().replace(/\s+/g, ' ').toLowerCase()}`
}

const target = (path: string, kind: MediaKind, query: string): MediaTarget => ({
  path,
  kind,
  query,
  dedupKey: mediaDedupKey(kind, query),
})

/** Một node media đã resolve chưa (có assetId hoặc src/image URL)? */
const resolved = (o: Record<string, unknown>): boolean =>
  Boolean(
    str(o.assetId) ||
    str(o.src) ||
    str(o.image) ||
    str(o.imageAssetId) ||
    str(o.audioAssetId) ||
    str(o.audioSrc),
  )

/**
 * Danh sách media CẦN RESOLVE cho một item, theo policy. Chỉ trả ô có Ý ĐỊNH media mà CHƯA có nguồn —
 * đã có emoji/assetId/src thì bỏ qua (không ép sinh thừa).
 */
export function mediaTargets(item: AuthoredItem, policy: MediaPolicy = {}): MediaTarget[] {
  const out: MediaTarget[] = []
  const p = rec(item.payload)
  const type = str(p.type)

  // ── Content block media: image/video/audio block có alt/caption mà chưa có nguồn. ──
  if (type === 'image' || type === 'video' || type === 'audio') {
    if (!resolved(p)) {
      const q = str(p.alt) ?? str(p.caption)
      if (q) out.push(target('assetId', type, q))
    }
    return out
  }

  // ── Quiz: prompt đọc-to + từng đáp án (ảnh/đọc-to). ──
  const prompt = str(p.prompt)
  if (policy.readAloud && prompt && !resolved(rec(p.media)))
    out.push(target('media.assetId', 'audio', prompt))

  const choices = Array.isArray(p.choices) ? p.choices : []
  choices.forEach((c, i) => {
    const co = rec(c)
    const label = str(co.label)
    const hasPicture = Boolean(str(co.emoji) || str(co.image) || str(co.imageAssetId))
    const hasAudio = resolved(rec(co.audio))
    if (policy.pictureChoices && label && !hasPicture)
      out.push(target(`choices[${i}].imageAssetId`, 'image', label))
    if (policy.readAloud && label && !hasAudio)
      out.push(target(`choices[${i}].audio.assetId`, 'audio', label))
  })

  return out
}

// ── ÁP asset đã resolve vào payload (thuần, immutable) ───────────────────────

/** Token đường dẫn: "a.b" · "choices[2].x" → ['a','b'] / ['choices',2,'x']. */
function parsePath(path: string): (string | number)[] {
  const out: (string | number)[] = []
  for (const seg of path.split('.')) {
    const m = seg.matchAll(/([^[\]]+)|\[(\d+)\]/g)
    for (const g of m) {
      if (g[1] !== undefined) out.push(g[1])
      else if (g[2] !== undefined) out.push(Number(g[2]))
    }
  }
  return out
}

/** Set immutable một giá trị vào đường dẫn, TẠO node trung gian nếu thiếu (media/audio có thể chưa có). */
export function applyMediaAsset(payload: unknown, path: string, assetId: string): unknown {
  const keys = parsePath(path)
  const set = (node: unknown, i: number): unknown => {
    const key = keys[i]
    if (key === undefined) return assetId
    if (typeof key === 'number') {
      const arr = Array.isArray(node) ? [...node] : []
      arr[key] = set(arr[key], i + 1)
      return arr
    }
    const obj = { ...rec(node) }
    obj[key] = set(obj[key], i + 1)
    return obj
  }
  return set(payload, 0)
}

export interface ResolveResult {
  /** Payload đã gắn assetId cho các ô resolve được. */
  readonly payload: unknown
  /** Số ô đã điền (resolve thành công). */
  readonly filled: number
  /** Ô resolve KHÔNG được (resolve trả null) — để báo/soát. */
  readonly unresolved: readonly MediaTarget[]
}

/**
 * ĐIỀU PHỐI resolve — thuần, DEDUP bằng cache theo `dedupKey` (một mô tả chỉ tìm/sinh MỘT LẦN, rồi tái
 * dùng cho mọi ô cùng mô tả). `resolve` là I/O TIÊM VÀO (search thư viện → sinh nếu thiếu → assetId), nên
 * hàm này test được offline bằng resolver giả. resolve trả null = không có/không sinh được → giữ ô trống.
 */
export async function resolveMediaTargets(
  item: AuthoredItem,
  policy: MediaPolicy,
  resolve: (t: MediaTarget) => Promise<string | null>,
): Promise<ResolveResult> {
  const targets = mediaTargets(item, policy)
  const cache = new Map<string, string | null>()
  let payload = item.payload
  let filled = 0
  const unresolved: MediaTarget[] = []

  for (const t of targets) {
    let assetId = cache.get(t.dedupKey)
    if (assetId === undefined) {
      assetId = await resolve(t) // I/O — chỉ gọi MỘT LẦN mỗi dedupKey
      cache.set(t.dedupKey, assetId)
    }
    if (assetId) {
      payload = applyMediaAsset(payload, t.path, assetId)
      filled++
    } else {
      unresolved.push(t)
    }
  }
  return { payload, filled, unresolved }
}
