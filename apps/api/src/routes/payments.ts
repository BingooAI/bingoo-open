import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../lib/context';
import { ok } from '../lib/response';
import { validate } from '../lib/validate';
import { getPayment } from '../providers';

/**
 * Create a payment charge → returns a VietQR (string + image URL) with a unique
 * reference embedded in the transfer content. NOTE: not yet persisted — the
 * Payment model + reconciliation land in the next increment.
 */
export const payments = new Hono<AppEnv>().post(
  '/',
  validate(
    'json',
    z.object({
      amount: z.number().int().positive(),
      orderRef: z.string().optional(),
      description: z.string().optional(),
      expiresInSeconds: z.number().int().positive().optional(),
    }),
  ),
  async (c) => {
    const charge = await getPayment().createCharge(c.req.valid('json'));
    return ok(c, charge, 201);
  },
);
