import { z } from 'zod'

// Prisma 7 / 12-factor: load a local .env for dev if present; in prod the
// environment provides the vars directly. Must run before we read process.env.
try {
  process.loadEnvFile()
} catch {
  // no local .env — rely on the ambient environment
}

/**
 * Server-only runtime config. Secrets and connection strings live here and NEVER
 * reach the client bundle (R1). Validation is fail-fast: a missing/invalid var
 * crashes the process at boot instead of surfacing as a mysterious 500 later.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    /** Comma-separated browser origins allowed to call the API (CORS allowlist). */
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    /** Postgres connection string (consumed by @bingoo/db). Optional so the API can
     *  boot for liveness checks without a database; queries fail as 503 if unset. */
    DATABASE_URL: z.string().optional(),

    // ── Auth (Better Auth) ──────────────────────────────────────────────────────
    /** Signing secret for sessions/tokens. Required in production (enforced below);
     *  when unset in dev the API still boots and Better Auth uses a dev fallback. */
    BETTER_AUTH_SECRET: z.string().min(1).optional(),
    /** Public base URL of THIS API — OAuth callback base + email link origin.
     *  Defaults to http://localhost:<PORT> in the auth module when unset. */
    BETTER_AUTH_URL: z.string().url().optional(),
    /** Web app origin that auth email deep links (verify / reset) point at. */
    WEB_URL: z.string().url().default('http://localhost:3000'),
    /** Require email verification before an adult's first login (§3.2). Off only
     *  for local testing. Accepts "false"/"0" to disable; anything else = on. */
    AUTH_REQUIRE_EMAIL_VERIFICATION: z
      .string()
      .default('true')
      .transform((value) => value !== 'false' && value !== '0'),
    /** Google OAuth (adults). Provider is enabled only when both are present. */
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    // A signing secret is mandatory in production — never ship the dev fallback.
    if (value.NODE_ENV === 'production' && !value.BETTER_AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'is required in production',
      })
    }
  })

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  // Never log the raw process.env — only the names/reasons of invalid vars.
  console.error(`Invalid environment variables:\n${details}`)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
