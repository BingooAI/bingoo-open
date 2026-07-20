import type { LearningExperienceLabels } from '@bingoo.ai/ui-web'

/** Translator (next-intl) đã bound namespace `kitchenSink.experiences`. */
type ExpT = (key: string) => string

/**
 * Dựng bảng nhãn 5 trục cho `@bingoo.ai/ui-web` từ i18n (`kitchenSink.experiences`). Một nơi duy nhất
 * để cả /learn lẫn kitchen-sink dùng — component ui-web i18n-free nên host phải cấp nhãn (R4).
 */
export function buildExperienceLabels(exp: ExpT): LearningExperienceLabels {
  return {
    axis: {
      experience: exp('axis.experience'),
      delivery: exp('axis.delivery'),
      companion: exp('axis.companion'),
      scale: exp('axis.scale'),
      time: exp('axis.time'),
    },
    experience: {
      learn: exp('experience.learn'),
      practice: exp('experience.practice'),
      arena: exp('experience.arena'),
      feed: exp('experience.feed'),
      project: exp('experience.project'),
    },
    delivery: {
      live: exp('delivery.live'),
      async: exp('delivery.async'),
      classroom: exp('delivery.classroom'),
    },
    companion: {
      ai: exp('companion.ai'),
      teacher: exp('companion.teacher'),
      mentor: exp('companion.mentor'),
      ta: exp('companion.ta'),
      peer: exp('companion.peer'),
      self: exp('companion.self'),
    },
    scale: {
      solo: exp('scale.solo'),
      pair: exp('scale.pair'),
      group: exp('scale.group'),
      class: exp('scale.class'),
    },
    time: {
      'on-demand': exp('time.onDemand'),
      scheduled: exp('time.scheduled'),
      live: exp('time.live'),
    },
    capability: {
      'lesson-runtime': exp('capability.lessonRuntime'),
      'practice-queue': exp('capability.practiceQueue'),
      matchmaking: exp('capability.matchmaking'),
      leaderboard: exp('capability.leaderboard'),
      'feed-stream': exp('capability.feedStream'),
      'project-workspace': exp('capability.projectWorkspace'),
      realtime: exp('capability.realtime'),
      scheduling: exp('capability.scheduling'),
      roster: exp('capability.roster'),
      'ai-tutor': exp('capability.aiTutor'),
      'human-presence': exp('capability.humanPresence'),
      'social-chat': exp('capability.socialChat'),
    },
    verdict: {
      VALID: exp('verdict.VALID'),
      DISCOURAGED: exp('verdict.DISCOURAGED'),
      INVALID: exp('verdict.INVALID'),
    },
  }
}
