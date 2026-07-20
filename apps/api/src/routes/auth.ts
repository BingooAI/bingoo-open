import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '@bingoo/db'
import { deriveAccountType, isSynthEmail } from '@bingoo/core'
import type { AppEnv } from '../lib/context'
import { AppError } from '../lib/errors'
import { ok } from '../lib/response'
import { validate } from '../lib/validate'
import { parseRoles, requireAuth } from '../auth'
import { writeAudit } from '../repos/audit.repo'
import { resolveConsentConfig } from '../repos/config.repo'
import { startSelfClaim } from '../repos/claim.repo'

const UpdateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    locale: z.string().max(10).optional(),
    timezone: z.string().max(64).optional(),
    image: z.string().url().max(500).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, 'provide at least one field')

const ClaimSchema = z.object({
  email: z.string().email().max(200),
  // Graduating toward adulthood → a real password, not a 6-digit PIN.
  password: z.string().min(8).max(200),
})

/**
 * Identity routes complementing the Better Auth core handler (/api/auth/*).
 * `GET /me` is the "who am I" projection; `PATCH /me` is TEEN/adult self-service
 * (a CHILD is guardian-managed); `POST /claim` starts a TEEN's graduation to a
 * self-owned account (§10) — it completes when the new email is verified.
 */
export const authRoutes = new Hono<AppEnv>()
  .get('/me', requireAuth, async (c) => {
    const user = c.get('user')
    const session = c.get('session')
    if (!user) throw AppError.unauthorized()

    const activeOrganizationId = session?.activeOrganizationId ?? null
    const activeOrganization = activeOrganizationId
      ? await db.organization.findUnique({
          where: { id: activeOrganizationId },
          select: { id: true, name: true, slug: true, type: true },
        })
      : null

    return ok(c, {
      user: {
        id: user.id,
        publicId: user.publicId,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        roles: parseRoles(user.role),
        status: user.status,
        accountType: user.accountType,
        country: user.country,
        locale: user.locale,
        timezone: user.timezone,
        managedByGuardian: user.managedByGuardian,
        createdAt: user.createdAt,
      },
      session: session
        ? {
            activeOrganizationId,
            activeTeamId: session.activeTeamId ?? null,
            expiresAt: session.expiresAt,
          }
        : null,
      activeOrganization,
    })
  })
  .patch('/me', requireAuth, validate('json', UpdateMeSchema), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    // TEEN self-service: a CHILD is guardian-managed and cannot self-edit (§3.3).
    if (user.accountType === 'CHILD') throw AppError.forbidden('This account is managed by a guardian')

    const updated = await db.user.update({
      where: { id: user.id },
      data: c.req.valid('json'),
      select: { id: true, name: true, locale: true, timezone: true, image: true },
    })
    return ok(c, updated)
  })
  .post('/claim', requireAuth, validate('json', ClaimSchema), async (c) => {
    const user = c.get('user')
    if (!user) throw AppError.unauthorized()
    if (!user.managedByGuardian) throw AppError.badRequest('Account is already self-managed')
    if (!user.dateOfBirth) throw AppError.badRequest('Account has no date of birth')

    // Gate: a CHILD cannot self-claim — a guardian must (POST /children/:id/claim).
    const tier = deriveAccountType(new Date(user.dateOfBirth), user.country, await resolveConsentConfig())
    if (tier === 'CHILD') throw AppError.forbidden('A guardian must complete this claim')

    const { email, password } = c.req.valid('json')
    if (isSynthEmail(email)) throw AppError.badRequest('Provide a real email address')
    const taken = await db.user.findFirst({
      where: { email, id: { not: user.id } },
      select: { id: true },
    })
    if (taken) throw AppError.conflict('Email already in use')

    await startSelfClaim(user.id, email, password)
    await writeAudit({
      action: 'account.claim_started',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
    })
    return ok(c, { status: 'verification_sent', email })
  })
