import { Resend } from 'resend';
import { readEnv, requireEnv } from '../../core/config';
import { ProviderError } from '../../core/errors';
import type { ProviderAdapter } from '../../core/registry';
import type { EmailPort, SendEmailInput } from '../port';

const REQUIRED = ['RESEND_API_KEY'] as const;

export const resendAdapter: ProviderAdapter<EmailPort> = {
  key: 'resend',
  requiredEnv: REQUIRED,
  create(): EmailPort {
    const env = requireEnv('email', 'resend', REQUIRED);
    // Default sender: EMAIL_FROM (canonical) or RESEND_FROM (provider-named alias).
    const defaultFrom = readEnv('EMAIL_FROM') ?? readEnv('RESEND_FROM');
    const client = new Resend(env.RESEND_API_KEY);

    return {
      async send(input: SendEmailInput) {
        const from = input.from ?? defaultFrom;
        if (!from) {
          throw new ProviderError('email', 'resend', 'no sender (set EMAIL_FROM or pass `from`)');
        }
        if (!input.html && !input.text) {
          throw new ProviderError('email', 'resend', 'email requires `html` or `text`');
        }
        const payload = {
          from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          reply_to: input.replyTo,
          cc: input.cc,
          bcc: input.bcc,
        } as Parameters<typeof client.emails.send>[0];

        const { data, error } = await client.emails.send(payload);
        if (error) throw new ProviderError('email', 'resend', error.message, error);
        return { id: data?.id ?? '' };
      },
    };
  },
};
