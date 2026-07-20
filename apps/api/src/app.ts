// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './lib/context'
import { ErrorCode } from './lib/errors'
import { errorBody } from './lib/response'
import { env } from './config/env'
import { authHandler } from './auth/handler'
import { requestId } from './middleware/request-id'
import { session } from './middleware/session'
import { notFound, onError } from './middleware/error'
import { routes } from './routes'

/** Cap request bodies at 1 MB — a cheap DoS guard for a public API. */
const MAX_BODY_BYTES = 1024 * 1024

/**
 * Builds the Hono application: middleware pipeline + mounted routers. Exported
 * as a factory so it can be instantiated in tests without opening a socket.
 */
export function createApp() {
  const app = new Hono<AppEnv>()

  // Order matters: request id first (so logs/errors carry it), then hardening.
  app.use('*', requestId)
  app.use('*', logger())
  app.use('*', secureHeaders())
  app.use('*', cors({ origin: env.CORS_ORIGINS, credentials: true }))

  // Better Auth core endpoints: sign-up/in/out, email verify + reset, Google
  // OAuth, and the admin + organization plugin routes. Mounted BEFORE bodyLimit
  // and our session middleware — Better Auth reads the raw body and manages its
  // own session cookies (authHandler explains the request rebuild). It still runs
  // behind requestId / cors / secure-headers.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => authHandler(c.req.raw))

  app.use(
    '*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) =>
        c.json(
          errorBody(ErrorCode.PayloadTooLarge, 'Request body too large', String(c.get('requestId') ?? '')),
          413,
        ),
    }),
  )

  // Resolve the Better Auth session for every non-auth request → c.var.user /
  // c.var.session (both null when unauthenticated).
  app.use('*', session)

  app.route('/', routes)

  app.notFound(notFound)
  app.onError(onError)

  return app
}
