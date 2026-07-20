import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@bingoo/db';
import { ageInYears, isPin, isSynthEmail, isUsername } from '@bingoo/core';
import type { AppEnv } from '../lib/context';
import { AppError } from '../lib/errors';
import { ok } from '../lib/response';
import { validate } from '../lib/validate';
import { requireAuth } from '../auth';
import { writeAudit } from '../repos/audit.repo';
import { createChild, isGuardianOf, listChildren, resetChildPin } from '../repos/children.repo';
import { startGuardianClaim } from '../repos/claim.repo';

const RELATIONSHIPS = ['FATHER', 'MOTHER', 'GUARDIAN', 'GRANDPARENT', 'RELATIVE', 'OTHER'] as const;

const CreateChildSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .transform((value) => value.toLowerCase())
    .refine(isUsername, 'username must be 3–30 chars: a–z, 0–9, underscore'),
  pin: z.string().refine(isPin, 'PIN must be exactly 6 digits'),
  dateOfBirth: z.coerce.date().refine((dob) => {
    const age = ageInYears(dob);
    return age >= 0 && age < 18; // a guardian creates minors only (CHILD/TEEN)
  }, 'date of birth must place the child under 18'),
  country: z.string().length(2).optional(),
  gender: z.string().max(20).optional(),
  relationship: z.enum(RELATIONSHIPS).optional(),
});

const PinSchema = z.object({
  pin: z.string().refine(isPin, 'PIN must be exactly 6 digits'),
});

const GuardianClaimSchema = z.object({
  email: z.string().email().max(200),
});

/**
 * Guardian-managed child accounts (§10). A verified adult creates a child (which
 * mints the account + Guardianship + consent and makes the creator a PARENT),
 * lists the children they guard, and resets a child's PIN. Every child-scoped
 * operation is authorized by an active Guardianship (R5/R6), enforced server-side.
 */
export const children = new Hono<AppEnv>()
  .post('/', requireAuth, validate('json', CreateChildSchema), async (c) => {
    const parent = c.get('user');
    if (!parent) throw AppError.unauthorized();
    // Verifiable parental consent: only a verified (ACTIVE) adult may add a child.
    if (parent.status !== 'ACTIVE') {
      throw AppError.forbidden('Verify your email before adding a child');
    }

    const body = c.req.valid('json');
    const child = await createChild({
      guardianId: parent.id,
      name: body.name,
      username: body.username,
      pin: body.pin,
      dateOfBirth: body.dateOfBirth,
      country: body.country ?? parent.country ?? null,
      gender: body.gender ?? null,
      relationship: body.relationship ?? null,
    });

    await writeAudit({
      action: 'child.created',
      actorUserId: parent.id,
      targetType: 'user',
      targetId: child.id,
      metadata: { accountType: child.accountType, relationship: body.relationship ?? null },
    });
    await writeAudit({
      action: 'guardianship.consent',
      actorUserId: parent.id,
      targetType: 'user',
      targetId: child.id,
    });

    return ok(
      c,
      {
        id: child.id,
        publicId: child.publicId,
        name: child.name,
        username: child.username,
        email: child.email,
        accountType: child.accountType,
        status: child.status,
      },
      201,
    );
  })
  .get('/', requireAuth, async (c) => {
    const parent = c.get('user');
    if (!parent) throw AppError.unauthorized();
    return ok(c, await listChildren(parent.id));
  })
  .post('/:id/pin', requireAuth, validate('json', PinSchema), async (c) => {
    const parent = c.get('user');
    if (!parent) throw AppError.unauthorized();
    const childId = c.req.param('id');
    if (!(await isGuardianOf(parent.id, childId))) throw AppError.forbidden();

    await resetChildPin(childId, c.req.valid('json').pin);
    await writeAudit({
      action: 'child.pin_reset',
      actorUserId: parent.id,
      targetType: 'user',
      targetId: childId,
    });
    return ok(c, { ok: true });
  })
  // Guardian-approved claim: a CHILD can't self-claim, so their guardian sets the
  // real email that graduates them to a self-owned account once verified (§10).
  .post('/:id/claim', requireAuth, validate('json', GuardianClaimSchema), async (c) => {
    const parent = c.get('user');
    if (!parent) throw AppError.unauthorized();
    const childId = c.req.param('id');
    if (!(await isGuardianOf(parent.id, childId))) throw AppError.forbidden();

    const { email } = c.req.valid('json');
    if (isSynthEmail(email)) throw AppError.badRequest('Provide a real email address');
    const taken = await db.user.findFirst({
      where: { email, id: { not: childId } },
      select: { id: true },
    });
    if (taken) throw AppError.conflict('Email already in use');

    await startGuardianClaim(childId, email);
    await writeAudit({
      action: 'account.claim_started',
      actorUserId: parent.id,
      targetType: 'user',
      targetId: childId,
      metadata: { byGuardian: true },
    });
    return ok(c, { status: 'verification_sent' });
  });
