// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * resolveDescriptor — biến một cấu hình DỞ DANG (người dùng mới chọn vài trục) thành ĐẦY ĐỦ, kèm
 * phán quyết tương thích + năng lực cần và blueprint khớp (nếu có). Đây là cửa duy nhất host cần gọi
 * sau khi người học chọn trục: đầu vào lỏng, đầu ra đủ để dựng trải nghiệm.
 */

import { BLUEPRINTS, type Blueprint } from './blueprints'
import { deriveCapabilities, type Capability } from './capabilities'
import { checkCompatibility, type CompatibilityResult } from './compatibility'
import { descriptorsEqual, type ExperienceDescriptor, type PartialDescriptor } from './descriptor'

/** Nền mặc định an toàn nhất: gia sư AI, tự học, một mình, bất cứ lúc nào. Điền vào trục còn trống. */
export const DEFAULT_DESCRIPTOR: ExperienceDescriptor = {
  experience: 'learn',
  delivery: 'async',
  companion: 'ai',
  scale: 'solo',
  time: 'on-demand',
}

export interface ResolveResult {
  readonly descriptor: ExperienceDescriptor
  readonly compatibility: CompatibilityResult
  readonly capabilities: readonly Capability[]
  /** Blueprint trùng khít descriptor (nếu có) — để hiển thị tên/icon đặt sẵn. */
  readonly blueprint: Blueprint | undefined
}

/** Blueprint có descriptor trùng khít điểm 5 trục này. */
export function matchBlueprint(d: ExperienceDescriptor): Blueprint | undefined {
  return BLUEPRINTS.find((b) => descriptorsEqual(b.descriptor, d))
}

/**
 * Điền trục trống bằng `base` (mặc định `DEFAULT_DESCRIPTOR`) → descriptor đầy đủ, rồi chấm tương
 * thích + suy năng lực + tìm blueprint. Không tự "sửa" mâu thuẫn: nếu người dùng chọn tổ hợp INVALID,
 * kết quả phản ánh đúng vi phạm để host cảnh báo — engine không âm thầm đổi lựa chọn của người học.
 */
export function resolveDescriptor(
  partial: PartialDescriptor,
  base: ExperienceDescriptor = DEFAULT_DESCRIPTOR,
): ResolveResult {
  const descriptor: ExperienceDescriptor = {
    experience: partial.experience ?? base.experience,
    delivery: partial.delivery ?? base.delivery,
    companion: partial.companion ?? base.companion,
    scale: partial.scale ?? base.scale,
    time: partial.time ?? base.time,
  }
  return {
    descriptor,
    compatibility: checkCompatibility(descriptor),
    capabilities: deriveCapabilities(descriptor),
    blueprint: matchBlueprint(descriptor),
  }
}
