// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { db } from '@bingoo.ai/db'
import { env } from '../config/env'
import { auth } from '../auth/auth'

/**
 * Claim initiation (§10). Sets the real email (unverified) + status PENDING and
 * fires Better Auth's email-verification. Graduation itself happens once the real
 * email is verified — see lifecycle.repo `onUserUpdated`. Lives apart from
 * lifecycle.repo because it needs `auth` (password hashing + verification send),
 * which auth.ts's hooks must not import back.
 */

const claimCallbackURL = () => `${env.WEB_URL}/claimed`

async function sendVerification(email: string): Promise<void> {
  // Generates the token + invokes our verification email hook. Best-effort: the
  // hook already swallows provider failures, and the token is persisted either way.
  await auth.api.sendVerificationEmail({ body: { email, callbackURL: claimCallbackURL() } })
}

/** TEEN self-claim: set the real email + a new (adult-strength) password. */
export async function startSelfClaim(userId: string, email: string, password: string): Promise<void> {
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { email, emailVerified: false, status: 'PENDING' },
    })
    await tx.account.updateMany({
      where: { userId, providerId: 'credential' },
      data: { password: hash },
    })
  })
  await sendVerification(email)
}

/** Guardian-approved claim for a child: set the real email; the child keeps their
 *  username + PIN. Graduation completes when that email is verified. */
export async function startGuardianClaim(childId: string, email: string): Promise<void> {
  await db.user.update({
    where: { id: childId },
    data: { email, emailVerified: false, status: 'PENDING' },
  })
  await sendVerification(email)
}
