// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import type { Prisma } from '@bingoo.ai/db'

/**
 * Profile facets (§3.8). A user "enables" a facet by filling it when they take
 * that role; the 360° profile is the UNION of whatever facets exist. Each facet
 * is its own 1:0..1 table — the core User stays thin and role-agnostic. Route
 * validates the (typed) body per facet, then upserts here. JSON fields are typed
 * `unknown` at the boundary and cast to Prisma's unchecked inputs on write.
 */

export const FACET_NAMES = ['learner', 'teacher', 'parent', 'professional'] as const
export type FacetName = (typeof FACET_NAMES)[number]

export function isFacetName(value: string): value is FacetName {
  return (FACET_NAMES as readonly string[]).includes(value)
}

export interface LearnerInput {
  level?: string
  gradeBand?: string
  goals?: string
  interests?: string[]
  streak?: number
  xp?: number
  metadata?: unknown
}
export interface TeacherInput {
  subjects?: string[]
  bio?: string
  certifications?: unknown
  rating?: number
  yearsExperience?: number
  metadata?: unknown
}
export interface ParentInput {
  preferences?: unknown
  metadata?: unknown
}
export interface ProfessionalInput {
  title?: string
  department?: string
  organizationId?: string
  metadata?: unknown
}

export function upsertLearner(userId: string, data: LearnerInput) {
  return db.learnerProfile.upsert({
    where: { userId },
    create: { userId, ...data } as Prisma.LearnerProfileUncheckedCreateInput,
    update: data as Prisma.LearnerProfileUncheckedUpdateInput,
  })
}

export function upsertTeacher(userId: string, data: TeacherInput) {
  return db.teacherProfile.upsert({
    where: { userId },
    create: { userId, ...data } as Prisma.TeacherProfileUncheckedCreateInput,
    update: data as Prisma.TeacherProfileUncheckedUpdateInput,
  })
}

export function upsertParent(userId: string, data: ParentInput) {
  return db.parentProfile.upsert({
    where: { userId },
    create: { userId, ...data } as Prisma.ParentProfileUncheckedCreateInput,
    update: data as Prisma.ParentProfileUncheckedUpdateInput,
  })
}

export function upsertProfessional(userId: string, data: ProfessionalInput) {
  return db.professionalProfile.upsert({
    where: { userId },
    create: { userId, ...data } as Prisma.ProfessionalProfileUncheckedCreateInput,
    update: data as Prisma.ProfessionalProfileUncheckedUpdateInput,
  })
}

/** Every facet the user has enabled — the raw material for the 360° union. */
export async function getAllFacets(userId: string) {
  const [learner, teacher, parent, professional] = await Promise.all([
    db.learnerProfile.findUnique({ where: { userId } }),
    db.teacherProfile.findUnique({ where: { userId } }),
    db.parentProfile.findUnique({ where: { userId } }),
    db.professionalProfile.findUnique({ where: { userId } }),
  ])
  return {
    ...(learner ? { learner } : {}),
    ...(teacher ? { teacher } : {}),
    ...(parent ? { parent } : {}),
    ...(professional ? { professional } : {}),
  }
}
