// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Map a Better Auth error code to an `auth.errors.*` i18n key, so the UI shows a
 * localized message (R4) instead of the raw English server text. Unknown codes
 * fall back to a generic message.
 */
export function authErrorKey(code?: string | null): string {
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'invalidCredentials'
    case 'USER_ALREADY_EXISTS':
      return 'emailTaken'
    case 'EMAIL_NOT_VERIFIED':
      return 'emailNotVerified'
    case 'INVALID_TOKEN':
    case 'INVALID_OR_EXPIRED_TOKEN':
      return 'invalidToken'
    case 'PASSWORD_TOO_SHORT':
      return 'weakPassword'
    default:
      return 'generic'
  }
}
