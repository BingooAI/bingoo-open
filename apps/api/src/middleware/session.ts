import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/context'
import { auth } from '../auth'

/**
 * Resolves the Better Auth session (cookie or bearer token) once per request and
 * exposes it on the context as `user` / `session` (both `null` when
 * unauthenticated). Runs globally so any handler or guard can read the current
 * identity without re-fetching. Cheap: no session token → no DB hit, and a
 * short-lived cookie cache serves the hot path.
 */
export const session = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  c.set('user', result?.user ?? null)
  c.set('session', result?.session ?? null)
  await next()
})
