import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, bearer, organization, username } from 'better-auth/plugins';
import { db } from '@bingoo/db';
import { mintPublicId } from '@bingoo/core';
import { env } from '../config/env';
import { writeAudit } from '../repos/audit.repo';
import { emitEvent } from '../repos/events.repo';
import { onUserUpdated, refreshAccountType } from '../repos/lifecycle.repo';
import { enforceDeviceLimit } from '../repos/session-policy.repo';
import { ADMIN_ROLES, DEFAULT_ROLE } from './roles';
import { sendAuthEmail } from './emails';

/**
 * The Better Auth server instance — the single source of authentication for the
 * API (§8). SERVER-ONLY (R1): it holds the signing secret + DB access and must
 * never reach a client bundle.
 *
 * P1 wiring: email/password + Google OAuth (adults), sessions, email hooks
 * (verify/reset via the swappable email provider), the admin plugin (platform
 * roles + ban) and the organization plugin (flat, teams laid for later). Child
 * login (username + PIN), synthetic `@id.bingoo.ai` emails and guardianship are
 * P2 — their columns already exist in the covering schema.
 */

const baseURL = env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}`;
const googleConfigured = Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);

export const auth = betterAuth({
  appName: 'Bingoo',
  baseURL,
  // Undefined in dev → Better Auth warns + uses a dev secret; env.ts enforces it
  // in production so the fallback never ships.
  secret: env.BETTER_AUTH_SECRET,
  // Web origins (CORS) + the mobile app's deep-link scheme so the Expo client's
  // bearer/OAuth flow is trusted (see the `expo()` plugin below).
  trustedOrigins: [...env.CORS_ORIGINS, 'bingoo://'],
  database: prismaAdapter(db, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
    // 6 so children's 6-digit PIN fits the same credential system; adults may
    // (and should) still choose longer. Children are minted server-side and
    // never flow through this validator (see children.repo).
    minPasswordLength: 6,
    sendResetPassword: async ({ user, url }) => {
      // Dev convenience: surface the link when no mailbox receives it (never in prod).
      if (env.NODE_ENV !== 'production') console.log(`[dev] reset ${user.email}: ${url}`);
      await sendAuthEmail('reset', user, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Dev convenience: surface the link when no mailbox receives it (never in prod).
      if (env.NODE_ENV !== 'production') console.log(`[dev] verify ${user.email}: ${url}`);
      await sendAuthEmail('verify', user, url);
    },
  },

  ...(googleConfigured
    ? {
        socialProviders: {
          google: {
            clientId: env.GOOGLE_OAUTH_CLIENT_ID as string,
            clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET as string,
          },
        },
      }
    : {}),

  // Bingoo columns Better Auth should read/write/return. `input: false` fields
  // are server-controlled (a client can never set them on sign-up).
  user: {
    additionalFields: {
      publicId: { type: 'string', required: false, input: false },
      status: { type: 'string', required: false, input: false },
      accountType: { type: 'string', required: false, input: false },
      dateOfBirth: { type: 'date', required: false },
      country: { type: 'string', required: false },
      locale: { type: 'string', required: false },
      timezone: { type: 'string', required: false },
      gender: { type: 'string', required: false },
      managedByGuardian: { type: 'boolean', required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Mint the immutable public id + derive the initial lifecycle status:
        // a verified email (Google) or verification-disabled dev → ACTIVE; an
        // adult awaiting email verification → PENDING (§3.2). Sync — no await.
        before: (user) => {
          const active = user.emailVerified || !env.AUTH_REQUIRE_EMAIL_VERIFICATION;
          return Promise.resolve({
            data: {
              ...user,
              publicId: mintPublicId(),
              status: active ? 'ACTIVE' : 'PENDING',
            },
          });
        },
        after: async (user) => {
          await writeAudit({
            action: 'auth.user.created',
            actorUserId: user.id,
            targetType: 'user',
            targetId: user.id,
          });
        },
      },
      update: {
        after: async (user) => {
          // Activate on email-verify + complete a claim/graduation (§3.2, §10).
          // Raw DB writes inside don't re-enter these hooks, so no recursion.
          // Bingoo fields arrive via Better Auth's additionalFields index type.
          await onUserUpdated({
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            status: String(user.status ?? ''),
            managedByGuardian: Boolean(user.managedByGuardian),
          });
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // Keep the age tier fresh (auto CHILD→TEEN→ADULT), log the login (audit)
          // and record it on the activity stream (feeds the 360°, §3.8).
          await refreshAccountType(session.userId);
          await writeAudit({
            action: 'auth.login',
            actorUserId: session.userId,
            targetType: 'session',
            targetId: session.id,
            ipAddress: session.ipAddress ?? null,
            userAgent: session.userAgent ?? null,
          });
          await emitEvent(session.userId, 'auth.login');
          // Cap concurrent devices (remote config) — revoke oldest beyond the limit.
          await enforceDeviceLimit(session.userId);
        },
      },
    },
  },

  // NB: cookieCache is deliberately OFF. A signed session cookie would let a
  // request skip the DB for minutes, which would delay revocation — a banned or
  // signed-out child could linger (R5/R6, "safety over speed"). Every request
  // therefore re-validates the session against the DB. The perf win comes later
  // from Redis secondaryStorage via getCache() (§8): it's just as fast but stays
  // immediately consistent, because sign-out/ban evicts the session from Redis.

  plugins: [
    admin({ defaultRole: DEFAULT_ROLE, adminRoles: [...ADMIN_ROLES] }),
    organization({ teams: { enabled: true } }),
    // Child login by username + PIN (no real email). Children are created by a
    // guardian via /children; this enables their /sign-in/username flow.
    username({ minUsernameLength: 3, maxUsernameLength: 30 }),
    bearer(),
    // Native (Expo) client: enables the mobile bearer token flow + OAuth
    // deep-links back to the app scheme. Additive — web is unaffected.
    expo(),
  ],
});

export type Auth = typeof auth;
/** The `{ user, session }` payload Better Auth returns from `getSession` (or null). */
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
/** The authenticated user (Better Auth core + admin plugin + Bingoo fields). */
export type SessionUser = NonNullable<AuthSession>['user'];
/** The active session row (includes activeOrganizationId / activeTeamId). */
export type SessionData = NonNullable<AuthSession>['session'];
