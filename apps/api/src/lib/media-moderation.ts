// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ModerationStatus } from '@bingoo.ai/db'
import { hasAnyRole, type PlatformRole } from '../auth/roles'

/**
 * The R5 gate: nothing reaches a child until a moderator approves it. This module
 * owns both halves of that rule — who may decide, and what an asset's moderation
 * is when it is born.
 */

/** Platform roles that may approve / reject / flag an asset. */
export const MODERATION_ROLES: readonly PlatformRole[] = ['MODERATOR', 'ADMIN']

/**
 * Moderation an asset starts life with, from its creator's role.
 *
 * A creator who already holds the approve button would only ever be clicking it on
 * their own upload, so PENDING buys no review — approve up front instead (the audit
 * log records it with `auto: true`). Everyone else, CONTENT_EDITOR included, still
 * lands PENDING: that queue is the R5 gate, and it only means something while the
 * people filling it are not the people emptying it.
 *
 * No role (scripts, background jobs, anonymous) → PENDING. Fail closed.
 */
export function initialModeration(role: string | null | undefined): ModerationStatus {
  return hasAnyRole(role, MODERATION_ROLES) ? 'APPROVED' : 'PENDING'
}
