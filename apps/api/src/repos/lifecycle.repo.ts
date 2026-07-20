// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import { deriveAccountType, isSynthEmail } from '@bingoo.ai/core'
import { writeAudit } from './audit.repo'
import { resolveConsentConfig } from './config.repo'

/**
 * Account lifecycle transitions (§3.2, §10) driven by Better Auth data hooks.
 * Kept free of any `auth` import so it can be called FROM auth.ts's databaseHooks
 * without a module cycle — it touches only the DB, core rules, audit and config.
 */

/** The user fields the update hook needs (a structural subset of BA's user). */
interface UpdatedUser {
  id: string
  email: string | null
  emailVerified: boolean
  status: string
  managedByGuardian: boolean
}

/**
 * React to a Better Auth user update:
 *  1. A verified email activates a still-PENDING account (§3.2).
 *  2. A MANAGED user who verified a REAL (non-synthetic) email is claiming their
 *     account → graduate to self-owned, keeping id/publicId + history (§10).
 * The self/guardian claim endpoints gate WHO may reach this point; verifying the
 * real email is what completes it.
 */
export async function onUserUpdated(user: UpdatedUser): Promise<void> {
  if (user.emailVerified && user.status === 'PENDING') {
    await db.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } })
    await writeAudit({
      action: 'auth.email.verified',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
    })
  }

  if (user.emailVerified && user.managedByGuardian && !isSynthEmail(user.email)) {
    await graduate(user.id)
  }
}

/** Hand a managed account over to its owner: drop guardian management + retire
 *  the guardianship links, keeping the same identity (§10). */
async function graduate(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { managedByGuardian: false, status: 'ACTIVE' },
    })
    await tx.guardianship.updateMany({
      where: { childId: userId, status: 'active' },
      data: { status: 'inactive' },
    })
  })
  await writeAudit({
    action: 'account.claimed',
    actorUserId: userId,
    targetType: 'user',
    targetId: userId,
  })
}

/**
 * Recompute a user's age tier from DOB + the current consent config and persist
 * it if it changed — automatic age-graduation (CHILD→TEEN→ADULT) as they get
 * older or as thresholds change. Best-effort; runs on login.
 */
export async function refreshAccountType(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { dateOfBirth: true, country: true, accountType: true },
  })
  if (!user?.dateOfBirth) return

  const config = await resolveConsentConfig()
  const derived = deriveAccountType(user.dateOfBirth, user.country, config)
  if (derived === user.accountType) return

  await db.user.update({ where: { id: userId }, data: { accountType: derived } })
  await writeAudit({
    action: 'account.tier_changed',
    actorUserId: userId,
    targetType: 'user',
    targetId: userId,
    metadata: { from: user.accountType, to: derived },
  })
}
