import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { Prisma } from '@bingoo/db';
import { ZodError } from 'zod';
import type { AppEnv } from '../lib/context';
import { AppError, ErrorCode } from '../lib/errors';
import { errorBody } from '../lib/response';
import { ProviderError, ProviderNotConfiguredError } from '../providers';

/** Map Hono's built-in HTTP status codes to our stable error codes. */
const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.BadRequest,
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  413: ErrorCode.PayloadTooLarge,
  502: ErrorCode.BadGateway,
  503: ErrorCode.ServiceUnavailable,
};

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export const notFound: NotFoundHandler<AppEnv> = (c) =>
  c.json(errorBody(ErrorCode.NotFound, 'Not Found', c.get('requestId')), 404);

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId');

  // Intentional, already-shaped errors.
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, requestId, err.details), err.status);
  }

  // Zod errors thrown outside the validate() wrapper.
  if (err instanceof ZodError) {
    return c.json(
      errorBody(ErrorCode.Validation, 'Validation failed', requestId, zodDetails(err)),
      400,
    );
  }

  // Known Prisma failures → meaningful HTTP status instead of a blanket 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return c.json(errorBody(ErrorCode.NotFound, 'Record not found', requestId), 404);
    }
    if (err.code === 'P2002') {
      return c.json(
        errorBody(ErrorCode.Conflict, 'Unique constraint violation', requestId, {
          target: err.meta?.target,
        }),
        409,
      );
    }
  }

  // DB unreachable / misconfigured → 503, not 500.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${requestId}] Database initialization error:`, err.message);
    return c.json(errorBody(ErrorCode.ServiceUnavailable, 'Database unavailable', requestId), 503);
  }

  // External provider not configured (missing keys) → 503; other provider
  // failures (vendor error, unreachable) → 502. Never leak the vendor detail.
  if (err instanceof ProviderNotConfiguredError) {
    return c.json(
      errorBody(
        ErrorCode.ServiceUnavailable,
        `${err.capability} provider not configured`,
        requestId,
        {
          capability: err.capability,
          provider: err.provider,
        },
      ),
      503,
    );
  }
  if (err instanceof ProviderError) {
    console.error(`[${requestId}] Provider error:`, err.message, err.cause ?? '');
    return c.json(
      errorBody(ErrorCode.BadGateway, `${err.capability} provider failed`, requestId, {
        capability: err.capability,
        provider: err.provider,
      }),
      502,
    );
  }

  if (err instanceof HTTPException) {
    const code = STATUS_TO_CODE[err.status] ?? ErrorCode.Internal;
    return c.json(errorBody(code, err.message, requestId), err.status as ContentfulStatusCode);
  }

  // Unknown error: log server-side, and return a generic 500 IN PRODUCTION (never
  // leak internals). In development, return the actual message — a bare
  // "Internal Server Error" told the caller nothing at all, so a failing image or
  // a failing TTS line was indistinguishable from a bug in the client, and every
  // debugging session began by grepping the server log for the thing the response
  // could simply have said.
  console.error(`[${requestId}] Unhandled error:`, err);
  const leakOk = process.env.NODE_ENV !== 'production';
  const detail = err instanceof Error ? err.message : String(err);
  return c.json(
    errorBody(
      ErrorCode.Internal,
      leakOk ? `Internal: ${detail}` : 'Internal Server Error',
      requestId,
    ),
    500,
  );
};
