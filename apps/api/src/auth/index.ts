// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Auth module barrel — the API's authentication + authorization surface.
 * SERVER-ONLY (R1): never import from a client bundle.
 */
export { auth } from './auth'
export type { Auth, AuthSession, SessionUser, SessionData } from './auth'
export * from './roles'
export * from './guards'
