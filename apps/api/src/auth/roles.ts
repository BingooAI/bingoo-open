/**
 * Platform roles (§1, §4). A user carries a SET of roles stored on `User.role`
 * as a comma-separated string (Better Auth admin plugin), defaulting to `USER`.
 * Authorization is "has-role": an action is allowed when a required role is in
 * the set. Only `ADMIN` may change another user's roles (admin plugin).
 *
 * NB: being admin/owner of an organization, or a teacher of a class, is NOT a
 * platform role — those are org-scoped / class-scoped (see the guards). This
 * keeps least-privilege: an org admin can never escalate to platform admin (§6).
 */
export const PLATFORM_ROLES = [
  'USER',
  'PARENT',
  'TEACHER',
  'TUTOR',
  'TA',
  'CONTENT_EDITOR',
  'MODERATOR',
  'ADMIN',
] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const DEFAULT_ROLE: PlatformRole = 'USER'

/** Roles the admin plugin treats as platform administrators. */
export const ADMIN_ROLES: readonly PlatformRole[] = ['ADMIN']

const KNOWN = new Set<string>(PLATFORM_ROLES)

/** Split the CSV role string into a normalized, de-duped set of known roles. */
export function parseRoles(role: string | null | undefined): PlatformRole[] {
  if (!role) return []
  const out: PlatformRole[] = []
  for (const raw of role.split(',')) {
    const r = raw.trim().toUpperCase()
    if (KNOWN.has(r) && !out.includes(r as PlatformRole)) out.push(r as PlatformRole)
  }
  return out
}

/** True when the user's role set includes `required`. */
export function hasRole(role: string | null | undefined, required: PlatformRole): boolean {
  return parseRoles(role).includes(required)
}

/** True when the user's role set includes ANY of `required`. */
export function hasAnyRole(role: string | null | undefined, required: readonly PlatformRole[]): boolean {
  const set = parseRoles(role)
  return required.some((r) => set.includes(r))
}
