import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../lib/context';
import { ok } from '../lib/response';
import { validate } from '../lib/validate';
import { getNotification } from '../providers';

/**
 * Send a push to explicit device tokens. NOTE: the Device token registry +
 * per-user Notification feed (DB) land in the next increment; for now this
 * proves the push provider end to end.
 */
export const notifications = new Hono<AppEnv>().post(
  '/push',
  validate(
    'json',
    z.object({
      tokens: z.array(z.string()).min(1),
      title: z.string(),
      body: z.string(),
      imageUrl: z.string().optional(),
      data: z.record(z.string(), z.string()).optional(),
    }),
  ),
  async (c) => {
    const { tokens, ...message } = c.req.valid('json');
    const result = await getNotification().sendToTokens(tokens, message);
    return ok(c, result);
  },
);
