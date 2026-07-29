// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Nhật ký một lượt chọn bài — không phải để gỡ lỗi, mà để câu hỏi sau này còn có đáp án.
 *
 * Bộ chọn hiện tất định: cùng (đầu vào, daySeed) luôn ra cùng phiên. Nên cái đáng ghi không
 * phải "đã chọn gì" — kết quả vốn còn đó trong `Observation`. Cái mất là **những phương án bị
 * bỏ**: ứng viên nào đã vào vòng cân nhắc, chấm bao nhiêu, thua ai. Không có phần đó thì câu
 * "nếu hồi ấy chấm khác đi, phiên này có còn giống không" là câu không thể trả lời sau, kể cả
 * khi đã có đủ dữ liệu — vì dữ liệu ấy chưa từng được ghi.
 *
 * Lõi thuần: không đọc đồng hồ, không ngẫu nhiên. Host đóng dấu thời gian lúc bền hoá.
 */

import type { EnginePolicy } from '../policy'
import { fnv1a32 } from './hash'

/** Một ứng viên đã vào vòng cân nhắc, kèm điểm và kết cục. */
export interface ConsideredCandidate {
  readonly key: string
  /** Điểm thô từ `scoreItem` — thứ chính sách thực sự tối ưu. */
  readonly score: number
  /** Điểm đã gom nhóm theo `scoreBucket` — thứ dùng để sắp hạng. */
  readonly bucket: number
  /** Xoay vòng theo ngày, chỉ để phá thế hoà. 0 khi không có `daySeed`. */
  readonly rank: number
  readonly picked: boolean
}

/**
 * Nhật ký đầy đủ của một lượt chọn.
 *
 * `offered` là số ứng viên host đưa vào; `eligible` là số còn lại sau khi lọc. Khoảng cách
 * giữa hai số đó tự nó là một tín hiệu: ngân hàng đề rộng mà tập hợp lệ hẹp nghĩa là bộ lọc
 * đang siết, không phải chính sách đang kén.
 */
export interface SelectionTrace {
  /** Dấu vân tay policy — biết lượt này chạy dưới bộ tham số nào. */
  readonly policy: string
  readonly size: number
  /** Số suất đã chừa cho thăm dò (`exploreCap` × `explore`). */
  readonly exploreN: number
  readonly daySeed: string | null
  readonly offered: number
  readonly eligible: number
  /** Theo thứ tự đã sắp hạng — hạng nhất đứng đầu. */
  readonly considered: readonly ConsideredCandidate[]
  /** Khoá các bài đã chọn, theo đúng thứ tự trình cho người học. */
  readonly picked: readonly string[]
}

/** Tuần tự hoá tất định — khoá sắp thứ tự, để cùng một policy luôn ra cùng một chuỗi. */
function stableString(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableString).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableString(v)}`).join(',')}}`
}

/**
 * Dấu vân tay của policy: đổi một con số bất kỳ trong policy là đổi dấu.
 *
 * Dùng thay số phiên bản khai tay, vì số khai tay chỉ đúng chừng nào còn có người nhớ tăng nó
 * — và một nhật ký ghi sai phiên bản còn tệ hơn nhật ký không ghi.
 */
export function policyFingerprint(policy: EnginePolicy): string {
  return fnv1a32(stableString(policy)).toString(16).padStart(8, '0')
}
