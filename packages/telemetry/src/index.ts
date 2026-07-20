/**
 * @bingoo/telemetry — sự kiện thô UI → ngữ cảnh làm giàu bằng chứng.
 * BẤT BIẾN: Telemetry ≠ Evidence. Chỉ `attempt_submitted` sinh Observation;
 * view/hint chỉ bồi thêm hintsUsed/latency/retry (EVIDENCE-ANALYTICS §2.1). Thuần TS.
 */

import type { EvidenceInput, Millis } from '@bingoo/knowledge-engine';

export type RawEventKind =
  'session_start' | 'item_viewed' | 'hint_opened' | 'attempt_submitted' | 'session_end';

export interface RawEvent {
  readonly kind: RawEventKind;
  readonly atMs: Millis;
  readonly sessionId: string;
  readonly itemKey?: string;
  readonly hintLevel?: number;
}

export interface AttemptContext {
  readonly hintsUsed: number;
  readonly latencyMs?: number;
  readonly retry: number;
}

/** Chỉ attempt_submitted mới mang bằng chứng — cổng chặn để không fold nhầm telemetry. */
export function isEvidenceBearing(e: RawEvent): boolean {
  return e.kind === 'attempt_submitted';
}

/**
 * Tính ngữ cảnh cho lần nộp tại `submitIndex` trong stream 1 phiên (đã sort tăng theo atMs):
 * - retry   = số lần đã nộp CÙNG item trước đó trong phiên.
 * - hintsUsed = số hint mở cho item này kể từ lần nộp trước đó của chính item.
 * - latencyMs = thời điểm nộp − lần xem item đầu tiên trong cửa sổ hiện tại (nếu có).
 */
export function attemptContext(events: readonly RawEvent[], submitIndex: number): AttemptContext {
  const submit = events[submitIndex];
  if (submit === undefined || submit.kind !== 'attempt_submitted' || submit.itemKey === undefined) {
    return { hintsUsed: 0, retry: 0 };
  }
  const item = submit.itemKey;

  let retry = 0;
  let windowStart = 0; // chỉ số ngay sau lần nộp trước của cùng item
  for (let i = 0; i < submitIndex; i++) {
    const e = events[i];
    if (e?.kind === 'attempt_submitted' && e.itemKey === item) {
      retry += 1;
      windowStart = i + 1;
    }
  }

  let hintsUsed = 0;
  let firstViewAt: Millis | undefined;
  for (let i = windowStart; i < submitIndex; i++) {
    const e = events[i];
    if (e === undefined || e.itemKey !== item) continue;
    if (e.kind === 'hint_opened') hintsUsed += 1;
    if (e.kind === 'item_viewed' && firstViewAt === undefined) firstViewAt = e.atMs;
  }

  const latencyMs = firstViewAt !== undefined ? submit.atMs - firstViewAt : undefined;
  return {
    hintsUsed,
    retry,
    ...(latencyMs !== undefined && latencyMs >= 0 ? { latencyMs } : {}),
  };
}

/** Bồi ngữ cảnh vào evidence base (host dựng với actor/verdict). KHÔNG đụng cách fold. */
export function withContext(base: EvidenceInput, ctx: AttemptContext): EvidenceInput {
  return {
    ...base,
    hintsUsed: ctx.hintsUsed,
    retry: ctx.retry,
    ...(ctx.latencyMs !== undefined ? { latencyMs: ctx.latencyMs } : {}),
  };
}
