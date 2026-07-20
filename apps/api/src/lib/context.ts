// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { SessionData, SessionUser } from '../auth/auth'

/**
 * Shared Hono generics. Every router/middleware is typed with `AppEnv` so
 * `c.get`/`c.set` on context variables stay type-safe end to end.
 *
 * `user`/`session` are populated by the session middleware on every request and
 * are `null` when unauthenticated; the guards (requireAuth/requireRole/…) narrow
 * from there. This is a type-only import, so it adds no runtime coupling.
 */
export type AppEnv = {
  Variables: {
    requestId: string
    user: SessionUser | null
    session: SessionData | null
  }
}
