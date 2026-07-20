/**
 * Sample data for the dashboard demos. This is *content* (names, numbers) — all
 * user-facing labels still come from the i18n message catalog. Swap this module
 * for real API data later; the components don't change.
 */
import type { IconChipColor } from '@bingoo.ai/ui-web'
import type { MascotEmotion } from '@bingoo.ai/core'

export const student = {
  name: 'Minh Bảo',
  grade: 3,
  streak: 7,
  xpWeek: 1240,
  level: 8,
  minutesToday: 18,
  goalMinutes: 30,
  lessonsDone: 42,
  accuracy: 92,
  avatar: 'excited' as MascotEmotion,
}

export const continueLesson = { subjectKey: 'math', number: 12, percent: 60 }

export const todayQuests: { key: string; xp: number; done: boolean; color: IconChipColor }[] = [
  { key: 'math', xp: 30, done: true, color: 'primary' },
  { key: 'reading', xp: 25, done: false, color: 'coral' },
  { key: 'english', xp: 20, done: false, color: 'teal' },
  { key: 'review', xp: 15, done: false, color: 'sunbeam' },
]

export const subjectProgress: { key: string; percent: number; color: IconChipColor }[] = [
  { key: 'math', percent: 82, color: 'primary' },
  { key: 'vietnamese', percent: 68, color: 'coral' },
  { key: 'english', percent: 74, color: 'teal' },
  { key: 'science', percent: 45, color: 'sunbeam' },
]

export const achievements: { key: string; color: IconChipColor; icon: string }[] = [
  { key: 'streak7', color: 'coral', icon: '🔥' },
  { key: 'mathwiz', color: 'primary', icon: '🧮' },
  { key: 'reader', color: 'teal', icon: '📚' },
  { key: 'early', color: 'sunbeam', icon: '🌅' },
]

export const leaderboard: { name: string; xp: number; you?: boolean }[] = [
  { name: 'Gia Hân', xp: 1580 },
  { name: 'Minh Bảo', xp: 1240, you: true },
  { name: 'Khánh Vy', xp: 1120 },
  { name: 'Tuấn Kiệt', xp: 980 },
]

/* -------------------------------------------------------------------------- */

export type Child = {
  id: string
  name: string
  grade: number
  emotion: MascotEmotion
  active: boolean
  lastActive: string
}

export const children: Child[] = [
  { id: 'bao', name: 'Minh Bảo', grade: 3, emotion: 'excited', active: true, lastActive: '2 phút' },
  { id: 'an', name: 'Bảo An', grade: 1, emotion: 'happy', active: false, lastActive: '3 giờ' },
]

export const parent = {
  name: 'Chị Lan',
  stats: { hours: 4, minutes: 35, lessons: 28, accuracy: 88, streak: 7 },
  screentime: { done: 22, total: 45 },
}

export const weeklySubjects: {
  key: string
  percent: number
  delta: number
  direction: 'up' | 'down'
  color: IconChipColor
}[] = [
  { key: 'math', percent: 82, delta: 12, direction: 'up', color: 'primary' },
  { key: 'vietnamese', percent: 68, delta: 4, direction: 'up', color: 'coral' },
  { key: 'english', percent: 74, delta: 3, direction: 'down', color: 'teal' },
  { key: 'science', percent: 45, delta: 8, direction: 'up', color: 'sunbeam' },
]

export const activities: {
  id: number
  type: 'completed' | 'badge' | 'practice' | 'quiz'
  arg: string
  time: string
  color: IconChipColor
}[] = [
  { id: 1, type: 'completed', arg: 'Phép nhân bảng 6', time: '2 phút', color: 'primary' },
  { id: 2, type: 'badge', arg: 'Thần đồng Toán', time: '15 phút', color: 'sunbeam' },
  { id: 3, type: 'quiz', arg: 'english', time: '1 giờ', color: 'teal' },
  { id: 4, type: 'practice', arg: 'vietnamese', time: '3 giờ', color: 'coral' },
]

export const recommendations: {
  subjectKey: string
  lesson: string
  xp: number
  color: IconChipColor
}[] = [
  { subjectKey: 'vietnamese', lesson: 'Đọc hiểu nâng cao', xp: 40, color: 'coral' },
  { subjectKey: 'english', lesson: 'Từ vựng chủ đề gia đình', xp: 30, color: 'teal' },
]
