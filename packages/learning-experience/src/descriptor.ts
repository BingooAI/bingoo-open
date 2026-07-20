/**
 * ExperienceDescriptor — MỘT ĐIỂM trong không gian 5 trục. Đây là "hợp đồng" mà host đọc để biết
 * phải dựng trải nghiệm học kiểu gì. Không mang text hiển thị (i18n ở host), không mang logic môn học.
 */

import { z } from 'zod'
import {
  AXES,
  COMPANION,
  DELIVERY,
  EXPERIENCE,
  SCALE,
  TIME,
  type Companion,
  type Delivery,
  type Experience,
  type Scale,
  type Time,
} from './axes'

export interface ExperienceDescriptor {
  readonly experience: Experience
  readonly delivery: Delivery
  readonly companion: Companion
  readonly scale: Scale
  readonly time: Time
}

/** Cấu hình dở dang — người dùng mới chọn vài trục. `resolveDescriptor` sẽ điền nốt. */
export type PartialDescriptor = Partial<ExperienceDescriptor>

/** Schema kiểm dữ liệu ngoài (remote config, form, URL param) trước khi tin. */
export const experienceDescriptorSchema = z.object({
  experience: z.enum(EXPERIENCE),
  delivery: z.enum(DELIVERY),
  companion: z.enum(COMPANION),
  scale: z.enum(SCALE),
  time: z.enum(TIME),
})

/** Parse an toàn: trả về descriptor đã kiểm hoặc `undefined` (không ném). */
export function parseDescriptor(input: unknown): ExperienceDescriptor | undefined {
  const parsed = experienceDescriptorSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

/** Khoá định danh tất định — hai descriptor cùng khoá thì cùng trải nghiệm. Dùng để dedup/so khớp O(1). */
export function descriptorKey(d: ExperienceDescriptor): string {
  return AXES.map((a) => `${a}:${d[a]}`).join('|')
}

/** Hai descriptor có trùng khít mọi trục không. */
export function descriptorsEqual(a: ExperienceDescriptor, b: ExperienceDescriptor): boolean {
  return AXES.every((ax) => a[ax] === b[ax])
}
