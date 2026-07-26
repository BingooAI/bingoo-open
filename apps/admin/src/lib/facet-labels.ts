// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Trục nhận dạng → khoá i18n.
 *
 * Ở một chỗ vì hai mặt khác nhau cùng đọc nó: cổng chốt khi máy không phân biệt được hai kiến thức,
 * và bảng đối chiếu hai khung. Cùng một trục phải đọc lên cùng một chữ ở cả hai chỗ, nếu không thì
 * người dùng thấy hai bảng nói về hai thứ khác nhau trong khi chúng là một.
 */
export const AXIS_KEY: Record<string, string> = {
  object: 'axObject',
  channel: 'axChannel',
  bloom: 'axBloom',
  scope: 'axScope',
  representation: 'axRepresentation',
  transfer: 'axTransfer',
  fluency: 'axFluency',
}

/** Trục người duyệt được phép bổ sung. `scope` KHÔNG có: nó là dữ liệu có cấu trúc, không phải chuỗi. */
export const DISTINGUISH_AXES = [
  'object',
  'channel',
  'representation',
  'bloom',
  'transfer',
  'fluency',
] as const
