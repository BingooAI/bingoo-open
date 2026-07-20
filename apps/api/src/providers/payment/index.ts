import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { vietqrAdapter } from './adapters/vietqr';
import type { PaymentGatewayPort } from './port';

export const paymentRegistry = createRegistry<PaymentGatewayPort>(
  'payment',
  readEnv('PAYMENT_PROVIDER') ?? 'vietqr',
  [vietqrAdapter],
);

export type * from './port';
