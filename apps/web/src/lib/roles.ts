// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Platform roles, as this app needs to read them.
 *
 * `User.role` is a comma-separated set, so one account can be a learner and a content editor at
 * once — which is the ordinary case for a tutor who also authors their own material. Nothing
 * switches between them; both are true at the same time.
 *
 * The authoritative list and the server-side guards live in `apps/api/src/auth/roles.ts`. This
 * file only decides what to show, and showing a link is not permission — the admin app checks
 * the session again on every request.
 */

/** Roles that grant entry to the authoring app. */
const STAFF_ROLES = ['ADMIN', 'CONTENT_EDITOR', 'MODERATOR'] as const

export function parseRoles(role: string | null | undefined): string[] {
  if (!role) return []
  return [
    ...new Set(
      role
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean),
    ),
  ]
}

/** True when this account may enter the authoring app. */
export function isStaff(role: string | null | undefined): boolean {
  const roles = parseRoles(role)
  return STAFF_ROLES.some((r) => roles.includes(r))
}

/**
 * Where the authoring app lives.
 *
 * Configurable because it is a separate deployment: on a laptop it is another port, and on a
 * self-hosted install it is usually another hostname entirely.
 */
export function adminUrl(): string {
  return process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'
}
