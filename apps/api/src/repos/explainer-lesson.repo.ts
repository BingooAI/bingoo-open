/**
 * explainer-lesson.repo.ts — a lesson is a THING WITH AN OWNER, not React state.
 *
 * Everything the import page and the Studio produced used to live in the browser
 * and nowhere else. A refresh discarded pictures that had been generated and
 * narration that had been spoken — both of which cost money — and there was
 * nothing to come back to, from this machine or any other.
 */
import { db } from '@bingoo.ai/db'
import type { Prisma } from '@bingoo.ai/db'

export type LessonInput = {
  slug: string
  title: string
  doc: Prisma.InputJsonValue
  bundles: Prisma.InputJsonValue
  imagesDone?: number
  imagesTotal?: number
  audioDone?: number
  audioTotal?: number
  status?: 'DRAFT' | 'READY' | 'PUBLISHED'
}

const LIST_FIELDS = {
  id: true,
  publicId: true,
  slug: true,
  title: true,
  status: true,
  imagesDone: true,
  imagesTotal: true,
  audioDone: true,
  audioTotal: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Every lesson this user owns, newest first. */
export function listLessons(userId: string) {
  return db.explainerLesson.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: 'desc' },
    select: LIST_FIELDS,
  })
}

/** One lesson WITH its doc — the only call that ships the whole payload. */
export function getLesson(userId: string, id: string) {
  return db.explainerLesson.findFirst({ where: { id, createdById: userId } })
}

/**
 * Save under `(owner, slug)`. Re-importing the same lesson UPDATES it rather than
 * piling up copies — the slug is the author's own id for the thing, so two saves
 * of "so-chan-so-le" are two saves of one lesson, not two lessons.
 */
export function upsertLesson(userId: string, input: LessonInput) {
  const data = {
    title: input.title,
    doc: input.doc,
    bundles: input.bundles,
    imagesDone: input.imagesDone ?? 0,
    imagesTotal: input.imagesTotal ?? 0,
    audioDone: input.audioDone ?? 0,
    audioTotal: input.audioTotal ?? 0,
    ...(input.status ? { status: input.status } : {}),
  }
  return db.explainerLesson.upsert({
    where: { createdById_slug: { createdById: userId, slug: input.slug } },
    create: { ...data, slug: input.slug, createdById: userId },
    update: data,
    select: LIST_FIELDS,
  })
}

export async function deleteLesson(userId: string, id: string): Promise<boolean> {
  const { count } = await db.explainerLesson.deleteMany({ where: { id, createdById: userId } })
  return count > 0
}
