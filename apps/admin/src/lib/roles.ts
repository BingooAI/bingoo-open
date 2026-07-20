/**
 * Platform-role helpers for admin UI gating.
 *
 * These MIRROR the API's authorization semantics (apps/api/src/auth/roles.ts +
 * the CONTENT_ROLES / MODERATION_ROLES / ADMIN gates in routes/media.ts &
 * routes/prompts.ts) so the UI can hide or disable actions the caller can't
 * perform. This is UX only — the server re-enforces every one of these on each
 * request (R1/R6); the client is never trusted.
 *
 * `User.role` is a comma-separated set (Better Auth admin plugin). We only need
 * the staff subset here; non-staff roles collapse to "not staff".
 */
export type StaffRole = 'ADMIN' | 'CONTENT_EDITOR' | 'MODERATOR';

const STAFF_ROLES: readonly StaffRole[] = ['ADMIN', 'CONTENT_EDITOR', 'MODERATOR'];

/** Split the comma-separated role string into a normalized, de-duped set. */
export function parseRoles(role: string | null | undefined): string[] {
  if (!role) return [];
  return [
    ...new Set(
      role
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function has(roles: string[], ...any: string[]): boolean {
  return any.some((r) => roles.includes(r));
}

/** Any staff role at all — the baseline for entering the admin app. */
export function isStaff(role: string | null | undefined): boolean {
  return has(parseRoles(role), ...STAFF_ROLES);
}

/** ADMIN or CONTENT_EDITOR — may create/edit content, tags, templates, generate. */
export function canManageContent(role: string | null | undefined): boolean {
  return has(parseRoles(role), 'ADMIN', 'CONTENT_EDITOR');
}

/** ADMIN or MODERATOR — may approve/reject/flag assets. */
export function canModerate(role: string | null | undefined): boolean {
  return has(parseRoles(role), 'ADMIN', 'MODERATOR');
}

/** ADMIN only — prompt management, destructive platform actions. */
export function isAdmin(role: string | null | undefined): boolean {
  return has(parseRoles(role), 'ADMIN');
}

/** Capability bundle derived once from a role string, handed to the UI. */
export interface StaffCapabilities {
  isStaff: boolean;
  canManageContent: boolean;
  canModerate: boolean;
  isAdmin: boolean;
}

export function resolveCapabilities(role: string | null | undefined): StaffCapabilities {
  return {
    isStaff: isStaff(role),
    canManageContent: canManageContent(role),
    canModerate: canModerate(role),
    isAdmin: isAdmin(role),
  };
}
