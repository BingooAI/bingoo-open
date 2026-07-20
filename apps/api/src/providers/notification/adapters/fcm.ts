import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { requireEnv } from '../../core/config';
import { ProviderError } from '../../core/errors';
import type { ProviderAdapter } from '../../core/registry';
import type { NotificationMessage, NotificationPort, SendToTokensResult } from '../port';

const REQUIRED = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const;
const APP_NAME = 'bingoo-notifications';

// FCM error codes that mean "this token is dead" — safe to prune from the DB.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export const fcmAdapter: ProviderAdapter<NotificationPort> = {
  key: 'fcm',
  requiredEnv: REQUIRED,
  create(): NotificationPort {
    const env = requireEnv('notification', 'fcm', REQUIRED);
    const existing = getApps().find((a) => a.name === APP_NAME);
    const app: App =
      existing ??
      initializeApp(
        {
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            // Env vars store newlines as literal `\n`; restore them for the PEM.
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        },
        APP_NAME,
      );
    const messaging = getMessaging(app);

    const toFcm = (message: NotificationMessage) => ({
      notification: { title: message.title, body: message.body, imageUrl: message.imageUrl },
      data: message.data,
    });

    return {
      async sendToTokens(tokens, message): Promise<SendToTokensResult> {
        if (tokens.length === 0) return { successCount: 0, failureCount: 0, invalidTokens: [] };
        try {
          const res = await messaging.sendEachForMulticast({ tokens, ...toFcm(message) });
          const invalidTokens: string[] = [];
          res.responses.forEach((r, i) => {
            const token = tokens[i];
            if (!r.success && token && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
              invalidTokens.push(token);
            }
          });
          return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens };
        } catch (err) {
          throw new ProviderError('notification', 'fcm', 'sendToTokens failed', err);
        }
      },
      async sendToTopic(topic, message) {
        try {
          const messageId = await messaging.send({ topic, ...toFcm(message) });
          return { messageId };
        } catch (err) {
          throw new ProviderError('notification', 'fcm', 'sendToTopic failed', err);
        }
      },
    };
  },
};
