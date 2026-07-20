import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../lib/context';

/**
 * Assigns a request id (honoring an inbound `x-request-id`, else a fresh UUID),
 * exposes it on the context for handlers/error envelopes, and echoes it back in
 * the response header for correlation. Runs first so every log line + error
 * carries the id.
 */
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const inbound = c.req.header('x-request-id');
  const id = inbound && inbound.length <= 128 ? inbound : randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
});
