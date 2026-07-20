// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Stable, machine-readable error codes. The API returns codes (not display
 * text); clients map them to localized copy via `@bingoo.ai/i18n`, so no
 * user-facing strings are hardcoded server-side (R4) and the API stays
 * locale-agnostic.
 */
export const ErrorCode = {
  BadRequest: 'bad_request',
  Unauthorized: 'unauthorized',
  Forbidden: 'forbidden',
  NotFound: 'not_found',
  Validation: 'validation_error',
  Conflict: 'conflict',
  PayloadTooLarge: 'payload_too_large',
  BadGateway: 'bad_gateway',
  ServiceUnavailable: 'service_unavailable',
  Internal: 'internal_error',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/** Errors thrown intentionally by routes/services; mapped to the JSON envelope. */
export class AppError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(status: ContentfulStatusCode, code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message?: string, details?: unknown): AppError {
    return new AppError(400, ErrorCode.BadRequest, message, details)
  }
  static unauthorized(message?: string): AppError {
    return new AppError(401, ErrorCode.Unauthorized, message)
  }
  static forbidden(message?: string): AppError {
    return new AppError(403, ErrorCode.Forbidden, message)
  }
  static notFound(message?: string): AppError {
    return new AppError(404, ErrorCode.NotFound, message)
  }
  static validation(details: unknown, message = 'Validation failed'): AppError {
    return new AppError(400, ErrorCode.Validation, message, details)
  }
  static conflict(message?: string, details?: unknown): AppError {
    return new AppError(409, ErrorCode.Conflict, message, details)
  }
  static payloadTooLarge(message?: string): AppError {
    return new AppError(413, ErrorCode.PayloadTooLarge, message)
  }
  static serviceUnavailable(message?: string): AppError {
    return new AppError(503, ErrorCode.ServiceUnavailable, message)
  }
}
