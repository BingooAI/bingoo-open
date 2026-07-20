// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * @bingoo.ai/learning-experience — engine "Learning Experience": 5 TRỤC cấu hình (code, xương sống) +
 * luật tương thích, năng lực suy ra, blueprint đặt sẵn (dữ liệu). Đây là MỘT experience pack; các
 * pack khác về sau sống cạnh trong namespace `experiences`. Thuần TS, content-agnostic, không I/O.
 *
 * Một điểm 5 trục (ExperienceDescriptor) mô tả BẤT KỲ trải nghiệm học nào:
 *   Experience × Delivery × Companion × Scale × Time.
 * Host gọi `resolveDescriptor(partial)` → descriptor đầy đủ + verdict tương thích + năng lực cần mount.
 */

export {
  EXPERIENCE,
  DELIVERY,
  COMPANION,
  SCALE,
  TIME,
  AXES,
  AXIS_VALUES,
  type Experience,
  type Delivery,
  type Companion,
  type Scale,
  type Time,
  type Axis,
  type AxisValue,
} from './axes'

export {
  experienceDescriptorSchema,
  parseDescriptor,
  descriptorKey,
  descriptorsEqual,
  type ExperienceDescriptor,
  type PartialDescriptor,
} from './descriptor'

export {
  checkCompatibility,
  isValid,
  type CompatibilitySeverity,
  type CompatibilityVerdict,
  type CompatibilityViolation,
  type CompatibilityResult,
} from './compatibility'

export { CAPABILITY, deriveCapabilities, type Capability } from './capabilities'

export { BLUEPRINTS, getBlueprint, type Blueprint, type ExperienceAccent } from './blueprints'

export { DEFAULT_DESCRIPTOR, matchBlueprint, resolveDescriptor, type ResolveResult } from './resolve'
