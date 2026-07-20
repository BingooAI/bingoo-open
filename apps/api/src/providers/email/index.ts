import { readEnv } from '../core/config';
import { createRegistry } from '../core/registry';
import { resendAdapter } from './adapters/resend';
import type { EmailPort } from './port';

export const emailRegistry = createRegistry<EmailPort>(
  'email',
  readEnv('EMAIL_PROVIDER') ?? 'resend',
  [resendAdapter],
);

export type * from './port';
