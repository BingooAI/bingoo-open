// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Run on every path except API routes (proxied to the backend), Next internals
  // and static files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
