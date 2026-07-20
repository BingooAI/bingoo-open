/**
 * @bingoo/experiences — WEB VIEW của các mode học (Lesson · Practice · Arena · Feed · Project · Classroom).
 * Cửa duy nhất `LearnExperience`: cho INPUT (descriptor + content + labels) → ra VIEW. i18n-free,
 * content-agnostic; dựng trên engine/component THẬT của bingoo (@bingoo/core quiz, DrawingCanvas,
 * ContentBlocks) + máy trận đấu arena thuần (có test) trong package này.
 */

export { LearnExperience } from './learn-experience'

export type {
  LearnExperienceProps,
  ExperienceContent,
  ExperienceLabels,
  LearnFormat,
  LearnHud,
  LearnStep,
  LearnCourseData,
  LearnLessonRef,
  LearnQuizItem,
  LearnProjectData,
  Participant,
  TopicAccent,
  FeedTopic,
  ArenaConfig,
} from './types'

export {
  initMatch,
  resolveRound,
  useSpecial,
  specialReady,
  makeRng,
  MAX_ENERGY,
  MAX_HEARTS,
  type ArenaMode,
  type Difficulty,
  type MatchState,
  type MatchStatus,
  type Combatant,
  type RoundOutcome,
} from './arena/engine'
