// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Hono } from 'hono'
import type { AppEnv } from '../lib/context'
import { env } from '../config/env'
import { pingDatabase } from '../repos/health.repo'
import { providersHealth } from '../providers'
import { activeProfile, capabilitiesWithoutLocalAdapter, isOptional } from '../providers/core/profile'

/**
 * Health probes. `/health` is liveness (process is up, needs no DB); `/health/db`
 * is readiness (can we reach the database); `/health/providers` introspects which
 * external providers are configured (env present) and which are the active choice.
 */
export const health = new Hono<AppEnv>()
  .get('/', (c) =>
    c.json({
      status: 'ok',
      env: env.NODE_ENV,
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '0.1.0',
    }),
  )
  .get('/db', async (c) => {
    const up = await pingDatabase()
    return c.json({ status: up ? 'ok' : 'down', dependency: 'database' }, up ? 200 : 503)
  })
  .get('/providers', (c) => {
    const providers = providersHealth()
    // "degraded" when a *required* capability's active provider is missing its config.
    // An optional one being unset is a smaller installation, not a broken one — reporting
    // it as degraded would teach operators that degraded means nothing.
    const activeReady = providers
      .filter((p) => p.active && !isOptional(p.capability))
      .every((p) => p.configured)
    // The profile and its gaps are reported alongside, so an operator can tell a
    // deliberately cloud-backed capability from one that has no local option yet.
    return c.json({
      status: activeReady ? 'ok' : 'degraded',
      profile: activeProfile(),
      withoutLocalAdapter: capabilitiesWithoutLocalAdapter(),
      providers,
    })
  })
