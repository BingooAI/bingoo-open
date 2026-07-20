/**
 * BLUEPRINTS — công thức trải nghiệm đặt sẵn. Đây là DỮ LIỆU, không phải code: thêm công thức mới =
 * thêm một dòng, không đụng logic. (Sau này có thể chuyển sang remote config theo §6 CLAUDE.md để
 * đổi không cần release — hình dạng object giữ nguyên.)
 *
 * Mỗi blueprint mang:
 *   • `descriptor` — điểm 5 trục (phải KHÔNG mâu thuẫn cứng — test `blueprints.test.ts` canh việc này).
 *   • `labelKey`   — hậu tố khoá i18n; host tự map sang vi/en (engine i18n-free).
 *   • `accent`/`icon` — gợi ý trình bày; host map sang token/icon thật.
 */

import type { ExperienceDescriptor } from './descriptor'

/** Gợi ý màu nhấn — trùng tên với accent token của Bingoo (host map sang IconChipColor). */
export type ExperienceAccent = 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success' | 'neutral'

export interface Blueprint {
  readonly id: string
  readonly descriptor: ExperienceDescriptor
  /** Hậu tố khoá i18n (vd 'aiTutor' → kitchenSink.experiences.blueprints.aiTutor). */
  readonly labelKey: string
  readonly accent: ExperienceAccent
  /** Tên icon (lucide) — host map sang component. */
  readonly icon: string
}

export const BLUEPRINTS: readonly Blueprint[] = [
  {
    id: 'ai-tutor',
    descriptor: {
      experience: 'learn',
      delivery: 'async',
      companion: 'ai',
      scale: 'solo',
      time: 'on-demand',
    },
    labelKey: 'aiTutor',
    accent: 'primary',
    icon: 'Sparkles',
  },
  {
    id: 'daily-practice',
    descriptor: {
      experience: 'practice',
      delivery: 'async',
      companion: 'self',
      scale: 'solo',
      time: 'on-demand',
    },
    labelKey: 'dailyPractice',
    accent: 'teal',
    icon: 'Dumbbell',
  },
  {
    id: 'live-arena',
    descriptor: {
      experience: 'arena',
      delivery: 'live',
      companion: 'peer',
      scale: 'class',
      time: 'live',
    },
    labelKey: 'liveArena',
    accent: 'coral',
    icon: 'Swords',
  },
  {
    id: 'study-group',
    descriptor: {
      experience: 'practice',
      delivery: 'async',
      companion: 'peer',
      scale: 'group',
      time: 'on-demand',
    },
    labelKey: 'studyGroup',
    accent: 'success',
    icon: 'Users',
  },
  {
    id: 'virtual-classroom',
    descriptor: {
      experience: 'learn',
      delivery: 'classroom',
      companion: 'teacher',
      scale: 'class',
      time: 'scheduled',
    },
    labelKey: 'virtualClassroom',
    accent: 'primary',
    icon: 'GraduationCap',
  },
  {
    id: 'mentor-session',
    descriptor: {
      experience: 'learn',
      delivery: 'live',
      companion: 'mentor',
      scale: 'pair',
      time: 'scheduled',
    },
    labelKey: 'mentorSession',
    accent: 'sunbeam',
    icon: 'Compass',
  },
  {
    id: 'feed-discovery',
    descriptor: {
      experience: 'feed',
      delivery: 'async',
      companion: 'ai',
      scale: 'solo',
      time: 'on-demand',
    },
    labelKey: 'feedDiscovery',
    accent: 'teal',
    icon: 'Rss',
  },
]

/** Tra blueprint theo id. */
export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((b) => b.id === id)
}
