import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getPayment } from '../providers';

/**
 * Inbound payment webhook. The bank-notification relay POSTs here with a shared
 * secret; the gateway adapter authenticates + parses it into a normalized
 * transaction. NOTE: reconciliation against the Payment model is the next
 * increment — for now we verify, parse, and acknowledge.
 */
export const paymentWebhooks = new Hono<AppEnv>().post('/:provider', async (c) => {
  const provider = c.req.param('provider');
  const rawBody = await c.req.text();
  const tx = getPayment(provider).verifyWebhook({ rawBody, headers: c.req.header() });

  // TODO(payment): persist + reconcile against the Payment model (idempotent).
  console.log(`[${c.get('requestId')}] payment webhook (${provider}):`, {
    reference: tx.reference,
    amount: tx.amount,
    txId: tx.txId,
  });

  return c.json({ received: true, reference: tx.reference }, 200);
});
