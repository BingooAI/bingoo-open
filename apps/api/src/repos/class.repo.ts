// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import { parseRoles } from '../auth/roles'
import { isGuardianOf } from './children.repo'

/**
 * Class + membership data access and the academic-scope authorization rules (§6).
 * A teacher's power over a student is scoped to a SHARED class — never global —
 * so every check keys off `classId` + the requester's role in that class. Class
 * ids are cuid-defaulted in the schema, so Better Auth isn't involved here.
 */

export type ClassRole = 'TEACHER' | 'TA' | 'TUTOR' | 'STUDENT'
export const TEACHING_ROLES = ['TEACHER', 'TA', 'TUTOR'] as const

export interface CreateClassInput {
  creatorId: string
  name: string
  subject?: string | null
  term?: string | null
  organizationId?: string | null
}

/** Create a class and enroll the creator as its lead TEACHER. */
export async function createClass(input: CreateClassInput) {
  return db.$transaction(async (tx) => {
    const cls = await tx.class.create({
      data: {
        name: input.name,
        subject: input.subject ?? null,
        term: input.term ?? null,
        organizationId: input.organizationId ?? null,
      },
    })
    await tx.classMember.create({
      data: { classId: cls.id, userId: input.creatorId, role: 'TEACHER', status: 'active' },
    })
    return cls
  })
}

/** The requester's active role in a class, or null if they aren't an active member. */
export async function getClassRole(classId: string, userId: string): Promise<ClassRole | null> {
  const member = await db.classMember.findUnique({
    where: { classId_userId: { classId, userId } },
    select: { role: true, status: true },
  })
  return member && member.status === 'active' ? (member.role as ClassRole) : null
}

/** Classes the user actively belongs to, with their role in each. */
export async function listClassesForUser(userId: string) {
  const rows = await db.classMember.findMany({
    where: { userId, status: 'active' },
    orderBy: { joinedAt: 'desc' },
    select: {
      role: true,
      class: {
        select: {
          id: true,
          name: true,
          subject: true,
          term: true,
          status: true,
          organizationId: true,
        },
      },
    },
  })
  return rows.map((r) => ({ ...r.class, myRole: r.role }))
}

/** Add (or reactivate) a member with a class role. */
export async function addMember(classId: string, userId: string, role: ClassRole) {
  return db.classMember.upsert({
    where: { classId_userId: { classId, userId } },
    create: { classId, userId, role, status: 'active' },
    update: { role, status: 'active' },
  })
}

/** Soft-remove a member (keeps enrollment history). */
export async function removeMember(classId: string, userId: string): Promise<void> {
  await db.classMember.updateMany({
    where: { classId, userId },
    data: { status: 'removed' },
  })
}

/** Active roster of a class. */
export async function listMembers(classId: string) {
  const rows = await db.classMember.findMany({
    where: { classId, status: 'active' },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      joinedAt: true,
      user: {
        select: { id: true, publicId: true, name: true, username: true, accountType: true },
      },
    },
  })
  return rows.map((r) => ({ ...r.user, classRole: r.role, joinedAt: r.joinedAt }))
}

/** True when `teacherId` teaches a class in which `studentId` is an active
 *  student — the per-class scope that lets a teacher reach that student (§6). */
export async function sharesClassAsTeacher(teacherId: string, studentId: string): Promise<boolean> {
  const teaching = await db.classMember.findMany({
    where: { userId: teacherId, role: { in: [...TEACHING_ROLES] }, status: 'active' },
    select: { classId: true },
  })
  if (teaching.length === 0) return false

  const shared = await db.classMember.findFirst({
    where: {
      classId: { in: teaching.map((t) => t.classId) },
      userId: studentId,
      role: 'STUDENT',
      status: 'active',
    },
    select: { id: true },
  })
  return shared !== null
}

/** True when two users share any active class — a "known contact" for the
 *  child-safety friend gate (§6). Symmetric in its arguments. */
export async function shareAnyClass(userA: string, userB: string): Promise<boolean> {
  const aClasses = await db.classMember.findMany({
    where: { userId: userA, status: 'active' },
    select: { classId: true },
  })
  if (aClasses.length === 0) return false
  const shared = await db.classMember.findFirst({
    where: { classId: { in: aClasses.map((c) => c.classId) }, userId: userB, status: 'active' },
    select: { id: true },
  })
  return shared !== null
}

/**
 * May `requester` access `studentId`'s data? The union of valid relations (§6):
 * self · platform ADMIN/MODERATOR · guardian · a teacher of a shared class.
 * A plain org/class role never implies access to an unrelated student.
 */
export async function canAccessStudent(
  requester: { id: string; role?: string | null },
  studentId: string,
): Promise<boolean> {
  if (requester.id === studentId) return true
  if (parseRoles(requester.role).some((r) => r === 'ADMIN' || r === 'MODERATOR')) return true
  if (await isGuardianOf(requester.id, studentId)) return true
  if (await sharesClassAsTeacher(requester.id, studentId)) return true
  return false
}
