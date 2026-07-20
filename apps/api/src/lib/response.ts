import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from './errors';
import type { PaginationMeta } from './pagination';

/**
 * The single error envelope shape every failing response uses. `message` is a
 * developer-facing hint (English, for logs/debugging); clients render UI text
 * from `code` via i18n.
 */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export function errorBody(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiErrorBody {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

/** Success envelope: a single resource or payload under `data`. */
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ data }, status);
}

/** Success envelope for list endpoints: items under `data`, page info in `meta`. */
export function paginated<T>(
  c: Context,
  items: readonly T[],
  meta: PaginationMeta,
  status: ContentfulStatusCode = 200,
) {
  return c.json({ data: items, meta }, status);
}
