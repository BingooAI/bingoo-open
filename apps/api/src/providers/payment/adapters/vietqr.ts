import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../../lib/errors';
import { readEnv, requireEnv } from '../../core/config';
import type { ProviderAdapter } from '../../core/registry';
import { buildVietQrString } from '../emv';
import type {
  Charge,
  CreateChargeInput,
  IncomingTransaction,
  PaymentGatewayPort,
  WebhookInput,
} from '../port';

const REQUIRED = [
  'VIETQR_BANK_BIN',
  'VIETQR_ACCOUNT_NO',
  'VIETQR_ACCOUNT_NAME',
  'PAYMENT_WEBHOOK_SECRET',
] as const;

/**
 * Contract for the webhook our bank-notification relay (Android app / iOS
 * shortcut) POSTs when it reads an incoming transfer SMS/email.
 */
const webhookBodySchema = z.object({
  amount: z.coerce.number().int().positive(),
  content: z.string(),
  txId: z.string().optional(),
  transferredAt: z.string().optional(),
});

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const vietqrAdapter: ProviderAdapter<PaymentGatewayPort> = {
  key: 'vietqr',
  requiredEnv: REQUIRED,
  create(): PaymentGatewayPort {
    const env = requireEnv('payment', 'vietqr', REQUIRED);
    const prefix = (readEnv('VIETQR_MEMO_PREFIX') ?? 'BINGOO').toUpperCase();
    // Reference lives in the transfer content; banks tend to upper-case + strip,
    // so we keep it [A-Z0-9] and match case-insensitively.
    const referencePattern = new RegExp(`${prefix}[A-Z0-9]+`);

    return {
      // Synchronous (QR is built locally) but returns a Promise to satisfy the
      // port — other gateways (e.g. Stripe) will do real network I/O here.
      createCharge(input: CreateChargeInput): Promise<Charge> {
        const reference = prefix + randomBytes(5).toString('hex').toUpperCase();
        const qrString = buildVietQrString({
          bin: env.VIETQR_BANK_BIN,
          accountNo: env.VIETQR_ACCOUNT_NO,
          amount: input.amount,
          content: reference,
        });
        const query = new URLSearchParams({
          amount: String(input.amount),
          addInfo: reference,
          accountName: env.VIETQR_ACCOUNT_NAME,
        });
        const qrImageUrl = `https://img.vietqr.io/image/${env.VIETQR_BANK_BIN}-${env.VIETQR_ACCOUNT_NO}-compact2.png?${query.toString()}`;
        const expiresAt = input.expiresInSeconds
          ? new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
          : undefined;
        return Promise.resolve({
          reference,
          amount: input.amount,
          qrString,
          qrImageUrl,
          expiresAt,
        });
      },

      verifyWebhook({ rawBody, headers }: WebhookInput): IncomingTransaction {
        const token = headers['x-webhook-token'] ?? '';
        if (!safeEqual(token, env.PAYMENT_WEBHOOK_SECRET)) {
          throw AppError.unauthorized('invalid webhook token');
        }
        let json: unknown;
        try {
          json = JSON.parse(rawBody);
        } catch {
          throw AppError.badRequest('invalid JSON body');
        }
        const parsed = webhookBodySchema.safeParse(json);
        if (!parsed.success) {
          throw AppError.validation(
            parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          );
        }
        const match = referencePattern.exec(parsed.data.content.toUpperCase());
        return {
          amount: parsed.data.amount,
          reference: match ? match[0] : '',
          txId: parsed.data.txId,
          rawContent: parsed.data.content,
          paidAt: parsed.data.transferredAt,
        };
      },
    };
  },
};
