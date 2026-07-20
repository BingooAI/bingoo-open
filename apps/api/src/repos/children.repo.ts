import { randomUUID } from 'node:crypto';
import { db } from '@bingoo/db';
import { deriveAccountType, mintPublicId, synthEmail } from '@bingoo/core';
import { auth } from '../auth/auth';
import { parseRoles } from '../auth/roles';
import { resolveConsentConfig } from './config.repo';

/**
 * Child + guardianship data access (§3.5, §3.6, §10). A child is minted entirely
 * server-side by a guardian — never via self-serve sign-up — so we create the
 * User, its credential (username + hashed PIN) and the Guardianship+consent
 * atomically here, controlling every lifecycle field. Better Auth's own
 * primitives are reused (password hashing + id generation) so children stay
 * fully compatible with the /sign-in/username flow.
 */

export interface CreateChildInput {
  guardianId: string;
  name: string;
  /** Already trimmed, lowercased and validated by the route. */
  username: string;
  /** 6-digit PIN, validated by the route. */
  pin: string;
  dateOfBirth: Date;
  country?: string | null;
  gender?: string | null;
  relationship?: string | null;
}

export async function createChild(input: CreateChildInput) {
  const ctx = await auth.$context;
  const publicId = mintPublicId();
  const userId = ctx.generateId({ model: 'user' }) || randomUUID();
  const accountId = ctx.generateId({ model: 'account' }) || randomUUID();
  const hashedPin = await ctx.password.hash(input.pin);
  const consentConfig = await resolveConsentConfig();
  const accountType = deriveAccountType(input.dateOfBirth, input.country ?? null, consentConfig);

  return db.$transaction(async (tx) => {
    const child = await tx.user.create({
      data: {
        id: userId,
        name: input.name,
        // Synthetic identity-only email — verified by construction (no mailbox).
        email: synthEmail(publicId),
        emailVerified: true,
        username: input.username,
        displayUsername: input.username,
        publicId,
        status: 'ACTIVE',
        accountType,
        dateOfBirth: input.dateOfBirth,
        country: input.country ?? null,
        gender: input.gender ?? null,
        managedByGuardian: true,
        role: 'USER',
      },
    });

    // Credential account: username lives on the user; the PIN is the password.
    await tx.account.create({
      data: {
        id: accountId,
        userId,
        providerId: 'credential',
        accountId: userId,
        password: hashedPin,
      },
    });

    await tx.guardianship.create({
      data: {
        guardianId: input.guardianId,
        childId: userId,
        relationship: input.relationship ?? null,
        status: 'active',
        consentAt: new Date(),
        consentBy: input.guardianId,
      },
    });

    // Creating a child makes the creator a parent — add PARENT to their role set.
    const guardian = await tx.user.findUnique({
      where: { id: input.guardianId },
      select: { role: true },
    });
    const roles = parseRoles(guardian?.role);
    if (!roles.includes('PARENT')) {
      await tx.user.update({
        where: { id: input.guardianId },
        data: { role: [...roles, 'PARENT'].join(',') },
      });
    }

    return child;
  });
}

/** The children a guardian actively manages, newest first. */
export async function listChildren(guardianId: string) {
  const links = await db.guardianship.findMany({
    where: { guardianId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: {
      relationship: true,
      consentAt: true,
      child: {
        select: {
          id: true,
          publicId: true,
          name: true,
          username: true,
          accountType: true,
          status: true,
          dateOfBirth: true,
          country: true,
          createdAt: true,
        },
      },
    },
  });
  return links.map((link) => ({
    ...link.child,
    relationship: link.relationship,
    consentAt: link.consentAt,
  }));
}

/** True when `guardianId` actively guards `childId` — the authz check for any
 *  operation on a specific child (R6, server-enforced). */
export async function isGuardianOf(guardianId: string, childId: string): Promise<boolean> {
  const link = await db.guardianship.findUnique({
    where: { guardianId_childId: { guardianId, childId } },
    select: { status: true },
  });
  return link?.status === 'active';
}

/** Replace a child's PIN (guardian-initiated credential management, §3.5). */
export async function resetChildPin(childId: string, pin: string): Promise<void> {
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(pin);
  await db.account.updateMany({
    where: { userId: childId, providerId: 'credential' },
    data: { password: hashed },
  });
}
