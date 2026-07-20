/**
 * Course / curriculum outline schema (Zod, LLM-authorable). Note: authored
 * STRUCTURE only — per-user progress (done/current/locked) is runtime state passed
 * to the UI separately, never baked into authored content.
 */

import { z } from 'zod'

export const CourseLesson = z.object({
  id: z.string().min(1),
  title: z.string().min(1).describe('Lesson title.'),
  kind: z
    .enum(['lesson', 'quiz', 'video', 'practice'])
    .describe('Node type — a reading lesson, a quiz, a video, or a practice set.'),
  durationMin: z.number().int().positive().optional().describe('Estimated minutes to complete.'),
})

export const CourseChapter = z.object({
  id: z.string().min(1),
  title: z.string().min(1).describe('Chapter title.'),
  lessons: z.array(CourseLesson).min(1),
})

export const Course = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1).describe('Course title.'),
    summary: z.string().optional().describe('One-sentence course summary.'),
    chapters: z
      .array(CourseChapter)
      .min(1)
      .describe('Chapters. Chapter and lesson ids must be unique across the course.'),
  })
  .superRefine((course, ctx) => {
    const chapterIds = new Set<string>()
    const lessonIds = new Set<string>()
    course.chapters.forEach((ch, ci) => {
      if (chapterIds.has(ch.id))
        ctx.addIssue({
          code: 'custom',
          path: ['chapters', ci, 'id'],
          message: `duplicate chapter id "${ch.id}"`,
        })
      chapterIds.add(ch.id)
      ch.lessons.forEach((l, li) => {
        if (lessonIds.has(l.id))
          ctx.addIssue({
            code: 'custom',
            path: ['chapters', ci, 'lessons', li, 'id'],
            message: `duplicate lesson id "${l.id}" — lesson ids must be unique across the whole course`,
          })
        lessonIds.add(l.id)
      })
    })
  })

export type CourseLesson = z.infer<typeof CourseLesson>
export type CourseChapter = z.infer<typeof CourseChapter>
export type Course = z.infer<typeof Course>

/** Per-user progress for a lesson node — runtime state, not authored content. */
export type LessonStatus = 'done' | 'current' | 'locked' | 'available'

export function safeParseCourse(data: unknown) {
  return Course.safeParse(data)
}

export function courseJsonSchema(): unknown {
  return z.toJSONSchema(Course)
}
